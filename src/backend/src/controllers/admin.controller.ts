import { Request, Response } from 'express';
import prisma from '../config/db';
import redisClient from '../config/redis';
import crypto from 'crypto';
import fs from 'fs';
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
        res.json(concerts);
    } catch (error) {
        console.error('Error fetching admin concerts:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const createConcert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, start_time, status } = req.body;
        
        const concert = await prisma.concerts.create({
            data: {
                organizer_id: req.user?.id,
                name,
                description,
                start_time: new Date(start_time),
                status
            }
        });
        
        // Invalidate cache
        await redisClient.del('concerts:list');
        
        res.status(201).json(concert);
    } catch (error) {
        console.error('Error creating concert:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const updateConcert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, start_time, status } = req.body;
        
        const concert = await prisma.concerts.update({
            where: { id: id as string },
            data: {
                name,
                description,
                start_time: start_time ? new Date(start_time) : undefined,
                status
            }
        });
        
        // Invalidate cache
        await redisClient.del('concerts:list');
        await redisClient.del(`concerts:detail:${id}`);
        
        res.json(concert);
    } catch (error) {
        console.error('Error updating concert:', error);
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
        console.error('Error creating ticket type:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const role = req.user?.role;
        const userId = req.user?.id;
        const isSuperAdmin = role === 'SUPER_ADMIN';

        const concertWhere = isSuperAdmin ? {} : { organizer_id: userId };
        const totalConcerts = await prisma.concerts.count({ where: concertWhere });

        // Prisma doesn't easily support deep relations in count/sum across multiple tables directly, 
        // so raw query is best here for both totalRevenue and totalTicketsSold
        
        let revenueQuery;
        let chartQuery;
        let ticketsQuery;

        if (isSuperAdmin) {
            ticketsQuery = await prisma.$queryRaw`
                SELECT COUNT(*) as total
                FROM tickets t
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
            `;
            revenueQuery = await prisma.$queryRaw`
                SELECT SUM(tt.price) as total_revenue
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
            `;
            chartQuery = await prisma.$queryRaw`
                SELECT 
                    TO_CHAR(t.created_at, 'DD/MM') as name,
                    SUM(tt.price) as "doanhThu",
                    COUNT(t.id) as "veBan"
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN') 
                  AND t.created_at >= NOW() - INTERVAL '7 days'
                GROUP BY TO_CHAR(t.created_at, 'DD/MM')
                ORDER BY TO_CHAR(t.created_at, 'DD/MM') ASC
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
            `;
            revenueQuery = await prisma.$queryRaw`
                SELECT SUM(tt.price) as total_revenue
                FROM tickets t
                JOIN ticket_types tt ON t.ticket_type_id = tt.id
                JOIN concerts c ON tt.concert_id = c.id
                WHERE t.status IN ('SOLD', 'CHECKED_IN')
                  AND c.organizer_id = ${userId}::uuid
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
                  AND t.created_at >= NOW() - INTERVAL '7 days'
                  AND c.organizer_id = ${userId}::uuid
                GROUP BY TO_CHAR(t.created_at, 'DD/MM')
                ORDER BY TO_CHAR(t.created_at, 'DD/MM') ASC
            `;
        }
        
        const totalTicketsSold = Number((ticketsQuery as any)[0]?.total || 0);
        const totalRevenue = Number((revenueQuery as any)[0]?.total_revenue || 0);

        const chartData = (chartQuery as any[]).map(r => ({
            name: r.name,
            doanhThu: Number(r.doanhThu),
            veBan: Number(r.veBan)
        }));

        res.json({
            totalConcerts,
            totalTicketsSold,
            totalRevenue,
            chartData
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

import csv from 'csv-parser';
import { guestUploadQueue } from '../config/queue';


export const uploadGuestsCSV = async (req: Request, res: Response): Promise<void> => {
    try {
        const file = req.file;
        const { concertId, ticketTypeId } = req.body;

        if (!file || !concertId || !ticketTypeId) {
            res.status(400).json({ message: 'Missing file, concertId, or ticketTypeId' });
            return;
        }

        const results: any[] = [];
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
        console.error('Error uploading CSV:', error);
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
        console.error('Error getting job progress:', error);
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

        const soldTickets = await prisma.tickets.count({
            where: {
                ticket_type_id: ticketTypeId,
                status: { in: ['RESERVED', 'SOLD', 'CHECKED_IN'] }
            }
        });

        if (soldTickets > 0) {
            res.status(400).json({ message: 'Cannot modify seating map after tickets are sold' });
            return;
        }

        await prisma.tickets.deleteMany({
            where: { ticket_type_id: ticketTypeId }
        });

        const disabledSet = new Set(disabledSeats);
        const ticketsToInsert = [];

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

        if (ticketsToInsert.length > 0) {
            await prisma.tickets.createMany({
                data: ticketsToInsert
            });
        }

        await prisma.ticket_types.update({
            where: { id: ticketTypeId },
            data: { total_quantity: ticketsToInsert.length }
        });

        let currentMap: any = ticketType.concerts?.seating_map || {};
        if (typeof currentMap !== 'object') currentMap = {};
        
        currentMap[ticketTypeId] = {
            rows,
            cols,
            disabledSeats
        };

        await prisma.concerts.update({
            where: { id: id },
            data: { seating_map: currentMap }
        });

        await redisClient.del(`concerts:detail:${id}`);

        res.status(200).json({ 
            message: 'Seating map saved successfully', 
            total_seats: ticketsToInsert.length 
        });

    } catch (error) {
        console.error('Error saving seating map:', error);
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
            const parsedPdf = await pdf(dataBuffer);
            pdfText = parsedPdf.text || '';
        } catch (pdfErr) {
            console.error('Error parsing PDF:', pdfErr);
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
                console.log('[AI Artist Bio] Gọi Gemini API...');
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
                    const resData: any = await response.json();
                    bio = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } else {
                    console.error('[AI Artist Bio] Gemini API trả về trạng thái lỗi:', response.status);
                }
            } catch (aiError: any) {
                console.error('[AI Artist Bio] Gemini API gặp sự cố, chuyển sang Fallback:', aiError.message);
            }
        }

        // 3. Fallback thông minh nếu không có API key hoặc API lỗi
        if (!bio) {
            console.log('[AI Artist Bio] Sử dụng Intelligent Fallback Generator...');
            
            // Trích xuất một vài câu hoặc đoạn có ý nghĩa từ văn bản PDF
            const lines = pdfText.split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 30 && !l.includes('http') && !l.includes('@'));
            
            const highlights = lines.slice(0, 3).join(' ');
            
            bio = `[AI Generated] Đêm nhạc đặc biệt mang phong cách nghệ thuật độc đáo. ${highlights || 'Sự kiện quy tụ những tên tuổi hàng đầu và mang tới những phần trình diễn được chuẩn bị công phu.'} Đây hứa hẹn là một trải nghiệm âm nhạc đỉnh cao đầy cảm xúc mà người hâm mộ không thể bỏ qua tại sân khấu của chúng tôi năm nay.`;
        }

        // Làm sạch văn bản bio
        bio = bio.trim().replace(/\s+/g, ' ');

        // 4. Lưu vào cơ sở dữ liệu
        await prisma.concerts.update({
            where: { id: concertId },
            data: { description: bio }
        });

        // 5. Xóa cache Redis
        await redisClient.del('concerts:list');
        await redisClient.del(`concerts:detail:${concertId}`);

        res.json({
            message: 'Tạo Artist Bio bằng AI thành công!',
            bio
        });

    } catch (error) {
        console.error('Error in uploadConcertBioPDF:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

