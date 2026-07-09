import fs from 'fs';
import csv from 'csv-parser';
import prisma from '../config/worker.db';
import redisClient from '../config/redis';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import logger from '../utils/logger';
export const importVipGuests = async (filePath: string, concertId: string, ticketTypeId: string) => {
    logger.info({ concertId }, '[CSV Stream] Starting import for concert');
    
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
                logger.info('[CSV Stream] Finished import.');
                resolve(true);
            })
            .on('error', (err) => {
                logger.error({ err }, '[CSV Stream] Error reading CSV');
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
                        password: await bcrypt.hash(crypto.randomUUID(), 10), // Secure random hash
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

        logger.info({ count: rows.length }, '[CSV Stream] Processed batch of VIPs and synced Redis');
    } catch (err) {
        logger.error({ err }, '[CSV Stream] Error processing batch');
    }
};
