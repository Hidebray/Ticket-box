import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Wallet, ShieldCheck, Tag } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';

export default function Checkout() {
  const { id } = useParams(); // orderId
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any>(null);
  const [ticketPrice, setTicketPrice] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Order
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrder(res.data);

        // Lấy giá vé từ ticket_type nếu có (order phải include ticket_types)
        if (res.data.tickets?.length > 0 && res.data.tickets[0]?.ticket_types?.price) {
          setTicketPrice(Number(res.data.tickets[0].ticket_types.price));
        }

        // Cập nhật lại thời gian đếm ngược thực tế từ created_at
        const createdAt = new Date(res.data.created_at).getTime();
        const now = Date.now();
        const diffSeconds = Math.floor((15 * 60 * 1000 - (now - createdAt)) / 1000);

        if (diffSeconds <= 0 || res.data.status === 'FAILED') {
          toast.error('Đơn hàng đã hết hạn hoặc bị hủy!');
          navigate('/');
        } else if (res.data.status === 'SUCCESS') {
          navigate('/dashboard');
        } else {
          setTimeLeft(diffSeconds);
          setLoading(false);
        }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Không tìm thấy đơn hàng'));
        navigate('/');
      }
    };

    fetchOrder();
  }, [id, token, navigate]);

  // 2. Countdown Timer
  useEffect(() => {
    if (loading || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.error('Hết thời gian giữ vé! Đơn hàng đã bị hủy.');
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, timeLeft, navigate]);

  // 3. SSE Webhook Listening (thay thế polling)
  useEffect(() => {
    if (!isProcessing || !id) return;

    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/orders/stream/${id}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'SUCCESS') {
          eventSource.close();
          toast.success('🎫 Thanh toán thành công! Vé đã được chuyển vào Ví của bạn.');
          setTimeout(() => navigate('/dashboard'), 1500);
        } else if (data.status === 'FAILED') {
          eventSource.close();
          toast.error('Thanh toán thất bại hoặc quá hạn!');
          navigate('/');
        }
      } catch (error) {
        return; // Silent error for SSE parse failure
      }
    };

    eventSource.onerror = () => {
      // Silent error for SSE connection failure (e.g. network blip)
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isProcessing, id, navigate]);

  const handlePayment = async () => {
    setIsProcessing(true);

    // Gọi API mock — trong production sẽ redirect tới URL của cổng thanh toán thật
    setTimeout(async () => {
      try {
        const toastId = toast.loading('Đang kết nối cổng thanh toán...');
        const payload = { orderId: id, status: 'SUCCESS' };

        await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/webhooks/mock-payment`,
          payload
        );
        toast.dismiss(toastId);
        // SSE sẽ nhận state SUCCESS và tự redirect
      } catch (err) {
        toast.error(getErrorMessage(err, 'Có lỗi khi xử lý thanh toán! Vui lòng thử lại.'));
        setIsProcessing(false);
      }
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // [UX-02] Tính tổng tiền
  const totalAmount = order?.tickets?.length && ticketPrice
    ? ticketPrice * order.tickets.length
    : null;

  if (loading) return <div className="min-h-screen pt-32 text-center animate-pulse">Đang tải...</div>;

  return (
    <div className="pt-20 min-h-screen pb-24 relative overflow-hidden">
      {/* Background Security Mesh */}
      <div className="absolute inset-0 bg-slate-950 z-0">
        <div className="absolute inset-0 opacity-20 mix-blend-screen bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,1),rgba(2,6,23,1))]" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-primary/10 to-transparent blur-3xl opacity-30 pointer-events-none" />
      </div>

      <div className="max-w-4xl mx-auto px-6 relative z-10 pt-12">
        <div className="glass rounded-3xl p-8 md:p-12 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          
          {/* Lớp Overlay Xử Lý Thanh Toán (Processing State) */}
          {isProcessing && (
            <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center rounded-3xl">
              <div className="relative mb-6">
                <ShieldCheck className="w-20 h-20 text-primary relative z-10 animate-[pulse_1.5s_ease-in-out_infinite]" />
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <div className="absolute -inset-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
              <h3 className="text-2xl font-black text-white tracking-wider mb-2 text-glow">Đang xử lý mã hóa</h3>
              <p className="text-slate-300 font-medium">Bảo mật giao dịch bằng chuẩn AES-256...</p>
              <div className="mt-8 flex gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-10 relative z-10">
            <h1 className="text-4xl font-black mb-6 text-white tracking-tight">Thanh toán Đơn hàng</h1>
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-mono text-2xl font-bold border-2 transition-all duration-300 shadow-lg ${
              timeLeft <= 60
                ? 'bg-rose-500/20 text-rose-400 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.4)] animate-[pulse_0.5s_ease-in-out_infinite]'
                : 'bg-slate-800/50 text-emerald-400 border-emerald-500/30'
            }`}>
              <Clock className={`w-7 h-7 ${timeLeft <= 60 ? 'text-rose-400' : 'text-emerald-400'}`} />
              {formatTime(timeLeft)}
            </div>
            <p className="text-slate-400 mt-4 font-medium">Vui lòng hoàn tất giao dịch trước khi đếm ngược kết thúc.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
            {/* Order Details */}
            <div>
              <h2 className="text-xl font-bold mb-6 flex items-center border-b border-white/10 pb-4 text-white">
                <ShieldCheck className="w-6 h-6 mr-3 text-primary" /> Thông tin Đơn hàng
              </h2>
            <div className="space-y-4">
              <div className="flex justify-between text-slate-300">
                <span>Mã đơn hàng:</span>
                <span className="font-mono font-bold text-white">{order?.id.split('-')[0].toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Tài khoản mua:</span>
                <span className="font-bold text-white">{user?.email}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Số lượng vé:</span>
                <span className="font-bold text-white">{order?.tickets?.length} vé</span>
              </div>
              {order?.tickets && order.tickets.length > 0 && order.tickets[0].seat_label && (
                <div className="flex justify-between text-slate-300">
                  <span>Ghế của bạn:</span>
                  <span className="font-bold text-emerald-400">
                    {order.tickets.map((t: any) => t.seat_label).join(', ')}
                  </span>
                </div>
              )}

              {/* [UX-02] Price Breakdown */}
              {totalAmount !== null && (
                <div className="mt-6 pt-4 border-t border-slate-700 space-y-2">
                  <div className="flex justify-between text-slate-300 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4" />Đơn giá:
                    </span>
                    <span>{ticketPrice.toLocaleString('vi-VN')}đ / vé</span>
                  </div>
                  <div className="flex justify-between text-slate-300 text-sm">
                    <span>Số lượng:</span>
                    <span>× {order?.tickets?.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold mt-3 pt-3 border-t border-slate-600">
                    <span>Tổng cộng:</span>
                    <span className="text-primary text-2xl">{totalAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
              )}
              {/* Removed inline isProcessing box, replaced by full overlay above */}
            </div>
          </div>

            {/* Payment Methods */}
            <div>
              <h2 className="text-xl font-bold mb-6 flex items-center border-b border-white/10 pb-4 text-white">
                <Wallet className="w-6 h-6 mr-3 text-primary" /> Chọn phương thức
              </h2>

              <div className="space-y-4">
                <button
                  onClick={() => handlePayment()}
                  className="w-full flex items-center justify-between p-5 rounded-2xl border-2 border-white/5 bg-slate-800/40 hover:border-blue-500 hover:bg-blue-500/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center p-1 shadow-lg group-hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all">
                      <span className="text-blue-600 font-black tracking-tighter text-xl">VNPAY</span>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">Ví VNPAY / VNPAY-QR</div>
                      <div className="text-sm text-slate-400">Quét mã QR bằng ứng dụng ngân hàng</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handlePayment()}
                  className="w-full flex items-center justify-between p-5 rounded-2xl border-2 border-white/5 bg-slate-800/40 hover:border-pink-500 hover:bg-pink-500/10 hover:shadow-[0_0_20px_rgba(236,72,153,0.2)] transition-all duration-300 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center p-1 shadow-lg group-hover:shadow-[0_0_15px_rgba(236,72,153,0.4)] transition-all">
                      <span className="text-white font-black tracking-tighter text-lg">MoMo</span>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-lg text-white group-hover:text-pink-400 transition-colors">Ví điện tử MoMo</div>
                      <div className="text-sm text-slate-400">Thanh toán cực nhanh qua app</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
