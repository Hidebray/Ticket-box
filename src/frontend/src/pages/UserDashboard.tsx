import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarDays, MapPin, Ticket as TicketIcon } from 'lucide-react';

export default function UserDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
      return;
    }

    axios.get('http://localhost:3001/api/orders/my-tickets', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setOrders(res.data);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setError('Không thể tải danh sách vé. Vui lòng thử lại.');
      setLoading(false);
    });
  }, [user, token, navigate]);

  if (loading) return <div className="min-h-screen pt-32 text-center text-xl animate-pulse">Đang tải danh sách vé...</div>;
  if (error) return <div className="min-h-screen pt-32 text-center text-xl text-red-500">{error}</div>;

  return (
    <div className="pt-32 min-h-screen pb-24 px-6 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Vé của tôi</h1>
        <p className="text-slate-400 text-lg">Quản lý lịch sử mua vé và mã QR soát vé.</p>
      </div>

      {orders.length === 0 ? (
        <div className="p-10 text-center bg-slate-800 rounded-2xl border border-dashed border-slate-600 text-slate-400">
          Bạn chưa mua vé nào.
        </div>
      ) : (
        <div className="space-y-8">
          {orders.map(order => (
            <div key={order.id} className="bg-surface rounded-3xl overflow-hidden border border-slate-700 shadow-xl relative">
              <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
              
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-slate-700/50 pb-6 mb-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Mã đơn hàng</span>
                    <span className="font-mono text-lg text-slate-200">{order.id.split('-')[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Trạng thái</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/20 text-emerald-400">
                      {order.status === 'SUCCESS' ? 'Thành công' : order.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {order.tickets.map((ticket: any) => {
                    const concert = ticket.ticket_types.concerts;
                    const dateObj = new Date(concert.start_time);
                    const formattedDate = dateObj.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    const time = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={ticket.id} className="flex flex-col lg:flex-row bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden relative group">
                        
                        {/* Cutout details mimicking boarding pass */}
                        <div className="hidden lg:block absolute top-1/2 -left-3 w-6 h-6 bg-surface rounded-full transform -translate-y-1/2 border-r border-slate-700 z-10"></div>
                        <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-6 bg-surface rounded-full transform -translate-y-1/2 border-l border-slate-700 z-10"></div>
                        
                        <div className="flex-1 p-6 md:p-8 lg:pr-12 lg:border-r lg:border-dashed lg:border-slate-600">
                          <h3 className="text-2xl font-bold mb-4">{concert.name}</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Hạng vé</span>
                              <span className="text-lg font-bold text-primary flex items-center">
                                <TicketIcon className="w-5 h-5 mr-2" /> {ticket.ticket_types.name} 
                                {ticket.seat_label && <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-sm">Ghế: {ticket.seat_label}</span>}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Trạng thái vé</span>
                              <span className={`text-lg font-bold ${ticket.status === 'AVAILABLE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {ticket.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-6 text-slate-300">
                            <div className="flex items-center"><CalendarDays className="w-5 h-5 mr-2 text-slate-400" /> {time} - {formattedDate}</div>
                            <div className="flex items-center"><MapPin className="w-5 h-5 mr-2 text-slate-400" /> Vui lòng kiểm tra địa điểm</div>
                          </div>
                        </div>

                        {/* QR Code Section */}
                        <div className="p-6 md:p-8 flex flex-col items-center justify-center bg-white">
                          <QRCodeSVG 
                            value={ticket.qr_code}
                            size={160}
                            level="H"
                            includeMargin={true}
                          />
                          <span className="mt-4 text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-md">
                            {ticket.qr_code.split('-')[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
