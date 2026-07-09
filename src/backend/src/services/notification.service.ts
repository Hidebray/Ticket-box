import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import logger from '../utils/logger';
dotenv.config();

export interface TicketDetail {
    id: string;
    seatLabel: string | null;
    price: number;
    concertName: string;
    startTime: Date;
}

export interface NotificationProvider {
    name: string;
    sendTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<boolean>;
    sendConcertReminder(email: string, concertName: string, startTime: Date): Promise<boolean>;
    sendVIPInvitation(email: string, guestName: string, concertName: string, startTime: Date): Promise<boolean>;
}

// ============================================================
// [STB-02] Email Provider — Nodemailer thật với HTML template
// ============================================================
export class EmailNotificationProvider implements NotificationProvider {
    name = 'Email';

    private transporter: nodemailer.Transporter | null = null;

    constructor() {
        // Chỉ tạo transporter nếu đã cấu hình SMTP
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_PORT === '465',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            logger.info('[EmailProvider] SMTP transporter initialized.');
        } else {
            logger.warn('[EmailProvider] SMTP chưa cấu hình — sẽ dùng logger thay thế.');
        }
    }

    private formatCurrency(amount: number): string {
        return amount.toLocaleString('vi-VN') + 'đ';
    }

    private buildTicketConfirmationHtml(tickets: TicketDetail[]): string {
        const ticketRows = tickets.map((t, i) => `
            <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px">${i + 1}</td>
                <td style="padding:12px;font-weight:bold">${t.concertName}</td>
                <td style="padding:12px">${t.seatLabel || 'GA (Đứng)'}</td>
                <td style="padding:12px;color:#e11d48;font-weight:bold">${this.formatCurrency(t.price)}</td>
                <td style="padding:12px">${new Date(t.startTime).toLocaleString('vi-VN')}</td>
                <td style="padding:12px;font-family:monospace;font-size:12px;color:#64748b">${t.id.split('-')[0].toUpperCase()}</td>
            </tr>
        `).join('');

        return `
        <!DOCTYPE html>
        <html lang="vi">
        <head><meta charset="UTF-8"><title>Xác nhận mua vé - TicketBox</title></head>
        <body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:0">
            <div style="max-width:680px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
                <div style="background:linear-gradient(135deg,#e11d48,#be185d);padding:40px 32px;text-align:center">
                    <h1 style="color:#fff;margin:0;font-size:28px">🎫 TicketBox</h1>
                    <p style="color:#fecdd3;margin:8px 0 0">Xác nhận đặt vé thành công</p>
                </div>
                <div style="padding:32px">
                    <p style="font-size:16px;color:#1e293b">Cảm ơn bạn đã mua vé tại <strong>TicketBox</strong>! Dưới đây là chi tiết vé của bạn:</p>
                    <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
                        <thead>
                            <tr style="background:#f1f5f9;text-align:left">
                                <th style="padding:12px">#</th>
                                <th style="padding:12px">Sự kiện</th>
                                <th style="padding:12px">Ghế</th>
                                <th style="padding:12px">Giá</th>
                                <th style="padding:12px">Thời gian</th>
                                <th style="padding:12px">Mã vé</th>
                            </tr>
                        </thead>
                        <tbody>${ticketRows}</tbody>
                    </table>
                    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;margin:24px 0">
                        <p style="margin:0;color:#92400e;font-size:14px">
                            📱 <strong>Check-in:</strong> Mang theo mã QR (mã vé) hoặc CCCD của bạn khi đến sự kiện.
                        </p>
                    </div>
                    <p style="color:#64748b;font-size:13px">Mọi thắc mắc vui lòng liên hệ: <a href="mailto:support@ticketbox.vn" style="color:#e11d48">support@ticketbox.vn</a></p>
                </div>
                <div style="background:#f8fafc;padding:20px 32px;text-align:center;color:#94a3b8;font-size:12px">
                    © 2026 TicketBox. Tất cả quyền được bảo lưu.
                </div>
            </div>
        </body>
        </html>`;
    }

    async sendTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<boolean> {
        if (!this.transporter) {
            // Fallback: log chi tiết ra logger
            logger.info({
                email,
                tickets: tickets.map(t => ({
                    id: t.id,
                    concertName: t.concertName,
                    seatLabel: t.seatLabel || 'GA',
                    price: t.price
                }))
            }, '[EMAIL FALLBACK] GỬI EMAIL XÁC NHẬN ĐẾN KHÁCH HÀNG');
            return true;
        }

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"TicketBox" <noreply@ticketbox.vn>',
                to: email,
                subject: `🎫 Xác nhận mua vé - ${tickets[0]?.concertName || 'TicketBox'}`,
                html: this.buildTicketConfirmationHtml(tickets),
            });
            logger.info({ email }, '[EmailProvider] ✅ Đã gửi email xác nhận');
            return true;
        } catch (err) {
            logger.error({ err, email }, '[EmailProvider] ❌ Lỗi gửi email');
            return false;
        }
    }

    async sendConcertReminder(email: string, concertName: string, startTime: Date): Promise<boolean> {
        if (!this.transporter) {
            logger.info({ email, concertName, startTime }, '[EMAIL FALLBACK] NHẮC NHỞ CONCERT');
            return true;
        }

        const htmlBody = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <h2 style="color:#e11d48">🔔 Nhắc nhở sự kiện sắp diễn ra!</h2>
                <p>Sự kiện <strong>${concertName}</strong> sẽ bắt đầu vào:</p>
                <p style="font-size:20px;font-weight:bold;color:#1e293b">${startTime.toLocaleString('vi-VN')}</p>
                <p>📱 Hãy chuẩn bị mã QR trong ứng dụng TicketBox để check-in nhanh chóng!</p>
            </div>`;

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"TicketBox" <noreply@ticketbox.vn>',
                to: email,
                subject: `🔔 Nhắc nhở: ${concertName} sắp bắt đầu!`,
                html: htmlBody,
            });
            logger.info({ email }, '[EmailProvider] ✅ Đã gửi nhắc nhở');
            return true;
        } catch (err) {
            logger.error({ err, email }, '[EmailProvider] ❌ Lỗi gửi nhắc nhở');
            return false;
        }
    }
    async sendVIPInvitation(email: string, guestName: string, concertName: string, startTime: Date): Promise<boolean> {
        if (!this.transporter) {
            logger.info({ email, guestName, concertName }, '[EMAIL FALLBACK] GỬI THƯ MỜI VIP');
            return true;
        }

        const htmlBody = `
        <!DOCTYPE html>
        <html lang="vi">
        <head><meta charset="UTF-8"><title>Thư Mời Tham Dự VIP - ${concertName}</title></head>
        <body style="font-family:Arial,sans-serif;background:#0f172a;margin:0;padding:0;color:#f8fafc;">
            <div style="max-width:680px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.5);border:1px solid #334155;">
                <div style="background:linear-gradient(135deg,#c084fc,#a855f7);padding:40px 32px;text-align:center">
                    <h1 style="color:#fff;margin:0;font-size:32px;letter-spacing:2px">THƯ MỜI VIP</h1>
                    <p style="color:#f3e8ff;margin:8px 0 0;font-size:18px">${concertName}</p>
                </div>
                <div style="padding:40px 32px;text-align:center;">
                    <p style="font-size:18px;color:#94a3b8;margin-bottom:8px">Trân trọng kính mời</p>
                    <p style="font-size:28px;color:#f8fafc;font-weight:bold;margin:0 0 32px 0">${guestName}</p>
                    
                    <div style="background:#0f172a;padding:24px;border-radius:8px;border:1px dashed #475569;margin-bottom:32px">
                        <p style="margin:0 0 12px 0;color:#94a3b8">Thời gian bắt đầu sự kiện:</p>
                        <p style="font-size:24px;font-weight:bold;color:#c084fc;margin:0">${startTime.toLocaleString('vi-VN')}</p>
                    </div>

                    <p style="font-size:16px;line-height:1.6;color:#cbd5e1">Sự hiện diện của quý vị là niềm vinh hạnh lớn lao cho Ban Tổ Chức. Vui lòng xuất trình thư mời này (hoặc email này) tại lối đi riêng dành cho khách VIP để được tiếp đón chu đáo nhất.</p>
                </div>
                <div style="background:#0f172a;padding:20px 32px;text-align:center;color:#64748b;font-size:12px;border-top:1px solid #334155">
                    © 2026 TicketBox VIP Services
                </div>
            </div>
        </body>
        </html>`;

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"TicketBox VIP" <noreply@ticketbox.vn>',
                to: email,
                subject: `💌 Thư Mời Khách Danh Dự - Sự kiện ${concertName}`,
                html: htmlBody,
            });
            logger.info({ email }, '[EmailProvider] ✅ Đã gửi thư mời VIP');
            return true;
        } catch (err) {
            logger.error({ err, email }, '[EmailProvider] ❌ Lỗi gửi thư mời VIP');
            return false;
        }
    }
}

// 2. Zalo OA Provider stub (sẵn sàng khi tích hợp)
export class ZaloNotificationProvider implements NotificationProvider {
    name = 'Zalo OA';

    async sendTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<boolean> {
        logger.info({ email }, '[ZALO PROVIDER STUB] Gửi tin nhắn xác nhận mua vé');
        return true;
    }

    async sendConcertReminder(email: string, concertName: string, startTime: Date): Promise<boolean> {
        logger.info({ email }, '[ZALO PROVIDER STUB] Gửi nhắc nhở concert');
        return true;
    }

    async sendVIPInvitation(email: string, guestName: string, concertName: string, startTime: Date): Promise<boolean> {
        logger.info({ email }, '[ZALO PROVIDER STUB] Gửi thư mời VIP qua Zalo OA');
        return true;
    }
}

// ============================================================
// 3. Notification Service Coordinator (Singleton + Strategy)
// ============================================================
export class NotificationService {
    private static instance: NotificationService;
    private providers: NotificationProvider[] = [];

    private constructor() {
        this.providers.push(new EmailNotificationProvider());
        // Cắm thêm provider tại đây khi cần:
        // this.providers.push(new ZaloNotificationProvider());
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    public addProvider(provider: NotificationProvider) {
        this.providers.push(provider);
        logger.info({ providerName: provider.name }, '[NotificationService] Đã đăng ký thêm provider');
    }

    async notifyTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<void> {
        await Promise.all(
            this.providers.map(p =>
                p.sendTicketConfirmation(email, tickets).catch(err => {
                    logger.error({ err, provider: p.name }, '[NotificationService] Lỗi gửi ticket confirmation');
                    return false;
                })
            )
        );
    }

    async notifyConcertReminder(email: string, concertName: string, startTime: Date): Promise<void> {
        await Promise.all(
            this.providers.map(p =>
                p.sendConcertReminder(email, concertName, startTime).catch(err => {
                    logger.error({ err, provider: p.name }, '[NotificationService] Lỗi gửi nhắc nhở concert');
                    return false;
                })
            )
        );
    }

    async notifyVIPInvitation(email: string, guestName: string, concertName: string, startTime: Date): Promise<void> {
        await Promise.all(
            this.providers.map(p =>
                p.sendVIPInvitation(email, guestName, concertName, startTime).catch(err => {
                    logger.error({ err, provider: p.name }, '[NotificationService] Lỗi gửi thư mời VIP');
                    return false;
                })
            )
        );
    }
}

export default NotificationService.getInstance();
