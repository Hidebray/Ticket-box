import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
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
            console.log('[EmailProvider] SMTP transporter initialized.');
        } else {
            console.warn('[EmailProvider] SMTP chưa cấu hình — sẽ dùng console log thay thế.');
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
            // Fallback: log chi tiết ra console để dev xem
            console.log('\n============================================================');
            console.log(`📧 [EMAIL FALLBACK] GỬI EMAIL XÁC NHẬN ĐẾN: \x1b[36m${email}\x1b[0m`);
            tickets.forEach((t, i) => {
                console.log(`   ${i + 1}. ${t.concertName} | Ghế: ${t.seatLabel || 'GA'} | ${t.price.toLocaleString('vi-VN')}đ`);
            });
            console.log('============================================================\n');
            return true;
        }

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"TicketBox" <noreply@ticketbox.vn>',
                to: email,
                subject: `🎫 Xác nhận mua vé - ${tickets[0]?.concertName || 'TicketBox'}`,
                html: this.buildTicketConfirmationHtml(tickets),
            });
            console.log(`[EmailProvider] ✅ Đã gửi email xác nhận tới ${email}`);
            return true;
        } catch (err) {
            console.error(`[EmailProvider] ❌ Lỗi gửi email tới ${email}:`, err);
            return false;
        }
    }

    async sendConcertReminder(email: string, concertName: string, startTime: Date): Promise<boolean> {
        if (!this.transporter) {
            console.log(`\n📧 [EMAIL FALLBACK] NHẮC NHỞ: "${concertName}" đến ${email} — ${startTime.toLocaleString('vi-VN')}`);
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
            console.log(`[EmailProvider] ✅ Đã gửi nhắc nhở tới ${email}`);
            return true;
        } catch (err) {
            console.error(`[EmailProvider] ❌ Lỗi gửi nhắc nhở tới ${email}:`, err);
            return false;
        }
    }
}

// 2. Zalo OA Provider stub (sẵn sàng khi tích hợp)
export class ZaloNotificationProvider implements NotificationProvider {
    name = 'Zalo OA';

    async sendTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<boolean> {
        console.log(`💬 [ZALO PROVIDER STUB] Gửi tin nhắn xác nhận mua vé tới: ${email}`);
        return true;
    }

    async sendConcertReminder(email: string, concertName: string, startTime: Date): Promise<boolean> {
        console.log(`💬 [ZALO PROVIDER STUB] Gửi nhắc nhở concert tới: ${email}`);
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
        console.log(`[NotificationService] Đã đăng ký thêm provider: ${provider.name}`);
    }

    async notifyTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<void> {
        await Promise.all(
            this.providers.map(p =>
                p.sendTicketConfirmation(email, tickets).catch(err => {
                    console.error(`[NotificationService] Lỗi gửi qua ${p.name}:`, err);
                    return false;
                })
            )
        );
    }

    async notifyConcertReminder(email: string, concertName: string, startTime: Date): Promise<void> {
        await Promise.all(
            this.providers.map(p =>
                p.sendConcertReminder(email, concertName, startTime).catch(err => {
                    console.error(`[NotificationService] Lỗi gửi nhắc nhở qua ${p.name}:`, err);
                    return false;
                })
            )
        );
    }
}

export default NotificationService.getInstance();
