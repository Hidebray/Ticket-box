# TicketBox — Project Proposal

## 1. Vấn đề hiện tại
Các sự kiện âm nhạc quy mô lớn hiện nay đang đối mặt với những thách thức nghiêm trọng trong khâu phân phối vé:
- **Hệ thống sụp đổ dưới tải cao:** Các nền tảng bán vé thường bị quá tải và sập trong những phút đầu tiên mở bán do lượng người truy cập tăng đột biến (đỉnh điểm có thể lên tới hàng chục nghìn người cùng lúc).
- **Trải nghiệm thanh toán tệ hại:** Khán giả bị trừ tiền trong tài khoản nhưng hệ thống báo lỗi không xuất vé, gây bức xúc lớn.
- **Sự thao túng của Scalper/Bot:** Việc thiếu cơ chế chống bot dẫn đến tình trạng phe vé dùng tool gom sạch vé trong vài giây, sau đó bán lại ở chợ đen với giá cắt cổ.
- **Quy trình phân mảnh, thiếu đồng bộ:** Một số sự kiện dùng Google Form, Zalo OA hay chuyển khoản thủ công, thiếu tính minh bạch, dễ gian lận và tốn nhiều nguồn lực vận hành.

## 2. Mục tiêu dự án
Xây dựng nền tảng TicketBox hiện đại, giải quyết triệt để các vấn đề trên với các mục tiêu định lượng và định tính:
- **Chịu tải cao (High Availability & Scalability):** Đảm bảo hệ thống vẫn hoạt động ổn định khi có 80.000 người truy cập đồng thời trong 5 phút đầu mở bán.
- **Đảm bảo tính công bằng (Fairness):** Ngăn chặn bot, đảm bảo mỗi người dùng thật đều có cơ hội mua vé bình đẳng và tuân thủ chặt chẽ giới hạn số vé/user.
- **Tính toàn vẹn dữ liệu (Data Integrity):** Không xảy ra tình trạng overselling (bán lố vé) hay trừ tiền hai lần.
- **Số hóa toàn trình:** Từ khâu quản lý sự kiện, mua vé online, đến soát vé offline tại cổng bằng mã QR.

## 3. Đối tượng người dùng và Nhu cầu
- **Khán giả (End Users):** Cần một nền tảng mượt mà, minh bạch để xem thông tin concert, sơ đồ ghế, mua vé nhanh chóng và nhận e-ticket (QR code).
- **Ban tổ chức (Event Organizers):** Cần hệ thống CMS quản trị để tạo concert, định giá, mở bán vé, xem báo cáo doanh thu realtime và tích hợp AI tạo bio nghệ sĩ, quản lý khách mời VIP qua file CSV.
- **Nhân sự soát vé (Staff):** Cần ứng dụng di động để quét QR code nhanh chóng tại sự kiện, kể cả trong điều kiện mạng chập chờn hoặc không có mạng (Offline Check-in).

## 4. Rủi ro và Ràng buộc
- **Tranh chấp dữ liệu (Race Conditions):** Rủi ro nhiều người cùng tranh mua những chiếc vé cuối cùng dẫn đến vượt số lượng.
- **Sự cố bên thứ 3:** Cổng thanh toán (VNPAY, MoMo) có thể bị nghẽn hoặc timeout làm đứt gãy luồng xử lý.
- **Môi trường vật lý:** Kết nối mạng 4G/Wifi tại sân vận động thường kém, ảnh hưởng quá trình soát vé.
- **Giới hạn số lượng vé/tài khoản dưới tải cao:** Việc enforce policy (ví dụ: tối đa 2 vé VIP/người) rất dễ bị lách nếu không lock chặt ở tầng Database.
