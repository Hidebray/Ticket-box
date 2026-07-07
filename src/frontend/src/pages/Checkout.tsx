import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Wallet, ShieldCheck, Tag } from 'lucide-react';

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
        console.error(err);
        toast.error('Không tìm thấy đơn hàng');
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
        console.error('Error parsing SSE data', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
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
        console.error('Mock payment failed', err);
        toast.error('Có lỗi khi xử lý thanh toán! Vui lòng thử lại.');
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
    <div className="pt-32 min-h-screen pb-24 px-6 max-w-4xl mx-auto">
      <div className="bg-surface rounded-3xl p-8 md:p-12 border border-slate-700 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-4">Thanh toán Đơn hàng</h1>
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full font-mono text-xl font-bold border transition-colors ${
            timeLeft <= 60
              ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            <Clock className="w-6 h-6 animate-pulse" />
            {formatTime(timeLeft)}
          </div>
          <p className="text-slate-400 mt-4 text-sm">Vui lòng hoàn tất thanh toán trong thời gian giữ vé.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Order Details */}
          <div>
            <h2 className="text-xl font-bold mb-6 flex items-center border-b border-slate-700 pb-4">
              <ShieldCheck className="w-5 h-5 mr-2 text-primary" /> Thông tin Đơn hàng
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
            </div>

            {isProcessing && (
              <div className="mt-8 p-6 bg-slate-800/80 rounded-xl border border-primary/50 text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-primary font-bold">Đang chờ xác nhận thanh toán...</p>
                <p className="text-sm text-slate-400 mt-2">Vui lòng không đóng trình duyệt.</p>
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className={`transition-opacity ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="text-xl font-bold mb-6 flex items-center border-b border-slate-700 pb-4">
              <Wallet className="w-5 h-5 mr-2 text-primary" /> Chọn phương thức
            </h2>

            <div className="space-y-4">
              <button
                onClick={() => handlePayment()}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-600 hover:border-blue-500 hover:bg-blue-500/10 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1">
                    <span className="text-blue-600 font-black tracking-tighter text-xl">VNPAY</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold group-hover:text-blue-400 transition-colors">Ví VNPAY / VNPAY-QR</div>
                    <div className="text-xs text-slate-400">Quét mã QR bằng ứng dụng ngân hàng</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handlePayment()}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-slate-600 hover:border-pink-500 hover:bg-pink-500/10 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center p-1">
                    <span className="text-white font-black tracking-tighter text-lg">MoMo</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold group-hover:text-pink-400 transition-colors">Ví điện tử MoMo</div>
                    <div className="text-xs text-slate-400">Thanh toán nhanh qua ứng dụng MoMo</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
