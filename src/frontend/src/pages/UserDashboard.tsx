import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarDays, MapPin, Ticket as TicketIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/getErrorMessage';

export default function UserDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
      return;
    }

    axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/orders/my-tickets`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setOrders(res.data);
      setLoading(false);
    })
    .catch(err => {
      toast.error(getErrorMessage(err, 'Không thể tải danh sách vé. Vui lòng thử lại.'));
      setError('Không thể tải danh sách vé. Vui lòng thử lại.');
      setLoading(false);
    });
  }, [user, token, navigate]);

  if (loading) return (
    <div className="min-h-screen pt-32 text-center text-xl flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-primary font-bold text-glow animate-pulse">Đang truy xuất Két sắt vé...</span>
    </div>
  );
  if (error) return <div className="min-h-screen pt-32 text-center text-xl text-rose-500">{error}</div>;

  return (
    <div className="pt-20 min-h-screen pb-24 relative overflow-hidden">
      {/* Ambient Background & Security Mesh */}
      <div className="fixed inset-0 bg-slate-950 z-0">
        <div className="absolute inset-0 opacity-10 mix-blend-screen" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="absolute top-0 left-1/4 right-1/4 h-96 bg-gradient-to-b from-primary/20 to-transparent blur-3xl opacity-40 pointer-events-none" />
      </div>

      <div className="max-w-5xl mx-auto px-6 relative z-10 pt-12">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-5xl font-black tracking-tight mb-3 text-white text-glow">Ví Vé Của Tôi</h1>
          <p className="text-slate-300 text-lg font-medium">Bảo tàng kỹ thuật số lưu trữ tài sản và trải nghiệm của bạn.</p>
        </div>

        {orders.length === 0 ? (
          <div className="glass p-12 text-center rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <TicketIcon className="w-24 h-24 mx-auto text-slate-600 mb-6 animate-pulse" />
            <h2 className="text-2xl font-bold text-white mb-2">Chưa có vé nào trong ví!</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">Có vẻ như bạn chưa săn được tấm vé nào. Đừng bỏ lỡ những sự kiện âm nhạc đỉnh cao đang chờ đón bạn.</p>
            <button 
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-full font-bold hover:bg-primary-hover hover:scale-105 transition-all shadow-[0_0_20px_rgba(var(--color-primary),0.4)] hover:shadow-[0_0_30px_rgba(var(--color-primary),0.6)]"
            >
              <CalendarDays className="w-5 h-5" />
              Khám Phá Sự Kiện Ngay
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {orders.map(order => (
              <div key={order.id} className="relative group">
                {/* Glow effect behind the ticket */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-purple-500/30 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="glass rounded-[2rem] overflow-hidden border border-white/10 relative z-10">
                  {/* Status Ribbon */}
                  <div className="bg-slate-900/50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center border-b border-white/5 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Mã giao dịch</span>
                      <span className="font-mono text-lg font-bold text-white bg-white/5 px-3 py-1 rounded-lg">{order.id.split('-')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.status === 'SUCCESS' ? (
                        <>
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">Giao dịch thành công</span>
                        </>
                      ) : order.status === 'PENDING' ? (
                        <>
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                          </span>
                          <span className="text-amber-400 font-bold uppercase tracking-wider text-sm">Chờ thanh toán</span>
                        </>
                      ) : (
                        <>
                          <span className="relative flex h-3 w-3">
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                          </span>
                          <span className="text-rose-400 font-bold uppercase tracking-wider text-sm">Giao dịch thất bại</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={`p-0 ${order.status !== 'SUCCESS' ? 'opacity-50 grayscale' : ''}`}>
                    {order.tickets.length === 0 && order.status === 'FAILED' && (
                      <div className="p-8 lg:p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4 border border-rose-500/20">
                          <TicketIcon className="w-8 h-8 text-rose-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Đơn hàng đã bị hủy</h3>
                        <p className="text-slate-400 max-w-md mb-6">
                          Do quá thời gian chờ thanh toán (15 phút) hoặc giao dịch không thành công, các vé trong đơn hàng này đã được thu hồi lại hệ thống để người khác có thể mua.
                        </p>
                        
                        {order.ticket_snapshot && Array.isArray(order.ticket_snapshot) && (
                          <>
                            {/* Dotted Divider */}
                            <div className="w-full relative py-6 flex items-center justify-center">
                              <div className="absolute w-full border-t border-dashed border-white/10"></div>
                              <div className="bg-[#0b0f19] px-4 relative z-10 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Vé đã bị thu hồi
                              </div>
                            </div>

                            {/* Redesigned Snapshot UI */}
                            <div className="w-full space-y-4">
                              {order.ticket_snapshot.map((snap: any, idx: number) => (
                                <div key={idx} className="relative flex items-center bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden group">
                                  {/* Left side accent line */}
                                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-rose-500 to-rose-700 opacity-50"></div>
                                  
                                  <div className="p-5 flex-1 flex flex-col justify-center text-left pl-7">
                                    <h4 className="text-xl font-black text-white/80 leading-tight mb-1">{snap.concert_name}</h4>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{snap.type_name}</span>
                                  </div>
                                  
                                  {/* Cutout separating info and seat */}
                                  <div className="relative h-full flex items-center">
                                    <div className="w-px h-16 border-l border-dashed border-white/10"></div>
                                  </div>

                                  <div className="p-5 w-28 flex items-center justify-center flex-col bg-rose-500/[0.02]">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ghế</span>
                                    <span className="text-2xl font-black text-rose-500/80">{snap.seat_label}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {order.tickets.map((ticket: any, index: number) => {
                      const concert = ticket.ticket_types.concerts;
                      const dateObj = new Date(concert.start_time);
                      const formattedDate = dateObj.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                      const time = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div key={ticket.id} className={`flex flex-col lg:flex-row relative ${index !== order.tickets.length - 1 ? 'border-b border-white/5 border-dashed' : ''}`}>
                          
                          {/* Cutout details mimicking boarding pass (Left/Right) */}
                          <div className="hidden lg:block absolute top-1/2 -left-4 w-8 h-8 bg-slate-950 rounded-full transform -translate-y-1/2 border-r border-white/10 z-20"></div>
                          <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-8 bg-slate-950 rounded-full transform -translate-y-1/2 border-l border-white/10 z-20"></div>
                          
                          {/* Main Ticket Info Area */}
                          <div className="flex-1 p-8 lg:p-10 lg:pr-14 relative overflow-hidden">
                            {/* Decorative background watermark */}
                            <TicketIcon className="absolute -bottom-10 -right-10 w-64 h-64 text-white/[0.02] transform -rotate-12 pointer-events-none" />
                            
                            <h3 className="text-3xl font-black mb-6 text-white tracking-tight">{concert.name}</h3>
                            
                            <div className="grid grid-cols-2 gap-8 mb-8">
                              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Hạng vé</span>
                                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400 filter drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                                  {ticket.ticket_types.name} 
                                </span>
                              </div>
                              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Số ghế</span>
                                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 filter drop-shadow-[0_0_10px_rgba(192,38,211,0.3)]">
                                  {ticket.seat_label || 'Tự do'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-6 text-slate-300 bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg text-primary"><CalendarDays className="w-5 h-5" /></div>
                                <div>
                                  <div className="text-sm font-bold text-white">{time}</div>
                                  <div className="text-xs text-slate-400">{formattedDate}</div>
                                </div>
                              </div>
                              <div className="hidden sm:block w-px bg-white/10"></div>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><MapPin className="w-5 h-5" /></div>
                                <div>
                                  <div className="text-sm font-bold text-white">{concert.location || 'Đang cập nhật'}</div>
                                  <div className="text-xs text-slate-400">Địa điểm tổ chức</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* QR Code Section - The "Stub" */}
                          <div className="p-8 lg:p-10 flex flex-col items-center justify-center lg:border-l border-white/10 border-dashed bg-slate-900/30 relative">
                            {/* Subtle pulse ring behind QR */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
                            </div>
                            
                            <div 
                              className="relative p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] transform hover:scale-105 transition-transform duration-300 cursor-pointer group-hover:shadow-[0_0_50px_rgba(16,185,129,0.2)]"
                              onClick={() => setSelectedQr(ticket.qr_code)}
                            >
                              <QRCodeSVG 
                                value={ticket.qr_code}
                                size={140}
                                level="H"
                                includeMargin={false}
                              />
                            </div>
                            <div className="mt-6 text-center">
                              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 block">Mã bảo mật</span>
                              <span className="font-mono text-sm font-bold text-slate-300 bg-black/50 px-4 py-2 rounded-lg border border-white/5">
                                {ticket.qr_code.split('-')[0].toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action buttons for PENDING orders */}
                  {order.status === 'PENDING' && (
                    <div className="p-6 bg-slate-900/80 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-amber-400 text-sm font-medium">
                        Bạn có 15 phút để hoàn tất thanh toán trước khi vé bị hủy.
                      </p>
                      <button 
                        onClick={() => navigate(`/checkout/${order.id}`)}
                        className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-105 transition-all w-full sm:w-auto"
                      >
                        Tiếp tục thanh toán
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen QR Modal */}
      {selectedQr && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedQr(null)}
        >
          <div 
            className="bg-white p-8 md:p-12 rounded-3xl shadow-[0_0_100px_rgba(16,185,129,0.3)] transform transition-all animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 p-4 rounded-2xl mb-8">
              <QRCodeSVG 
                value={selectedQr}
                size={Math.min(window.innerWidth - 100, 350)}
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="text-center">
              <span className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 block">Mã bảo mật</span>
              <span className="font-mono text-3xl font-black text-slate-800 tracking-wider">
                {selectedQr.split('-')[0].toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
