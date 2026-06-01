import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Wallet, ShieldCheck } from 'lucide-react';

export default function Checkout() {
  const { id } = useParams(); // orderId
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const pollingInterval = useRef<any>(null);

  // 1. Fetch Order
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrder(res.data);
        
        // Cập nhật lại thời gian đếm ngược thực tế từ created_at
        const createdAt = new Date(res.data.created_at).getTime();
        const now = Date.now();
        const diffSeconds = Math.floor((15 * 60 * 1000 - (now - createdAt)) / 1000);
        
        if (diffSeconds <= 0 || res.data.status === 'FAILED') {
          alert('Đơn hàng đã hết hạn hoặc bị hủy!');
          navigate('/');
        } else if (res.data.status === 'SUCCESS') {
          navigate('/dashboard');
        } else {
          setTimeLeft(diffSeconds);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        alert('Không tìm thấy đơn hàng');
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
          alert('Hết thời gian giữ vé!');
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, timeLeft, navigate]);

  // 3. Polling Webhook (Nếu đang xử lý thanh toán)
  useEffect(() => {
    if (!isProcessing) return;

    pollingInterval.current = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:3001/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.status === 'SUCCESS') {
          clearInterval(pollingInterval.current);
          alert('Thanh toán thành công! Vé đã được chuyển vào Ví của bạn.');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Polling error', error);
      }
    }, 3000); // Poll mỗi 3 giây

    return () => clearInterval(pollingInterval.current);
  }, [isProcessing, id, token, navigate]);

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // Lưu ý: Đây là nơi gọi API tạo Payment URL từ VNPAY/MoMo SDK.
    // Vì chưa có Secret Keys thật, hệ thống tạm mô phỏng việc gọi Webhook báo thành công sau 2s.
    setTimeout(async () => {
      try {
        await axios.post('http://localhost:3001/api/webhooks/payment', {
          orderId: id,
          status: 'SUCCESS'
        });
        // Webhook gọi thành công, cơ chế Polling sẽ bắt được state SUCCESS và tự redirect
      } catch (err) {
        console.error('Webhook failed', err);
        alert('Có lỗi khi xử lý thanh toán!');
        setIsProcessing(false);
      }
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) return <div className="min-h-screen pt-32 text-center">Đang tải...</div>;

  return (
    <div className="pt-32 min-h-screen pb-24 px-6 max-w-4xl mx-auto">
      <div className="bg-surface rounded-3xl p-8 md:p-12 border border-slate-700 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-4">Thanh toán Đơn hàng</h1>
          <div className="inline-flex items-center gap-3 bg-red-500/10 text-red-400 px-6 py-3 rounded-full font-mono text-xl font-bold border border-red-500/30">
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
            </div>

            {isProcessing && (
              <div className="mt-8 p-6 bg-slate-800/80 rounded-xl border border-primary/50 text-center animate-pulse">
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
