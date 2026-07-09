import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';
import redisClient from '../config/redis';
import { taskQueue } from '../queue';
import { paymentCircuitBreaker } from '../services/payment.service';
import { Prisma } from '@prisma/client';
import { EventEmitter } from 'events';
import logger from '../utils/logger';

// --- Singleton Redis Subscriber for SSE ---
export const paymentEventEmitter = new EventEmitter();
paymentEventEmitter.setMaxListeners(0); // Allow many concurrent users

let isSubscribed = false;
let reconnectAttemptsPayment = 0;

const ensurePaymentSubscriber = () => {
    if (isSubscribed) return;
    isSubscribed = true;
    const subscriber = redisClient.duplicate();

    const reconnect = () => {
        if (!isSubscribed) return; // already handling
        isSubscribed = false;
        subscriber.disconnect();

        reconnectAttemptsPayment++;
        const delay = Math.min(1000 * (2 ** reconnectAttemptsPayment), 30000); // Max 30s
        logger.warn(`SSE Payment Redis subscriber disconnected. Reconnecting in ${delay}ms (Attempt ${reconnectAttemptsPayment})`);

        setTimeout(() => {
            ensurePaymentSubscriber();
        }, delay);
    };

    subscriber.subscribe('payment_updates', (err) => {
        if (err) {
            logger.error({ err }, 'Redis subscribe error for payments');
            reconnect();
        } else {
            reconnectAttemptsPayment = 0;
            logger.info('Redis subscribed to payment_updates');
        }
    });

    subscriber.on('error', (err) => {
        logger.error({ err }, 'Redis payment subscriber error event');
    });

    subscriber.on('end', () => {
        logger.warn('Redis payment subscriber connection ended');
        reconnect();
    });

    subscriber.on('message', (channel, message) => {
        if (channel === 'payment_updates') {
            try {
                const data = JSON.parse(message);
                if (data.orderId) {
                    paymentEventEmitter.emit(`payment_update:${data.orderId}`, data);
                }
            } catch (err) {
                logger.error({ err }, 'SSE Message parsing error');
            }
        }
    });
};
// ------------------------------------------

// --- Redis Lua Script for Atomic Counter ---
const checkAndDecrScript = `
    local key = KEYS[1]
    local qty = tonumber(ARGV[1])
    
    if redis.call("EXISTS", key) == 0 then
        return -1 -- Not initialized
    end
    
    local remaining = tonumber(redis.call("GET", key))
    if remaining < qty then
        return -2 -- Sold out
    end
    
    return redis.call("DECRBY", key, qty) -- Returns remaining after decr
`;

export const createOrder = async (req: Request, res: Response): Promise<void> => {
    const idempotencyKey = (req as Request & { idempotencyKey?: string }).idempotencyKey;
    const redisIdempKey = `idempotency:${idempotencyKey}`;
    const userId = req.user?.id;
    const { ticketTypeId, ticketIds } = req.body;

    if (!userId || !ticketTypeId || !Array.isArray(ticketIds) || ticketIds.length === 0) {
        await redisClient.del(redisIdempKey); // allow retry
        res.status(400).json({ message: 'Invalid input' });
        return;
    }

    // Circuit Breaker Fast-Fail: Chặn ngay nếu Cổng thanh toán đang sập (Mở mạch)
    if (paymentCircuitBreaker.opened) {
        await redisClient.del(redisIdempKey); // allow retry
        res.status(503).json({ message: 'Cổng thanh toán đang bảo trì, vui lòng quay lại sau ít phút để tránh kẹt vé!' });
        return;
    }

    const qty = ticketIds.length;
    const remainingKey = `ticket_remaining:${ticketTypeId}`;
    let redisDecremented = false;

    try {
        // 1. Atomic Check & Decr via Lua Script
        let remainingAfterDecr = await redisClient.eval(checkAndDecrScript, 1, remainingKey, qty) as number;

        if (remainingAfterDecr === -1) {
            // Not initialized -> Try to acquire init lock
            const lockKey = `lock:init:${ticketTypeId}`;
            const locked = await redisClient.set(lockKey, '1', 'EX', 5, 'NX');

            if (locked) {
                // Lock OK: Query DB and initialize
                const tt = await prisma.ticket_types.findUnique({ where: { id: ticketTypeId } });
                if (!tt) {
                    await redisClient.del(lockKey);
                    await redisClient.del(redisIdempKey);
                    res.status(404).json({ message: 'Ticket type not found' });
                    return;
                }

                const soldOrReserved = await prisma.tickets.count({
                    where: { ticket_type_id: ticketTypeId, status: { in: ['RESERVED', 'SOLD', 'CHECKED_IN'] } }
                });
                const remaining = tt.total_quantity - soldOrReserved;

                if (remaining < qty) {
                    await redisClient.set(remainingKey, remaining); // Set anyway so future requests get -2
                    await redisClient.del(lockKey);
                    await redisClient.set(redisIdempKey, JSON.stringify({ status: 'FAILED' }), 'EX', 300);
                    res.status(400).json({ message: 'Ticket type is sold out' });
                    return;
                }

                // Initialize Redis and deduct qty
                remainingAfterDecr = remaining - qty;
                const setSuccess = await redisClient.set(remainingKey, remainingAfterDecr);
                if (setSuccess) redisDecremented = true;
                await redisClient.del(lockKey);
            } else {
                // Lock FAIL: Fail-forward gracefully
                const tt = await prisma.ticket_types.findUnique({ where: { id: ticketTypeId } });
                if (!tt) {
                    await redisClient.del(redisIdempKey);
                    res.status(404).json({ message: 'Ticket type not found' });
                    return;
                }

                const soldOrReserved = await prisma.tickets.count({
                    where: { ticket_type_id: ticketTypeId, status: { in: ['RESERVED', 'SOLD', 'CHECKED_IN'] } }
                });
                const remaining = tt.total_quantity - soldOrReserved;

                if (remaining < qty) {
                    await redisClient.set(redisIdempKey, JSON.stringify({ status: 'FAILED' }), 'EX', 300);
                    res.status(400).json({ message: 'Ticket type is sold out (DB Check)' });
                    return;
                }
                // Proceed to DB transaction without touching Redis
            }
        } else if (remainingAfterDecr === -2) {
            await redisClient.set(redisIdempKey, JSON.stringify({ status: 'FAILED' }), 'EX', 300);
            res.status(400).json({ message: 'Ticket type is sold out (Redis Pre-check)' });
            return;
        } else if (remainingAfterDecr >= 0) {
            redisDecremented = true;
        }

        // 3. Database Transaction
        try {
            const result = await prisma.$transaction(async (tx) => {
                // Lock exact tickets and enforce cross-zone validation
                const tickets: { id: string, status: string }[] = await tx.$queryRaw`
                    SELECT id, status FROM tickets
                    WHERE id::text IN (${Prisma.join(ticketIds)})
                      AND ticket_type_id = ${ticketTypeId}::uuid
                    FOR UPDATE SKIP LOCKED
                `;

                if (tickets.length !== qty) {
                    throw new Error('Some tickets are already taken or invalid');
                }

                const unavailable = tickets.some(t => t.status !== 'AVAILABLE');
                if (unavailable) {
                    throw new Error('Some tickets are no longer available');
                }

                // Get ticket snapshot info for history
                const ticketsInfo = await tx.$queryRaw`
                    SELECT t.seat_label, tt.name as type_name, tt.price, c.name as concert_name
                    FROM tickets t
                    JOIN ticket_types tt ON t.ticket_type_id = tt.id
                    JOIN concerts c ON tt.concert_id = c.id
                    WHERE t.id::text IN (${Prisma.join(ticketIds)})
                `;

                // Create Order
                const order = await tx.orders.create({
                    data: {
                        user_id: userId!,
                        status: 'PENDING',
                        idempotency_key: idempotencyKey!,
                        ticket_snapshot: ticketsInfo as any // keep as any just to be absolutely safe
                    }
                });

                // Update Tickets
                await tx.tickets.updateMany({
                    where: { id: { in: ticketIds } },
                    data: {
                        status: 'RESERVED',
                        user_id: userId!,
                        order_id: order.id
                    }
                });

                return order;
            });

            const ticketTypeInfo = await prisma.ticket_types.findUnique({ where: { id: ticketTypeId } });
            const totalAmount = (ticketTypeInfo?.price ? Number(ticketTypeInfo.price) : 0) * qty;

            let paymentUrl = '';
            try {
                // Gọi Circuit Breaker để sinh URL thanh toán thực sự
                paymentUrl = await paymentCircuitBreaker.fire(result.id, totalAmount) as string;
            } catch (circuitError: any) {
                // Nếu Fire thất bại (vd: random 20% fail hoặc Circuit Open ngay lúc này)
                logger.warn({ msg: circuitError.message }, 'Payment gateway timeout/error');
                // Vẫn cho phép tạo đơn (vì vé đã khóa), user có thể Retry thanh toán từ Dashboard
            }

            const responseData = { orderId: result.id, ticketTypeId, quantity: qty, paymentUrl };

            await redisClient.set(redisIdempKey, JSON.stringify({ status: 'SUCCESS', data: responseData }), 'EX', 86400); // 24h

            await taskQueue.add(
                'cancel-expired-order',
                { orderId: result.id },
                {
                    delay: 15 * 60 * 1000,
                    removeOnComplete: { count: 500, age: 3600 },
                    removeOnFail: { count: 1000 }
                }
            );

            // SSE: Notify map viewers
            await redisClient.publish('seat_updates', JSON.stringify({
                ticketTypeId,
                ticketIds,
                status: 'RESERVED'
            }));
            await redisClient.del(`zone_tickets:${ticketTypeId}`); // Clear cache for new viewers

            res.status(201).json({ message: 'Order created successfully', data: responseData });

        } catch (dbError: any) {
            if (redisDecremented) {
                await redisClient.incrby(remainingKey, qty); // rollback Redis pre-check
            }
            await redisClient.set(redisIdempKey, JSON.stringify({ status: 'FAILED' }), 'EX', 300);
            let errorMessage = dbError.message;
            if (errorMessage.includes('Some tickets are already taken')) {
                errorMessage = 'Ghế bạn chọn vừa bị người khác mua mất. Vui lòng chọn ghế khác nhé!';
            } else if (errorMessage.includes('no longer available')) {
                errorMessage = 'Ghế này không còn trống. Vui lòng tải lại trang.';
            } else if (errorMessage.includes('maximum allowed tickets')) {
                errorMessage = 'Bạn đã vượt quá số lượng vé tối đa cho phép mua của hạng vé này!';
            } else {
                errorMessage = 'Hệ thống đang bận hoặc có lỗi cơ sở dữ liệu. Vui lòng thử lại sau.';
            }

            logger.error({ error: dbError }, 'Transaction Error');
            res.status(400).json({ message: errorMessage });
        }

    } catch (error) {
        logger.error({ error }, 'Create Order Error');
        await redisClient.del(redisIdempKey); // allow retry
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getMyTickets = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        const orders = await prisma.orders.findMany({
            where: { user_id: userId },
            include: {
                tickets: {
                    include: {
                        ticket_types: {
                            include: {
                                concerts: true
                            }
                        }
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        logger.error({ error }, 'Error fetching my tickets');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        const order = await prisma.orders.findFirst({
            where: { id: id as string, user_id: userId },
            include: {
                tickets: {
                    include: {
                        ticket_types: {
                            include: {
                                concerts: true
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        res.json(order);
    } catch (error) {
        logger.error({ error }, 'Error fetching order by id');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// SSE Endpoint for tracking payment status
export const streamOrderStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial connection successful event
    res.write(`data: ${JSON.stringify({ message: 'Connected to payment stream' })}\n\n`);

    // Ensure the singleton Redis subscriber is running
    ensurePaymentSubscriber();

    const handleUpdate = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (data.status === 'SUCCESS' || data.status === 'FAILED') {
            paymentEventEmitter.off(`payment_update:${id}`, handleUpdate);
            res.end();
        }
    };

    // Listen to local event emitter instead of directly to Redis
    paymentEventEmitter.on(`payment_update:${id}`, handleUpdate);

    // Cleanup when client disconnects
    req.on('close', () => {
        paymentEventEmitter.off(`payment_update:${id}`, handleUpdate);
    });
};

