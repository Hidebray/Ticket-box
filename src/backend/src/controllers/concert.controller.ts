import { Request, Response } from 'express';
import prisma from '../config/db';
import redisClient from '../config/redis';
import { EventEmitter } from 'events';

// --- Singleton Redis Subscriber for Seat SSE ---
export const seatEventEmitter = new EventEmitter();
seatEventEmitter.setMaxListeners(0); // Allow many concurrent users

let isSeatSubscribed = false;
export const ensureSeatSubscriber = () => {
    if (isSeatSubscribed) return;
    isSeatSubscribed = true;
    const subscriber = redisClient.duplicate();
    subscriber.subscribe('seat_updates', (err) => {
        if (err) {
            console.error('Redis subscribe error for seats:', err);
            isSeatSubscribed = false;
        }
    });

    subscriber.on('message', (channel, message) => {
        if (channel === 'seat_updates') {
            try {
                const data = JSON.parse(message);
                if (data.ticketTypeId) {
                    seatEventEmitter.emit(`seat_update:${data.ticketTypeId}`, data);
                }
            } catch (err) {
                console.error('SSE Message parsing error:', err);
            }
        }
    });
};
// -----------------------------------------------

export const getConcerts = async (req: Request, res: Response): Promise<void> => {
    try {
        const CACHE_KEY = 'concerts:list';
        
        // 1. Check Redis Cache
        const cachedData = await redisClient.get(CACHE_KEY);
        if (cachedData) {
            res.json(JSON.parse(cachedData));
            return;
        }

        // 2. Cache Miss: Query Database
        const concerts = await prisma.concerts.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { start_time: 'asc' },
            select: {
                id: true,
                name: true,
                start_time: true,
                status: true,
                created_at: true
            }
        });

        // 3. Set Cache with TTL (60 seconds)
        await redisClient.set(CACHE_KEY, JSON.stringify(concerts), 'EX', 60);

        res.json(concerts);
    } catch (error) {
        console.error('Error fetching concerts:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getConcertDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const CACHE_KEY = `concerts:detail:${id}`;

        // 1. Check Redis Cache
        const cachedData = await redisClient.get(CACHE_KEY);
        if (cachedData) {
            res.json(JSON.parse(cachedData));
            return;
        }

        // 2. Cache Miss: Query DB for Concert & Ticket Types
        const concert = await prisma.concerts.findUnique({
            where: { id: id as string },
            include: {
                ticket_types: {
                    orderBy: { price: 'desc' }
                }
            }
        });

        if (!concert || concert.status !== 'PUBLISHED') {
            res.status(404).json({ message: 'Concert not found or not published' });
            return;
        }

        // [STB-03] Fix N+1: 1 query GROUP BY thay vì N queries riêng lẻ
        const typeIds = concert.ticket_types.map(t => t.id);
        const soldCounts = await prisma.tickets.groupBy({
            by: ['ticket_type_id'],
            where: {
                ticket_type_id: { in: typeIds },
                status: { in: ['RESERVED', 'SOLD', 'CHECKED_IN'] }
            },
            _count: { id: true }
        });

        const soldCountMap = new Map(soldCounts.map(r => [r.ticket_type_id, r._count.id]));

        const ticketTypesWithRemaining = concert.ticket_types.map(type => ({
            ...type,
            remaining_quantity: type.total_quantity - (soldCountMap.get(type.id) ?? 0)
        }));

        const concertData = {
            ...concert,
            ticket_types: ticketTypesWithRemaining
        };

        // 3. Set Cache with short TTL (10 seconds) to handle high concurrency F5
        await redisClient.set(CACHE_KEY, JSON.stringify(concertData), 'EX', 10);

        res.json(concertData);
    } catch (error) {
        console.error('Error fetching concert details:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const getZoneTickets = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const ticketTypeId = req.params.ticketTypeId as string;
        const CACHE_KEY = `zone_tickets:${ticketTypeId}`;

        // Short caching for high concurrency map viewing
        const cachedData = await redisClient.get(CACHE_KEY);
        if (cachedData) {
            res.json(JSON.parse(cachedData));
            return;
        }

        const tickets = await prisma.tickets.findMany({
            where: { ticket_type_id: ticketTypeId },
            select: {
                id: true,
                seat_label: true,
                status: true
            },
            orderBy: { seat_label: 'asc' } // Ensure some consistent ordering
        });

        // Check for any held tickets in Redis
        const holdKeys = tickets.map(t => `seat_hold:${t.id}`);
        if (holdKeys.length > 0) {
            const holdValues = await redisClient.mget(holdKeys);
            tickets.forEach((ticket, index) => {
                // If it's AVAILABLE in DB but someone is holding it in Redis
                if (ticket.status === 'AVAILABLE' && holdValues[index] !== null) {
                    ticket.status = 'HOLDING';
                }
            });
        }

        // Set Cache TTL 5 seconds (realtime-ish)
        await redisClient.set(CACHE_KEY, JSON.stringify(tickets), 'EX', 5);

        res.json(tickets);
    } catch (error) {
        console.error('Error fetching zone tickets:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const streamZoneTickets = async (req: Request, res: Response): Promise<void> => {
    const { ticketTypeId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ message: 'Connected to seat stream' })}\n\n`);

    ensureSeatSubscriber();

    const handleUpdate = (data: { ticketTypeId?: string, ticketIds?: string[], status?: string, message?: string }) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    seatEventEmitter.on(`seat_update:${ticketTypeId}`, handleUpdate);

    req.on('close', () => {
        seatEventEmitter.off(`seat_update:${ticketTypeId}`, handleUpdate);
    });
};

export const holdSeat = async (req: Request, res: Response): Promise<void> => {
    const { ticketTypeId, ticketId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        const ticket = await prisma.tickets.findUnique({
            where: { id: ticketId as string }
        });

        if (!ticket || ticket.status !== 'AVAILABLE') {
            res.status(400).json({ message: 'Seat is not available' });
            return;
        }

        const holdKey = `seat_hold:${ticketId}`;
        // SetNX returns 1 if key was set, 0 if it already exists
        const setNxResult = await redisClient.setnx(holdKey, userId);

        if (setNxResult === 1) {
            // Set expire time for 120 seconds
            await redisClient.expire(holdKey, 120);
            
            // Broadcast the hold event
            await redisClient.publish('seat_updates', JSON.stringify({
                ticketTypeId,
                ticketIds: [ticketId],
                status: 'HOLDING'
            }));
            await redisClient.del(`zone_tickets:${ticketTypeId}`); // Invalidate cache

            res.json({ message: 'Seat held successfully', ticketId });
        } else {
            // Someone else is already holding it
            res.status(409).json({ message: 'Seat is currently held by someone else' });
        }
    } catch (error) {
        console.error('Error holding seat:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const unholdSeat = async (req: Request, res: Response): Promise<void> => {
    const { ticketTypeId, ticketId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        const holdKey = `seat_hold:${ticketId}`;
        const currentHolder = await redisClient.get(holdKey);

        // Only allow the person holding it to unhold it
        if (currentHolder === userId) {
            await redisClient.del(holdKey);
            
            // Broadcast the unhold event (AVAILABLE)
            await redisClient.publish('seat_updates', JSON.stringify({
                ticketTypeId,
                ticketIds: [ticketId],
                status: 'AVAILABLE'
            }));
            await redisClient.del(`zone_tickets:${ticketTypeId}`); // Invalidate cache
            
            res.json({ message: 'Seat released successfully' });
        } else {
            res.status(403).json({ message: 'You are not holding this seat' });
        }
    } catch (error) {
        console.error('Error releasing seat:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
