# TicketBox Frontend

Đây là thư mục chứa mã nguồn Frontend cho hệ thống TicketBox. Ứng dụng được xây dựng dưới dạng một **Single Page Application (SPA)** kết hợp với các tính năng của **Progressive Web App (PWA)** để mang lại trải nghiệm mượt mà, tốc độ cao và hỗ trợ offline một phần.

## 🛠 Công nghệ sử dụng (Tech Stack)

- **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Animation**: [GSAP](https://gsap.com/) cho các hiệu ứng chuyển động mượt mà.
- **Biểu đồ**: [Recharts](https://recharts.org/) dùng cho Dashboard thống kê.
- **Icon**: [Lucide React](https://lucide.dev/)
- **Quét mã QR**: `@yudiel/react-qr-scanner` & `html5-qrcode` (Dùng cho tính năng Check-in của Staff).
- **PWA & Offline Storage**: `vite-plugin-pwa`, `dexie`, `idb-keyval`.
- **HTTP Client**: `axios`

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Cài đặt Dependencies

Mở terminal tại thư mục `src/frontend` và chạy:

```bash
npm install
```

### 2. Biến Môi Trường (Environment Variables)

Nếu dự án có yêu cầu, hãy copy file `.env.example` thành `.env` (hoặc tạo file `.env` nếu chưa có) và thiết lập các API endpoint:

```env
VITE_API_URL=http://localhost:3001/api
```
*(Nếu không set, ứng dụng có thể tự động fallback về localhost:3001 dựa theo config proxy của Vite)*

### 3. Chạy môi trường Development

```bash
npm run dev
```

Ứng dụng sẽ khởi chạy tại [http://localhost:5173](http://localhost:5173).

## 📦 Build cho Production

Để build ra các file tĩnh chuẩn bị cho việc deploy:

```bash
npm run build
```

Sau khi build xong, thư mục `dist/` sẽ được tạo ra chứa toàn bộ file HTML, JS, CSS đã được tối ưu hóa. Bạn có thể dùng `npm run preview` để chạy thử bản build trên local:

```bash
npm run preview
```

## 🏗 Cấu trúc thư mục tham khảo

- `src/components/`: Các UI Component dùng chung (Nút bấm, Modal, Input, Layout...).
- `src/pages/`: Các trang chính (Home, Login, Dashboard, Check-in, Checkout...).
- `src/assets/`: Hình ảnh, font chữ tĩnh.
- `src/utils/`: Các hàm tiện ích dùng chung (format tiền tệ, ngày tháng...).

---
*Lưu ý: Để hệ thống hoạt động hoàn chỉnh (như mua vé, check-in), bạn cần đảm bảo Backend và Database đã được chạy song song tại port 3001.*
