import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';
import redisClient from '../config/redis';
import { taskQueue } from '../queue';
import { paymentCircuitBreaker } from '../services/payment.service';
import { Prisma } from '@prisma/client';
import { EventEmitter } from 'events';

// --- Singleton Redis Subscriber for SSE ---
export const paymentEventEmitter = new EventEmitter();
paymentEventEmitter.setMaxListeners(0); // Allow many concurrent users

let isSubscribed = false;
const ensurePaymentSubscriber = () => {
    if (isSubscribed) return;
    isSubscribed = true;
    const subscriber = redisClient.duplicate();
    subscriber.subscribe('payment_updates', (err) => {
        if (err) {
            console.error('Redis subscribe error:', err);
            isSubscribed = false;
        }
    });

    subscriber.on('message', (channel, message) => {
        if (channel === 'payment_updates') {
            try {
                const data = JSON.parse(message);
                if (data.orderId) {
                    paymentEventEmitter.emit(`payment_update:${data.orderId}`, data);
                }
            } catch (err) {
                console.error('SSE Message parsing error:', err);
            }
        }
    });
};
// ------------------------------------------

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

    try {
        // 1. Initialize Redis Pre-check if not exists
        const exists = await redisClient.exists(remainingKey);
        if (!exists) {
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
            
            await redisClient.setnx(remainingKey, remaining);
        }

        // 2. Pre-check: Atomic DECR
        const remainingAfterDecr = await redisClient.decrby(remainingKey, qty);

        if (remainingAfterDecr < 0) {
            await redisClient.incrby(remainingKey, qty);
            await redisClient.set(redisIdempKey, JSON.stringify({ status: 'FAILED' }), 'EX', 300);
            res.status(400).json({ message: 'Ticket type is sold out (Redis Pre-check)' });
            return;
        }

        // 3. Database Transaction
        try {
            const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                // Lock exact tickets
                const tickets: { id: string, status: string }[] = await tx.$queryRaw`
                    SELECT id, status FROM tickets
                    WHERE id::text IN (${Prisma.join(ticketIds)})
                    FOR UPDATE SKIP LOCKED
                `;

                if (tickets.length !== qty) {
                    throw new Error('Some tickets are already taken or invalid');
                }

                const unavailable = tickets.some(t => t.status !== 'AVAILABLE');
                if (unavailable) {
                    throw new Error('Some tickets are no longer available');
                }

                // Create Order
                const order = await tx.orders.create({
                    data: {
                        user_id: userId!,
                        status: 'PENDING',
                        idempotency_key: idempotencyKey!
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

            const ticketTypeInfo = await prisma.ticket_types.findUnique({ where: { id: ticketTypeId }});
            const totalAmount = (ticketTypeInfo?.price ? Number(ticketTypeInfo.price) : 0) * qty;
            
            let paymentUrl = '';
            try {
                // Gọi Circuit Breaker để sinh URL thanh toán thực sự
                paymentUrl = await paymentCircuitBreaker.fire(result.id, totalAmount) as string;
            } catch (circuitError: any) {
                // Nếu Fire thất bại (vd: random 20% fail hoặc Circuit Open ngay lúc này)
                console.warn('Payment gateway timeout/error:', circuitError.message);
                // Vẫn cho phép tạo đơn (vì vé đã khóa), user có thể Retry thanh toán từ Dashboard
            }

            const responseData = { orderId: result.id, ticketTypeId, quantity: qty, paymentUrl };
            
            await redisClient.set(redisIdempKey, JSON.stringify({ status: 'SUCCESS', data: responseData }), 'EX', 86400); // 24h
            
            // Push Delayed Job để hủy đơn hàng sau 15 phút nếu chưa thanh toán
            await taskQueue.add('cancel-expired-order', { orderId: result.id }, { delay: 15 * 60 * 1000 });
            
            // SSE: Notify map viewers
            await redisClient.publish('seat_updates', JSON.stringify({
                ticketTypeId,
                ticketIds,
                status: 'RESERVED'
            }));
            await redisClient.del(`zone_tickets:${ticketTypeId}`); // Clear cache for new viewers
            
            res.status(201).json({ message: 'Order created successfully', data: responseData });

        } catch (dbError: any) {
            await redisClient.incrby(remainingKey, qty); // rollback Redis pre-check
            await redisClient.set(redisIdempKey, JSON.stringify({ status: 'FAILED' }), 'EX', 300);
            
            console.error('Transaction Error:', dbError.message);
            res.status(400).json({ message: 'Failed to complete order. Tickets might be taken.' });
        }

    } catch (error) {
        console.error('Create Order Error:', error);
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
        console.error('Error fetching my tickets:', error);
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
        console.error('Error fetching order by id:', error);
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

