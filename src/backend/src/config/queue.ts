import { Queue, Worker, Job } from 'bullmq';
import prisma from './db';
import redisClient from './redis';
import crypto from 'crypto';
import NotificationService, { TicketDetail } from '../services/notification.service';

// Setup Redis connection for BullMQ
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
};

// Define Queue
export const guestUploadQueue = new Queue('guest-upload-queue', { connection });

// Helper to get row value case-insensitively
const getRowValue = (row: any, keys: string[]) => {
    for (const key of keys) {
        const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey) return row[foundKey];
    }
    return undefined;
};

// Define Worker
export const guestUploadWorker = new Worker('guest-upload-queue', async (job: Job) => {
    const { guests, concertId, ticketTypeId } = job.data;
    const errors: any[] = [];
    let successCount = 0;
    let totalTicketsCreated = 0;

    if (!Array.isArray(guests) || guests.length === 0) {
        throw new Error('Danh sách khách mời trống hoặc không hợp lệ.');
    }

    // 1. Validate structure of the first row (Check if email column exists)
    const firstRow = guests[0];
    const emailHeader = Object.keys(firstRow).find(k => k.toLowerCase() === 'email');
    if (!emailHeader) {
        throw new Error('Cấu trúc file CSV không hợp lệ: Thiếu cột "email".');
    }

    // Load concert info to show in confirmation email
    const concert = await prisma.concerts.findUnique({
        where: { id: concertId }
    });
    if (!concert) {
        throw new Error(`Concert với ID ${concertId} không tồn tại.`);
    }

    for (let i = 0; i < guests.length; i++) {
        const row = guests[i];
        const email = getRowValue(row, ['email']);
        const name = getRowValue(row, ['name', 'fullname', 'full name']) || 'Khách mời VIP';
        
        let qty = 1;
        const qtyVal = getRowValue(row, ['quantity', 'qty', 'soluong', 'so luong']);
        if (qtyVal) {
            const parsedQty = parseInt(qtyVal, 10);
            if (!isNaN(parsedQty) && parsedQty > 0) {
                qty = parsedQty;
            }
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.push({ 
                email: email || `Dòng ${i + 2}`, 
                reason: 'Email không hợp lệ hoặc bị trống.' 
            });
            continue;
        }

        try {
            const ticketDetails: TicketDetail[] = [];

            await prisma.$transaction(async (tx: any) => {
                // 1. Tìm hoặc tạo user (Role AUDIENCE mặc định)
                let user = await tx.users.findUnique({ where: { email: email.trim() } });
                if (!user) {
                    user = await tx.users.create({
                        data: {
                            email: email.trim(),
                            password: '$2b$10$6cRyhlDW0tm3mlUvSZuPp.W795zf0DA.WDevg6hyTN37P4lL51QTe', // default pass: 123456
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

                // 3. Tạo tickets
                for (let q = 0; q < qty; q++) {
                    const ticket = await tx.tickets.create({
                        data: {
                            ticket_type_id: ticketTypeId,
                            order_id: order.id,
                            user_id: user.id,
                            qr_code: crypto.randomUUID(),
                            status: 'SOLD' // Sẵn sàng để check-in
                        }
                    });

                    ticketDetails.push({
                        id: ticket.id,
                        seatLabel: ticket.seat_label,
                        price: 0, // Khách mời giá 0
                        concertName: concert.name,
                        startTime: concert.start_time
                    });
                }
            });

            // Gửi email xác nhận
            await NotificationService.notifyTicketConfirmation(email.trim(), ticketDetails);

            successCount += qty;
            totalTicketsCreated += qty;
        } catch (error: any) {
            console.error(`Error processing guest ${email}:`, error);
            errors.push({ email, reason: error.message || 'Lỗi cơ sở dữ liệu khi cấp vé.' });
        }

        // Cập nhật progress cho Job (0 - 100%)
        const progress = Math.floor(((i + 1) / guests.length) * 100);
        await job.updateProgress(progress);
    }

    // 4. Cập nhật số lượng vé còn lại trong Redis cache
    if (totalTicketsCreated > 0) {
        const remainingKey = `ticket_remaining:${ticketTypeId}`;
        const exists = await redisClient.exists(remainingKey);
        if (exists) {
            await redisClient.decrby(remainingKey, totalTicketsCreated);
        }
    }

    return { successCount, errors };
}, { connection });

guestUploadWorker.on('completed', (job) => {
    console.log(`[BullMQ] Job ${job.id} completed. Processed: ${job.returnvalue.successCount}`);
});

guestUploadWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed:`, err);
});

