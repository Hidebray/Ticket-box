# Đặc tả: Luồng đồng bộ danh sách khách mời (CSV Sync)

## Mô tả
Hệ thống tự động đọc và nhập danh sách khách mời VIP (Guest List) từ file CSV do nhãn hàng cung cấp định kỳ vào ban đêm. Việc này nhằm đảm bảo thông tin khách mời được cập nhật cho quá trình soát vé ngày hôm sau.

## Luồng chính
1. **Tiếp nhận File:**
   - File CSV có thể được nhãn hàng upload qua SFTP hoặc ném vào một S3 Bucket quy định.
   - Định dạng chuẩn: `Email`, `FullName`, `TicketType`, `Quantity`.
2. **Cronjob / Trigger:**
   - Background Worker (chạy bằng `node-cron` hoặc BullMQ Repeatable Job) chạy lúc 2:00 AM hàng ngày.
   - Worker quét S3 Bucket để tìm file mới. Nếu thấy, lấy file về tải vào bộ nhớ tạm.
3. **Xử lý Dữ liệu (Processing & Validation):**
   - Đọc file theo Stream (tránh tràn RAM nếu file quá lớn).
   - Validate từng dòng: Email đúng format? TicketType có tồn tại?
   - Sử dụng **Upsert** (Update if exists, Insert if not) dựa trên Email khách mời.
4. **Cấp vé (Issue Ticket):**
   - Nếu là khách mới hoặc thay đổi số lượng, Worker sinh `Order` nội bộ (0 đồng) và `Ticket` tương ứng.
   - Sinh QR Code và gửi Email thư mời VIP (nếu cờ `SendEmail` = true).
5. **Đánh dấu File hoàn tất:**
   - Đổi tên file CSV thành `{filename}.processed.csv` hoặc di chuyển sang thư mục archive để không đọc lại.

## Kịch bản lỗi
- **Lỗi định dạng File (Corrupt/Missing Column):** Nếu header bị sai, Worker dừng ngay lập tức, bắn Alert (Slack/Email) cho team vận hành. Không xử lý bất kỳ dòng nào.
- **Lỗi một dòng dữ liệu (Row Error):** Ví dụ sai format Email. Worker **không dừng toàn bộ tiến trình**. Thay vào đó, ghi lại dòng lỗi vào một mảng, tiếp tục xử lý các dòng khác. Cuối cùng xuất ra file `error_report.csv` và gửi cho Admin.
- **Dữ liệu trùng lặp (Duplicate Email trong cùng file):** Worker gom nhóm theo Email, cộng dồn Quantity (hoặc lấy dòng cuối cùng tùy ruleset thống nhất với nhãn hàng).
- **Worker bị Crash giữa chừng:** Vì xử lý file thao tác sinh vé, cần dùng Transaction theo Batch (ví dụ 100 records/transaction). Nếu rớt, khi chạy lại phải cẩn thận. Tốt nhất là thêm cột `Processed` cho từng dòng, hoặc đọc lại file và bỏ qua những email đã có vé cho sự kiện này.

## Ràng buộc
- Luồng Sync chạy background, không làm ảnh hưởng (block event loop) của API Server chính. (Chạy trên process/server riêng).
- Phải dùng Stream API của Node.js (ví dụ thư viện `csv-parser`) để đảm bảo memory footprint ổn định.

## Tiêu chí chấp nhận
- Có khả năng xử lý file 10.000 dòng trong dưới 1 phút.
- File lỗi cấu trúc sẽ bị từ chối 100%. File có vài dòng lỗi vẫn chèn thành công các dòng đúng.
- Không phát sinh vé trùng lặp nếu chạy Worker 2 lần trên cùng 1 file.
