import { Request, Response } from 'express';
import prisma from '../config/db';
import redisClient from '../config/redis';

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

        // Calculate remaining tickets for each type
        const ticketTypesWithRemaining = await Promise.all(
            (concert as any).ticket_types.map(async (type: any) => {
                const soldOrReservedCount = await prisma.tickets.count({
                    where: {
                        ticket_type_id: type.id,
                        status: { in: ['RESERVED', 'SOLD', 'CHECKED_IN'] }
                    }
                });
                return {
                    ...type,
                    remaining_quantity: type.total_quantity - soldOrReservedCount
                };
            })
        );

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

        // Set Cache TTL 5 seconds (realtime-ish)
        await redisClient.set(CACHE_KEY, JSON.stringify(tickets), 'EX', 5);

        res.json(tickets);
    } catch (error) {
        console.error('Error fetching zone tickets:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
