import { Request, Response } from 'express';
import prisma from '../config/db';

export const syncDown = async (req: Request, res: Response): Promise<void> => {
    try {
        const { concertId } = req.query;

        if (!concertId || typeof concertId !== 'string') {
            res.status(400).json({ message: 'Missing or invalid concertId' });
            return;
        }

        const tickets = await prisma.tickets.findMany({
            where: {
                ticket_types: {
                    concert_id: concertId
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
        console.error('Sync Down Error:', error);
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
                // First time scan logic
                await prisma.tickets.update({
                    where: { id: ticketId },
                    data: {
                        status: 'CHECKED_IN',
                        scanned_at: mobileScannedTime
                    }
                });
                results.push({ ticketId, status: 'SUCCESS' });
            } else if (dbTicket.status === 'CHECKED_IN') {
                // Conflict resolution: First-Write-Wins based on scanned_at
                const dbScannedTime = dbTicket.scanned_at;
                
                if (!dbScannedTime || mobileScannedTime < dbScannedTime) {
                    // Mobile device actually scanned earlier, update DB to reflect reality
                    await prisma.tickets.update({
                        where: { id: ticketId },
                        data: {
                            scanned_at: mobileScannedTime
                        }
                    });
                    results.push({ ticketId, status: 'SUCCESS_OVERWRITTEN' });
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
        console.error('Sync Up Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
