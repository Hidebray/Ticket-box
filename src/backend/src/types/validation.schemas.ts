import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ============================================================
// [STB-01] Tập trung tất cả Zod schemas vào 1 file
// ============================================================

// --- Auth ---
export const registerSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
    // [SEC-05] role sẽ bị bỏ qua ở controller, nhưng vẫn validate nếu có
    role: z.literal('AUDIENCE').optional().default('AUDIENCE'),
});

export const loginSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(1, 'Mật khẩu không được để trống'),
});

// --- Order ---
export const createOrderSchema = z.object({
    ticketTypeId: z.string().uuid('ticketTypeId phải là UUID hợp lệ'),
    ticketIds: z
        .array(z.string().uuid('Mỗi ticketId phải là UUID hợp lệ'))
        .min(1, 'Phải chọn ít nhất 1 vé')
        .max(10, 'Tối đa 10 vé mỗi lần đặt'),
});

// --- Webhook ---
export const webhookPayloadSchema = z.object({
    orderId: z.string().uuid('orderId phải là UUID hợp lệ'),
    status: z.enum(['SUCCESS', 'FAILED'], {
        message: 'status phải là SUCCESS hoặc FAILED',
    }),
});

// --- Concert Admin ---
export const createConcertSchema = z.object({
    name: z.string().min(1, 'Tên concert không được để trống').max(255),
    description: z.string().optional(),
    location: z.string().min(1, 'Địa điểm không được để trống').max(255).optional(),
    start_time: z.string().datetime({ message: 'start_time phải là ISO 8601 datetime' }),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).default('DRAFT'),
});

export const updateConcertSchema = createConcertSchema.partial();

export const createTicketTypeSchema = z.object({
    concert_id: z.string().uuid('concert_id phải là UUID hợp lệ'),
    name: z.string().min(1).max(100),
    price: z.coerce.number().nonnegative('Giá phải >= 0'),
    total_quantity: z.coerce.number().int().nonnegative('Số lượng phải >= 0'),
    max_per_user: z.coerce.number().int().positive().default(4),
});

export const seatingMapSchema = z.object({
    rows: z.number().int().min(1).max(50, 'Tối đa 50 hàng'),
    cols: z.number().int().min(1).max(50, 'Tối đa 50 cột'),
    disabledSeats: z.array(z.string()).default([]),
});

// --- Check-in ---
export const syncUpSchema = z.object({
    scannedTickets: z.array(z.object({
        ticketId: z.string().uuid('ticketId phải là UUID hợp lệ'),
        scannedAt: z.string().datetime({ message: 'scannedAt phải là ISO 8601 datetime' })
    })).min(1, 'Phải có ít nhất 1 vé để đồng bộ')
});

// --- Worker ---
export const triggerJobSchema = z.object({
    type: z.enum(['generate-ai-bio', 'send-email'], {
        message: 'Invalid job type'
    }),
    payload: z.any()
});

// ============================================================
// Middleware factory — validate req.body với schema bất kỳ
// ============================================================
export const validate = <T extends z.ZodTypeAny>(schema: T) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues.map(e => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            res.status(400).json({ message: 'Validation failed', errors });
            return;
        }
        // Gán lại body với giá trị đã được parse và coerce
        req.body = result.data;
        next();
    };
};
