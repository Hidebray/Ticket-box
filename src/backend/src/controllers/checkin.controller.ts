import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../utils/logger';
import { z } from 'zod';

export const syncDown = async (req: Request, res: Response): Promise<void> => {
    try {
        const { concertId } = req.query;

        const uuidSchema = z.string().uuid();
        const validation = uuidSchema.safeParse(concertId);

        if (!validation.success) {
            res.status(400).json({ message: 'Missing or invalid concertId format' });
            return;
        }

        const tickets = await prisma.tickets.findMany({
            where: {
                ticket_types: {
                    concert_id: validation.data
                },
                status: {
                    in: ['SOLD', 'CHECKED_IN'] // Allow STAFF to download all valid tickets
                }
            },
            select: {
                id: true,
                qr_code: true,
                status: true,
                scanned_at: true
            }
        });

        res.json({
            message: 'Sync down success',
            data: tickets
        });
    } catch (error) {
        logger.error({ error }, 'Sync Down Error');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const countTickets = async (req: Request, res: Response): Promise<void> => {
    try {
        const { concertId } = req.query;

        const uuidSchema = z.string().uuid();
        const validation = uuidSchema.safeParse(concertId);

        if (!validation.success) {
            res.status(400).json({ message: 'Missing or invalid concertId format' });
            return;
        }

        const count = await prisma.tickets.count({
            where: {
                ticket_types: {
                    concert_id: validation.data
                },
                status: {
                    in: ['SOLD', 'CHECKED_IN']
                }
            }
        });

        res.json({ count });
    } catch (error) {
        logger.error({ error }, 'Count Tickets Error');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const syncUp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { scannedTickets } = req.body; 

        if (!Array.isArray(scannedTickets)) {
            res.status(400).json({ message: 'Invalid payload, expected array of scannedTickets' });
            return;
        }

        const results = [];

        for (const item of scannedTickets) {
            const { ticketId, scannedAt } = item;
            
            if (!ticketId || !scannedAt) {
                results.push({ ticketId: ticketId || 'unknown', status: 'INVALID_DATA' });
                continue;
            }

            const mobileScannedTime = new Date(scannedAt);

            const dbTicket = await prisma.tickets.findUnique({
                where: { id: ticketId }
            });

            if (!dbTicket) {
                results.push({ ticketId, status: 'NOT_FOUND' });
                continue;
            }

            if (dbTicket.status === 'SOLD') {
                // First time scan logic - ATOMIC UPDATE
                const updateResult = await prisma.tickets.updateMany({
                    where: { id: ticketId, status: 'SOLD' },
                    data: {
                        status: 'CHECKED_IN',
                        scanned_at: mobileScannedTime
                    }
                });

                if (updateResult.count === 1) {
                    results.push({ ticketId, status: 'SUCCESS' });
                } else {
                    results.push({ ticketId, status: 'DUPLICATE_REJECTED' });
                }
            } else if (dbTicket.status === 'CHECKED_IN') {
                // Conflict resolution: First-Write-Wins based on scanned_at
                const dbScannedTime = dbTicket.scanned_at;
                
                if (!dbScannedTime || mobileScannedTime < dbScannedTime) {
                    // Mobile device actually scanned earlier, update DB to reflect reality - ATOMIC UPDATE
                    const updateResult = await prisma.tickets.updateMany({
                        where: { 
                            id: ticketId, 
                            status: 'CHECKED_IN', 
                            OR: [
                                { scanned_at: null },
                                { scanned_at: { gt: mobileScannedTime } }
                            ]
                        },
                        data: {
                            scanned_at: mobileScannedTime
                        }
                    });

                    if (updateResult.count === 1) {
                        results.push({ ticketId, status: 'SUCCESS_OVERWRITTEN' });
                    } else {
                        results.push({ ticketId, status: 'DUPLICATE_REJECTED' });
                    }
                } else {
                    // DB has earlier timestamp -> The current mobile device scan is a duplicate/fraud
                    results.push({ ticketId, status: 'DUPLICATE_REJECTED' });
                }
            } else {
                results.push({ ticketId, status: 'INVALID_STATUS' });
            }
        }

        res.json({
            message: 'Sync up complete',
            results
        });

    } catch (error) {
        logger.error({ error }, 'Sync Up Error');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
