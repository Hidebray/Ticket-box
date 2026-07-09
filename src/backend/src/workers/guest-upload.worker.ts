import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../config/worker.db';
import redisClient from '../config/redis';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import NotificationService, { TicketDetail } from '../services/notification.service';
import logger from '../utils/logger';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null
});

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

    // Lọc trùng lặp email bên trong file CSV
    const uniqueGuestsMap = new Map();
    for (const row of guests) {
        const email = getRowValue(row, ['email']);
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            if (!uniqueGuestsMap.has(email.trim().toLowerCase())) {
                uniqueGuestsMap.set(email.trim().toLowerCase(), row);
            }
        }
    }

    const uniqueGuests = Array.from(uniqueGuestsMap.values());

    for (let i = 0; i < uniqueGuests.length; i++) {
        const row = uniqueGuests[i];
        const email = getRowValue(row, ['email'])?.trim().toLowerCase();
        const name = getRowValue(row, ['name', 'fullname', 'full name']) || 'Khách mời VIP';

        try {
            await prisma.$transaction(async (tx: any) => {
                // Kiểm tra xem email này đã từng được mời ở sự kiện này chưa
                // Dùng seat_label để chứa email nhằm mục đích chống trùng
                const existingInvite = await tx.tickets.findFirst({
                    where: {
                        ticket_type_id: ticketTypeId,
                        seat_label: email
                    }
                });

                if (existingInvite) {
                    throw new Error('Email này đã được gửi thư mời từ trước.');
                }

                // 1. Tăng số lượng thư mời (total_quantity) lên 1 để vượt qua Trigger Database (chống overbook)
                await tx.ticket_types.update({
                    where: { id: ticketTypeId },
                    data: { total_quantity: { increment: 1 } }
                });

                // 2. Lưu lại đánh dấu đã mời vào bảng tickets (KHÔNG tạo user, KHÔNG tạo order)
                await tx.tickets.create({
                    data: {
                        ticket_type_id: ticketTypeId,
                        seat_label: email,
                        status: 'SOLD',
                        qr_code: crypto.randomUUID() // Vẫn cần qr_code để pass schema ràng buộc unique
                    }
                });
            });

            // Gửi thư mời VIP chuyên biệt (Không có QR check-in)
            await NotificationService.notifyVIPInvitation(email, name, concert.name, concert.start_time);

            successCount++;
        } catch (error: any) {
            logger.error({ err: error, email }, 'Error processing guest');
            let friendlyError = 'Lỗi hệ thống khi đánh dấu thư mời.';
            if (error.message && error.message.includes('Email này đã được gửi thư mời')) {
                friendlyError = 'Email này đã được gửi thư mời từ đợt trước.';
            } else if (error.message && error.message.includes('sold out')) {
                friendlyError = 'Không thể khởi tạo số lượng thư mời trong hệ thống.';
            }
            errors.push({ email, reason: friendlyError });
        }

        // Cập nhật progress cho Job (0 - 100%)
        const progress = Math.floor(((i + 1) / uniqueGuests.length) * 100);
        await job.updateProgress(progress);
    }

    // (Đã được cộng dồn từng vé một ở bên trong transaction phía trên)

    return { successCount, errors };
}, { connection: connection as any, concurrency: 10 });

guestUploadWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, successCount: job.returnvalue.successCount }, '[BullMQ] Job completed');
});

guestUploadWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[BullMQ] Job failed');
});
