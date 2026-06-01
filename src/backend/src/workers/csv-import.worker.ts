import fs from 'fs';
import csv from 'csv-parser';
import prisma from '../config/db';
import redisClient from '../config/redis';
import crypto from 'crypto';

export const importVipGuests = async (filePath: string, concertId: string, ticketTypeId: string) => {
    console.log(`[CSV Stream] Starting import for concert ${concertId}`);
    
    const BATCH_SIZE = 100;
    let batch: any[] = [];

    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', async (row) => {
                batch.push(row);
                if (batch.length >= BATCH_SIZE) {
                    stream.pause(); // Pause stream to not overflow RAM
                    const currentBatch = [...batch];
                    batch = [];
                    await processBatch(currentBatch, ticketTypeId);
                    stream.resume(); // Resume stream
                }
            })
            .on('end', async () => {
                if (batch.length > 0) {
                    await processBatch(batch, ticketTypeId);
                }
                console.log(`[CSV Stream] Finished import.`);
                resolve(true);
            })
            .on('error', (err) => {
                console.error('[CSV Stream] Error reading CSV:', err);
                reject(err);
            });
    });
};

const processBatch = async (rows: any[], ticketTypeId: string) => {
    try {
        await prisma.$transaction(async (tx: any) => {
            for (const row of rows) {
                // Upsert User
                const user = await tx.users.upsert({
                    where: { email: row.email },
                    update: {},
                    create: {
                        email: row.email,
                        password: 'default_vip_password', // Mock hash
                        role: 'AUDIENCE'
                    }
                });

                // Create Ticket
                await tx.tickets.create({
                    data: {
                        ticket_type_id: ticketTypeId,
                        user_id: user.id,
                        qr_code: crypto.randomUUID(),
                        status: 'SOLD' // Valid ticket
                    }
                });
            }
        });

        // Tối quan trọng: Trừ đồng bộ vào Redis Cache để không bị sai lệch số liệu vé còn lại
        const remainingKey = `ticket_remaining:${ticketTypeId}`;
        // Nếu key tồn tại, ta trừ đi số vé vừa phát
        const exists = await redisClient.exists(remainingKey);
        if (exists) {
            await redisClient.decrby(remainingKey, rows.length);
        }

        console.log(`[CSV Stream] Processed batch of ${rows.length} VIPs and synced Redis`);
    } catch (err) {
        console.error('[CSV Stream] Error processing batch:', err);
    }
};
