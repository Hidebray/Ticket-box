import dotenv from 'dotenv';
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

// 1. Email Provider
export class EmailNotificationProvider implements NotificationProvider {
  name = 'Email';

  async sendTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<boolean> {
    console.log('\n============================================================');
    console.log(`📧 [EMAIL PROVIDER] GỬI EMAIL XÁC NHẬN ĐẾN: \x1b[36m${email}\x1b[0m`);
    console.log('------------------------------------------------------------');
    console.log('🎉 Cảm ơn bạn đã đặt vé thành công tại TicketBox!');
    console.log('🎫 Chi tiết vé của bạn:');
    
    tickets.forEach((t, i) => {
      console.log(`   ${i + 1}. Sự kiện: \x1b[33m${t.concertName}\x1b[0m`);
      console.log(`      Ghế: \x1b[32m${t.seatLabel || 'GA (Đứng)'}\x1b[0m | Giá: ${t.price.toLocaleString('vi-VN')}đ`);
      console.log(`      Thời gian: ${t.startTime.toLocaleString('vi-VN')}`);
      console.log(`      Mã QR Check-in: \x1b[35m${t.id}\x1b[0m`);
    });
    console.log('============================================================\n');
    return true;
  }

  async sendConcertReminder(email: string, concertName: string, startTime: Date): Promise<boolean> {
    console.log('\n============================================================');
    console.log(`📧 [EMAIL PROVIDER] GỬI EMAIL NHẮC NHỞ ĐẾN: \x1b[36m${email}\x1b[0m`);
    console.log('------------------------------------------------------------');
    console.log(`🔔 NHẮC NHỞ: Sự kiện \x1b[33m${concertName}\x1b[0m sắp diễn ra!`);
    console.log(`🕒 Thời gian: ${startTime.toLocaleString('vi-VN')}`);
    console.log('📍 Hãy chuẩn bị sẵn mã QR trong ví vé của bạn để làm thủ tục check-in.');
    console.log('============================================================\n');
    return true;
  }
}

// 2. Future Zalo OA Provider stub
export class ZaloNotificationProvider implements NotificationProvider {
  name = 'Zalo OA';

  async sendTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<boolean> {
    console.log(`💬 [ZALO PROVIDER STUB] Gửi tin nhắn Zalo xác nhận mua vé tới tài khoản liên kết: ${email}`);
    return true;
  }

  async sendConcertReminder(email: string, concertName: string, startTime: Date): Promise<boolean> {
    console.log(`💬 [ZALO PROVIDER STUB] Gửi tin nhắn Zalo nhắc nhở concert tới tài khoản: ${email}`);
    return true;
  }
}

// 3. Notification Service Coordinator
export class NotificationService {
  private static instance: NotificationService;
  private providers: NotificationProvider[] = [];

  private constructor() {
    // Đăng ký các provider mặc định
    this.providers.push(new EmailNotificationProvider());
    
    // Có thể cắm thêm Zalo OA nếu cần trong tương lai
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
    console.log(`[NotificationService] Đã đăng ký thêm provider mới: ${provider.name}`);
  }

  async notifyTicketConfirmation(email: string, tickets: TicketDetail[]): Promise<void> {
    const promises = this.providers.map(p => 
      p.sendTicketConfirmation(email, tickets)
        .catch(err => {
          console.error(`[NotificationService] Lỗi khi gửi thông báo qua ${p.name}:`, err);
          return false;
        })
    );
    await Promise.all(promises);
  }

  async notifyConcertReminder(email: string, concertName: string, startTime: Date): Promise<void> {
    const promises = this.providers.map(p => 
      p.sendConcertReminder(email, concertName, startTime)
        .catch(err => {
          console.error(`[NotificationService] Lỗi khi gửi nhắc nhở qua ${p.name}:`, err);
          return false;
        })
    );
    await Promise.all(promises);
  }
}

export default NotificationService.getInstance();
