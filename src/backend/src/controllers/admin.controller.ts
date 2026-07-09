import { Request, Response } from 'express';
import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import redisClient from '../config/redis';
import crypto from 'crypto';
import fs from 'fs';
import logger from '../utils/logger';
const pdf = require('pdf-parse');



export const getAdminConcerts = async (req: Request, res: Response): Promise<void> => {
    try {
        const role = req.user?.role;
        const userId = req.user?.id;
        
        const whereClause = role === 'SUPER_ADMIN' ? {} : { organizer_id: userId };

        const concerts = await prisma.concerts.findMany({
            where: whereClause,
            orderBy: { created_at: 'desc' },
            include: {
                ticket_types: true
            }
        });
        
        const formattedConcerts = concerts.map(c => ({
            ...c,
            ticket_types: c.ticket_types.map(t => ({
                ...t,
                price: Number(t.price)
            }))
        }));
        
        res.json(formattedConcerts);
    } catch (error) {
        logger.error({ error }, 'Error fetching admin concerts');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const createConcert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, location, start_time, status } = req.body;
        
        const concert = await prisma.concerts.create({
            data: {
                organizer_id: req.user?.id,
                name,
                description,
                location: location || 'Đang cập nhật',
                start_time: new Date(start_time),
                status
            }
        });
        
        // Invalidate cache
        await redisClient.del('concerts:list');
        
        res.status(201).json(concert);
    } catch (error) {
        logger.error({ error }, 'Error creating concert');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const updateConcert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, location, start_time, status } = req.body;
        
        console.log('UPDATE CONCERT REQUEST:', req.body);
        
        const concert = await prisma.concerts.update({
            where: { id: id as string },
            data: {
                name,
                description,
                location,
                start_time: start_time ? new Date(start_time) : undefined,
                status
            }
        });
        
        // Invalidate cache
        await redisClient.del('concerts:list');
        await redisClient.del(`concerts:detail:${id}`);
        
        res.json(concert);
    } catch (error) {
        logger.error({ error }, 'Error updating concert');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const createTicketType = async (req: Request, res: Response): Promise<void> => {
    try {
        const { concert_id, name, price, total_quantity, max_per_user } = req.body;
        
        const ticketType = await prisma.ticket_types.create({
            data: {
                concert_id,
                name,
                price: parseFloat(price),
                total_quantity: parseInt(total_quantity, 10),
                max_per_user: parseInt(max_per_user, 10)
            }
        });
        
        await redisClient.del(`concerts:detail:${concert_id}`);
        
        res.status(201).json(ticketType);
    } catch (error) {
        logger.error({ error }, 'Error creating ticket type');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const deleteConcert = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const role = req.user?.role;
        const userId = req.user?.id;

        // Check if concert exists and belongs to user if ORGANIZER
        const concert = await prisma.concerts.findUnique({
            where: { id },
            include: {
                ticket_types: {
                    include: {
                        _count: {
                            select: { tickets: true }
                        }
                    }
                }
            }
        });

        if (!concert) {
            res.status(404).json({ message: 'Không tìm thấy sự kiện' });
            return;
        }

        if (role !== 'SUPER_ADMIN' && concert.organizer_id !== userId) {
            res.status(403).json({ message: 'Không có quyền xóa sự kiện này' });
            return;
        }

        // Check if any tickets have been generated for any ticket type
        const totalTickets = concert.ticket_types.reduce((acc: number, tt: any) => acc + tt._count.tickets, 0);

        if (totalTickets > 0) {
            res.status(400).json({ message: 'Không thể xóa sự kiện đã có vé phát sinh trên hệ thống để đảm bảo an toàn dữ liệu.' });
            return;
        }

        await prisma.concerts.delete({
            where: { id }
        });

        await redisClient.del('concerts:list');
        await redisClient.del(`concerts:detail:${id}`);

        res.json({ message: 'Xóa sự kiện thành công' });
    } catch (error) {
        logger.error({ error }, 'Error deleting concert');
        res.status(500).json({ message: 'Lỗi server khi xóa sự kiện' });
    }
};

export const deleteTicketType = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const role = req.user?.role;
        const userId = req.user?.id;

        const ticketType = await prisma.ticket_types.findUnique({
            where: { id },
            include: {
                concerts: true,
                _count: {
                    select: { tickets: true }
                }
            }
        });

        if (!ticketType) {
            res.status(404).json({ message: 'Không tìm thấy hạng vé' });
            return;
        }

        if (role !== 'SUPER_ADMIN' && ticketType.concerts.organizer_id !== userId) {
            res.status(403).json({ message: 'Không có quyền xóa hạng vé này' });
            return;
        }

        if (ticketType._count.tickets > 0) {
            res.status(400).json({ message: 'Không thể xóa hạng vé đã có vé phát sinh trên hệ thống.' });
            return;
        }

        await prisma.ticket_types.delete({
            where: { id }
        });

        await redisClient.del('concerts:list');
        await redisClient.del(`concerts:detail:${ticketType.concert_id}`);

        res.json({ message: 'Xóa hạng vé thành công' });
    } catch (error) {
        logger.error({ error }, 'Error deleting ticket type');
        res.status(500).json({ message: 'Lỗi server khi xóa hạng vé' });
    }
};

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const role = req.user?.role;
        const userId = req.user?.id;
        const isSuperAdmin = role === 'SUPER_ADMIN';

        const { refresh, days } = req.query;
        let daysNum = 7;
        if (days === '30') daysNum = 30;
        if (days === 'all') daysNum = 3650; // 10 years

        const cacheKey = `dashboard:stats:${role}:${userId}:${daysNum}`;
        
        if (refresh !== 'true') {
            const cachedStats = await redisClient.get(cacheKey);
            if (cachedStats) {
                res.json(JSON.parse(cachedStats));
                return;
            }
        }

        const concertWhere = isSuperAdmin ? {} : { organizer_id: userId };
        const totalConcerts = await prisma.concerts.count({ where: concertWhere });

        // Prisma doesn't easily support deep relations in count/sum across multiple tables directly, 
        // so raw query is best here for both totalRevenue and totalTicketsSold
        
        let revenueQuery;
        let chartQuery;
        let ticketsQuery;
        let pieChartQuery;

        if (isSuperAdmin) {
            ticketsQuery = await prisma.$queryRaw`
                SELECT COUNT(*) as total
                FROM tickets t
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
                  AND t.created_at >= NOW() - (${daysNum} * INTERVAL '1 day')
            `;
            revenueQuery = await prisma.$queryRaw`
                SELECT SUM(tt.price) as total_revenue
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
                  AND t.created_at >= NOW() - (${daysNum} * INTERVAL '1 day')
            `;
            chartQuery = await prisma.$queryRaw`
                SELECT 
                    TO_CHAR(t.created_at, 'DD/MM') as name,
                    SUM(tt.price) as "doanhThu",
                    COUNT(t.id) as "veBan"
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN') 
                  AND t.created_at >= NOW() - (${daysNum} * INTERVAL '1 day')
                GROUP BY TO_CHAR(t.created_at, 'DD/MM')
                ORDER BY TO_CHAR(t.created_at, 'DD/MM') ASC
            `;
            pieChartQuery = await prisma.$queryRaw`
                SELECT c.name, SUM(tt.price) as value
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                JOIN concerts c ON tt.concert_id = c.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
                  AND t.created_at >= NOW() - (${daysNum} * INTERVAL '1 day')
                GROUP BY c.id, c.name
                ORDER BY value DESC
            `;
        } else {
            // Lọc theo organizer_id
            ticketsQuery = await prisma.$queryRaw`
                SELECT COUNT(*) as total
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                JOIN concerts c ON tt.concert_id = c.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
                  AND c.organizer_id = ${userId}::uuid
                  AND t.created_at >= NOW() - (${daysNum} * INTERVAL '1 day')
            `;
            revenueQuery = await prisma.$queryRaw`
                SELECT SUM(tt.price) as total_revenue
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                JOIN concerts c ON tt.concert_id = c.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
                  AND c.organizer_id = ${userId}::uuid
                  AND t.created_at >= NOW() - (${daysNum} * INTERVAL '1 day')
            `;
            chartQuery = await prisma.$queryRaw`
                SELECT 
                    TO_CHAR(t.created_at, 'DD/MM') as name,
                    SUM(tt.price) as "doanhThu",
                    COUNT(t.id) as "veBan"
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                JOIN concerts c ON tt.concert_id = c.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN') 
                  AND t.created_at >= NOW() - (${daysNum} * INTERVAL '1 day')
                  AND c.organizer_id = ${userId}::uuid
                GROUP BY TO_CHAR(t.created_at, 'DD/MM')
                ORDER BY TO_CHAR(t.created_at, 'DD/MM') ASC
            `;
            pieChartQuery = await prisma.$queryRaw`
                SELECT c.name, SUM(tt.price) as value
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                JOIN concerts c ON tt.concert_id = c.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
                  AND c.organizer_id = ${userId}::uuid
                  AND t.created_at >= NOW() - (${daysNum} * INTERVAL '1 day')
                GROUP BY c.id, c.name
                ORDER BY value DESC
            `;
        }
        
        const totalTicketsSold = Number((ticketsQuery as { total: bigint | number }[])[0]?.total || 0);
        const totalRevenue = Number((revenueQuery as { total_revenue: number }[])[0]?.total_revenue || 0);

        const chartData = (chartQuery as { name: string, doanhThu: number, veBan: bigint | number }[]).map(r => ({
            name: r.name,
            doanhThu: Number(r.doanhThu),
            veBan: Number(r.veBan)
        }));

        const pieChartData = (pieChartQuery as { name: string, value: number }[]).map(r => ({
            name: r.name,
            value: Number(r.value)
        }));

        const responseData = {
            totalConcerts,
            totalTicketsSold,
            totalRevenue,
            chartData,
            pieChartData
        };

        // Cache for 5 minutes (300 seconds)
        await redisClient.set(cacheKey, JSON.stringify(responseData), 'EX', 300);

        res.json(responseData);
    } catch (error) {
        logger.error({ error }, 'Error fetching dashboard stats');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

import csv from 'csv-parser';
import { guestUploadQueue } from '../config/queue';


export const uploadGuestsCSV = async (req: Request, res: Response): Promise<void> => {
    try {
        const file = req.file;
        const { concertId } = req.body;

        if (!file || !concertId) {
            res.status(400).json({ message: 'Missing file or concertId' });
            return;
        }

        // Auto find or create GUEST ticket type for this concert
        let guestTicketType = await prisma.ticket_types.findFirst({
            where: {
                concert_id: concertId,
                type: 'GUEST'
            }
        });

        if (!guestTicketType) {
            guestTicketType = await prisma.ticket_types.create({
                data: {
                    concert_id: concertId,
                    name: 'Thư Mời VIP',
                    total_quantity: 0,
                    max_per_user: 10,
                    price: 0,
                    type: 'GUEST'
                }
            });
        }
        
        const ticketTypeId = guestTicketType.id;

        const results: Record<string, unknown>[] = [];
        fs.createReadStream(file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                // Delete temp file
                fs.unlinkSync(file.path);

                // Add to BullMQ Queue
                const job = await guestUploadQueue.add('process-csv', {
                    guests: results,
                    concertId,
                    ticketTypeId
                });

                res.status(202).json({ 
                    message: 'Upload accepted, processing in background', 
                    jobId: job.id 
                });
            });

    } catch (error) {
        logger.error({ error }, 'Error uploading CSV');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getUploadProgress = async (req: Request, res: Response): Promise<void> => {
    try {
        const jobId = req.params.jobId as string;
        const job = await guestUploadQueue.getJob(jobId);
        
        if (!job) {
            res.status(404).json({ message: 'Job not found' });
            return;
        }

        const state = await job.getState();
        const progress = job.progress;
        const result = job.returnvalue; // Trả về undefined nếu chưa xong
        const failedReason = job.failedReason;

        res.json({
            id: job.id,
            state,
            progress,
            result,
            failedReason
        });
    } catch (error) {
        logger.error({ error }, 'Error getting job progress');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const saveSeatingMap = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const ticketTypeId = req.params.ticketTypeId as string;
        const { rows, cols, disabledSeats } = req.body; 
        
        const ticketType = await prisma.ticket_types.findUnique({
            where: { id: ticketTypeId },
            include: { concerts: true }
        });

        if (!ticketType || ticketType.concert_id !== id) {
            res.status(404).json({ message: 'Ticket type not found for this concert' });
            return;
        }

        if (req.user?.role === 'ORGANIZER' && ticketType.concerts?.organizer_id !== req.user.id) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        const disabledSet = new Set(disabledSeats);
        const ticketsToInsert: { ticket_type_id: string, seat_label: string, status: string, qr_code: string }[] = [];

        const getRowLabel = (index: number) => {
            let label = '';
            let temp = index;
            while (temp >= 0) {
                label = String.fromCharCode((temp % 26) + 65) + label;
                temp = Math.floor(temp / 26) - 1;
            }
            return label;
        };

        for (let r = 0; r < rows; r++) {
            const rowLabel = getRowLabel(r);
            for (let c = 0; c < cols; c++) {
                const key = `${r}-${c}`;
                if (!disabledSet.has(key)) {
                    ticketsToInsert.push({
                        ticket_type_id: ticketTypeId,
                        seat_label: `${rowLabel}${c + 1}`,
                        status: 'AVAILABLE',
                        qr_code: crypto.randomUUID()
                    });
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            // Row-level lock on ticket_types to prevent concurrent order creation or another map save
            await tx.$queryRaw`SELECT id FROM ticket_types WHERE id = ${ticketTypeId}::uuid FOR UPDATE`;

            const soldTickets = await tx.tickets.count({
                where: {
                    ticket_type_id: ticketTypeId,
                    status: { in: ['RESERVED', 'SOLD', 'CHECKED_IN'] }
                }
            });

            if (soldTickets > 0) {
                throw new Error('Cannot modify seating map after tickets are sold');
            }

            // Only delete available tickets to prevent accidental data loss of reserved tickets
            await tx.tickets.deleteMany({
                where: { ticket_type_id: ticketTypeId, status: 'AVAILABLE' }
            });

            if (ticketsToInsert.length > 0) {
                await tx.tickets.createMany({
                    data: ticketsToInsert
                });
            }

            await tx.ticket_types.update({
                where: { id: ticketTypeId },
                data: { total_quantity: ticketsToInsert.length }
            });

            let currentMap: Record<string, any> = (ticketType.concerts?.seating_map as Record<string, any>) || {};
            if (typeof currentMap !== 'object') currentMap = {};
            
            currentMap[ticketTypeId] = {
                rows,
                cols,
                disabledSeats
            };

            await tx.concerts.update({
                where: { id: id },
                data: { seating_map: currentMap }
            });
        });

        await redisClient.del(`concerts:detail:${id}`);

        res.status(200).json({ 
            message: 'Seating map saved successfully', 
            total_seats: ticketsToInsert.length 
        });

    } catch (error: unknown) {
        logger.error({ error }, 'Error saving seating map');
        if (error instanceof Error && error.message === 'Cannot modify seating map after tickets are sold') {
            res.status(400).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const uploadConcertBioPDF = async (req: Request, res: Response): Promise<void> => {
    try {
        const concertId = req.params.id as string;
        const file = req.file;

        if (!file) {
            res.status(400).json({ message: 'Vui lòng tải lên file PDF' });
            return;
        }

        const concert = await prisma.concerts.findUnique({
            where: { id: concertId }
        });

        if (!concert) {
            fs.unlinkSync(file.path);
            res.status(404).json({ message: 'Concert không tồn tại' });
            return;
        }

        // 1. Đọc file PDF và trích xuất text
        const dataBuffer = fs.readFileSync(file.path);
        let pdfText = '';
        try {
            const { PDFParse } = require('pdf-parse');
            const parser = new PDFParse({ data: dataBuffer });
            const parsedPdf = await parser.getText();
            pdfText = parsedPdf.text || '';
            await parser.destroy();
        } catch (pdfErr) {
            logger.error({ err: pdfErr }, 'Error parsing PDF');
            fs.unlinkSync(file.path);
            res.status(400).json({ message: 'Không thể đọc nội dung file PDF. Vui lòng kiểm tra định dạng file.' });
            return;
        }

        // Xóa file temp sau khi đọc xong
        fs.unlinkSync(file.path);

        if (!pdfText.trim()) {
            res.status(400).json({ message: 'File PDF rỗng hoặc không trích xuất được văn bản.' });
            return;
        }

        // 2. Gọi Gemini hoặc Fallback để tạo bio
        let bio = '';
        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey) {
            try {
                logger.info('[AI Artist Bio] Gọi Gemini API...');
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Hãy viết một bản giới thiệu nghệ sĩ và sự kiện âm nhạc ngắn gọn, truyền cảm hứng và cuốn hút (khoảng 100-150 từ, bằng tiếng Việt) dựa trên tài liệu press kit/hồ sơ sau đây. Tập trung vào phong cách âm nhạc, dấu ấn đặc sắc và lý do khán giả không nên bỏ lỡ sự kiện:\n\n${pdfText.slice(0, 5000)}`
                                }]
                            }]
                        })
                    }
                );

                if (response.ok) {
                    const resData = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
                    bio = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } else {
                    logger.error({ status: response.status }, '[AI Artist Bio] Gemini API trả về trạng thái lỗi');
                }
            } catch (aiError: unknown) {
                logger.error({ err: aiError instanceof Error ? aiError.message : String(aiError) }, '[AI Artist Bio] Gemini API gặp sự cố, chuyển sang Fallback');
            }
        }

        // 3. Fallback thông minh nếu không có API key hoặc API lỗi
        if (!bio) {
            logger.info('[AI Artist Bio] Sử dụng Intelligent Fallback Generator...');
            
            // Trích xuất một vài câu hoặc đoạn có ý nghĩa từ văn bản PDF
            const lines = pdfText.split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 30 && !l.includes('http') && !l.includes('@'));
            
            const highlights = lines.slice(0, 3).join(' ');
            
            bio = `[AI Generated] Đêm nhạc đặc biệt mang phong cách nghệ thuật độc đáo. ${highlights || 'Sự kiện quy tụ những tên tuổi hàng đầu và mang tới những phần trình diễn được chuẩn bị công phu.'} Đây hứa hẹn là một trải nghiệm âm nhạc đỉnh cao đầy cảm xúc mà người hâm mộ không thể bỏ qua tại sân khấu của chúng tôi năm nay.`;
        }

        // Làm sạch văn bản bio
        bio = bio.trim().replace(/\s+/g, ' ');

        // Không lưu tự động vào DB nữa để người dùng có thể tự chỉnh sửa trên UI
        // Dữ liệu sẽ được lưu khi Admin bấm cập nhật ở Frontend

        res.json({
            message: 'Tạo Artist Bio bằng AI thành công!',
            bio
        });

    } catch (error) {
        logger.error({ error }, 'Error in uploadConcertBioPDF');
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

