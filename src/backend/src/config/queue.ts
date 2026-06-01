import { Queue, Worker, Job } from 'bullmq';
import prisma from './db';
import crypto from 'crypto';

// Setup Redis connection for BullMQ
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
};

// Define Queue
export const guestUploadQueue = new Queue('guest-upload-queue', { connection });

// Define Worker
export const guestUploadWorker = new Worker('guest-upload-queue', async (job: Job) => {
    const { guests, concertId, ticketTypeId } = job.data;
    const errors: any[] = [];
    let successCount = 0;

    for (let i = 0; i < guests.length; i++) {
        const email = guests[i].email;
        if (!email) continue;

        try {
            await prisma.$transaction(async (tx) => {
                // 1. Tìm hoặc tạo user (Role AUDIENCE mặc định)
                let user = await tx.users.findUnique({ where: { email } });
                if (!user) {
                    user = await tx.users.create({
                        data: {
                            email,
                            password: 'guest-password-placeholder', // Mock pass cho khách
                            role: 'AUDIENCE'
                        }
                    });
                }

                // 2. Tạo Order cho khách (trạng thái SUCCESS vì là khách mời)
                const order = await tx.orders.create({
                    data: {
                        user_id: user.id,
                        status: 'SUCCESS',
                        idempotency_key: crypto.randomUUID()
                    }
                });

                // 3. Tạo Ticket
                await tx.tickets.create({
                    data: {
                        ticket_type_id: ticketTypeId,
                        order_id: order.id,
                        user_id: user.id,
                        qr_code: crypto.randomUUID(),
                        status: 'AVAILABLE' // Sẵn sàng để check-in
                    }
                });
            });

            successCount++;
        } catch (error: any) {
            console.error(`Error processing guest ${email}:`, error);
            errors.push({ email, reason: error.message });
        }

        // Cập nhật progress cho Job (0 - 100%)
        const progress = Math.floor(((i + 1) / guests.length) * 100);
        await job.updateProgress(progress);
    }

    return { successCount, errors };
}, { connection });

guestUploadWorker.on('completed', (job) => {
    console.log(`[BullMQ] Job ${job.id} completed. Processed: ${job.returnvalue.successCount}`);
});

guestUploadWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed:`, err);
});
