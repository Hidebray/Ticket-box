import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';
import redisClient from '../config/redis';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
    const idempotencyKey = (req as any).idempotencyKey;
    const redisIdempKey = `idempotency:${idempotencyKey}`;
    const userId = req.user?.id;
    const { ticketTypeId, ticketIds } = req.body;

    if (!userId || !ticketTypeId || !Array.isArray(ticketIds) || ticketIds.length === 0) {
        await redisClient.del(redisIdempKey); // allow retry
        res.status(400).json({ message: 'Invalid input' });
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
            const result = await prisma.$transaction(async (tx: any) => {
                // Lock exact tickets
                // Note: Prisma string interpolation in raw query
                const tickets: any[] = await tx.$queryRawUnsafe(`
                    SELECT id, status FROM tickets
                    WHERE id IN (${ticketIds.map((id: string) => `'${id}'`).join(',')})
                    FOR UPDATE SKIP LOCKED
                `);

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
                        user_id: userId,
                        status: 'PENDING',
                        idempotency_key: idempotencyKey
                    }
                });

                // Update Tickets
                await tx.tickets.updateMany({
                    where: { id: { in: ticketIds } },
                    data: {
                        status: 'RESERVED',
                        user_id: userId,
                        order_id: order.id
                    }
                });

                return order;
            });

            const responseData = { orderId: result.id, ticketTypeId, quantity: qty };
            
            await redisClient.set(redisIdempKey, JSON.stringify({ status: 'SUCCESS', data: responseData }), 'EX', 86400); // 24h
            
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
                tickets: true
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
