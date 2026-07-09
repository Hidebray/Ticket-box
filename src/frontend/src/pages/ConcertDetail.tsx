import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CalendarDays, MapPin, Ticket, ArrowLeft, CheckCircle2 } from 'lucide-react';
import InteractiveSeatingMap from '../components/InteractiveSeatingMap';
import { useAuth } from '../contexts/AuthContext';
import gsap from 'gsap';
import { getErrorMessage } from '../utils/getErrorMessage';


interface TicketType {
  id: string;
  name: string;
  price: string | number;
  remaining_quantity: number;
  max_per_user?: number;
}

interface Concert {
  id: string;
  name: string;
  description: string;
  start_time: string;
  status: string;
  location: string;
  seating_map: any;
  ticket_types: TicketType[];
}

export default function ConcertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [concert, setConcert] = useState<Concert | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null); // [BUG-01] Dùng ID thay vì name
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [selectedSeatLabels, setSelectedSeatLabels] = useState<string[]>([]);

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);
    
    axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts/${id}`)
      .then(res => {
        setConcert(res.data);
        setLoading(false);
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Lỗi tải thông tin sự kiện'));
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!loading && concert) {
      gsap.fromTo('.concert-title', 
        { opacity: 0, y: 30 }, 
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
      );
      gsap.fromTo('.concert-meta', 
        { opacity: 0, y: 20 }, 
        { opacity: 1, y: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' }
      );
      gsap.fromTo('.concert-left-col', 
        { opacity: 0, x: -30 }, 
        { opacity: 1, x: 0, duration: 0.8, delay: 0.3, ease: 'power3.out' }
      );
      gsap.fromTo('.concert-right-col', 
        { opacity: 0, x: 30 }, 
        { opacity: 1, x: 0, duration: 0.8, delay: 0.3, ease: 'power3.out' }
      );
    }
  }, [loading, concert]);

  // [BUG-01] Tìm ticket object bằng UUID, không phải tên
  const selectedTicketObj = (concert && selectedTypeId)
    ? concert.ticket_types.find(t => t.id === selectedTypeId)
    : null;

  // Release on Unload (Auto Unhold)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!concert || !selectedTicketObj || selectedTicketIds.length === 0) return;
      
      const token = localStorage.getItem('token');
      if (!token) return;

      selectedTicketIds.forEach(ticketId => {
        // Use fetch with keepalive to ensure the request is sent even when the page is unloading
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts/${concert.id}/zones/${selectedTicketObj.id}/tickets/${ticketId}/unhold`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          keepalive: true
        }).catch(() => {}); // ignore errors on unload
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [concert, selectedTicketObj, selectedTicketIds]);

  if (loading) return <div className="min-h-screen pt-32 text-center text-xl animate-pulse">Đang tải thông tin sự kiện...</div>;
  if (!concert) return <div className="min-h-screen pt-32 text-center text-xl text-red-500">Sự kiện không tồn tại hoặc đã bị gỡ.</div>;

  const dateObj = new Date(concert.start_time);
  const formattedDate = dateObj.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="pt-20 min-h-screen pb-24">
      {/* Hero Banner Area */}
      <div className="relative h-[40vh] md:h-[50vh] w-full bg-slate-900 overflow-hidden">
        {/* Real image background */}
        <img src="/concert_edm.png" className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-screen scale-105 animate-[pulse_10s_ease-in-out_infinite]" />
        
        {/* Deep Dark Gradient from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
        <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-0" />
        
        <div className="absolute z-20 bottom-10 left-6 md:left-24 max-w-3xl">
          <button onClick={() => navigate('/')} className="glass text-white px-5 py-2.5 rounded-full mb-8 text-sm font-semibold flex items-center transition-all hover:scale-105 hover:bg-white/20 shadow-lg">
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại danh sách
          </button>
          <h1 className="concert-title text-5xl md:text-7xl font-black tracking-tighter leading-tight mb-4 text-glow text-white">{concert.name}</h1>
          <div className="concert-meta flex flex-wrap gap-6 text-slate-300 font-medium">
            <div className="flex items-center bg-white/5 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10"><CalendarDays className="w-5 h-5 mr-2 text-primary" /> {time} - {formattedDate}</div>
            <div className="flex items-center bg-white/5 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10"><MapPin className="w-5 h-5 mr-2 text-primary" /> {concert.location || 'Đang cập nhật'}</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Bio & Map */}
        <div className="concert-left-col lg:col-span-8 space-y-12">

          
          {/* Bio Section */}
          <section>
            <h2 className="text-3xl font-black mb-6 flex items-center border-b-2 border-primary/30 pb-4 inline-flex">
              <span className="bg-primary/20 text-primary p-2 rounded-xl mr-4 shadow-[0_0_15px_rgba(244,63,94,0.3)]">🎤</span> Giới thiệu Nghệ sĩ & Sự kiện
            </h2>
            <div className="prose prose-invert prose-slate max-w-none text-slate-300 leading-relaxed bg-surface p-8 rounded-2xl border border-slate-700/50">
              {concert.description}
            </div>
          </section>

          {/* Seating Map Section */}
          <section>
            <h2 className="text-3xl font-black mb-6 flex items-center border-b-2 border-primary/30 pb-4 inline-flex">
              <span className="bg-primary/20 text-primary p-2 rounded-xl mr-4 shadow-[0_0_15px_rgba(244,63,94,0.3)]">🗺️</span> Sơ đồ Chỗ ngồi
            </h2>
            {selectedTicketObj && concert.seating_map && (concert.seating_map as any)[selectedTicketObj.id] ? (
              <InteractiveSeatingMap 
                concertId={concert.id}
                ticketTypeId={selectedTicketObj.id}
                mapConfig={(concert.seating_map as any)[selectedTicketObj.id]}
                selectedTicketIds={selectedTicketIds}
                maxPerUser={selectedTicketObj.max_per_user || 1}
                onToggleSeat={async (ticketId, seatLabel) => {
                  if (!user) {
                    toast.error('Vui lòng đăng nhập để chọn ghế');
                    navigate('/login');
                    return;
                  }

                  const isSelecting = !selectedTicketIds.includes(ticketId);
                  
                  try {
                    if (isSelecting) {
                      await axios.post(
                        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts/${concert.id}/zones/${selectedTicketObj.id}/tickets/${ticketId}/hold`,
                        {},
                        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                      );
                    } else {
                      await axios.post(
                        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts/${concert.id}/zones/${selectedTicketObj.id}/tickets/${ticketId}/unhold`,
                        {},
                        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                      );
                    }
                    
                    setSelectedTicketIds(prev => {
                      if (prev.includes(ticketId)) return prev.filter(id => id !== ticketId);
                      return [...prev, ticketId];
                    });
                    setSelectedSeatLabels(prev => {
                      if (prev.includes(seatLabel)) return prev.filter(label => label !== seatLabel);
                      return [...prev, seatLabel];
                    });
                  } catch (error: any) {
                    toast.error(error.response?.data?.message || 'Không thể chọn ghế này, có thể ai đó đã nhanh tay hơn!');
                  }
                }}
              />
            ) : (
              <div className="p-10 text-center bg-slate-800 rounded-xl border border-dashed border-slate-600 text-slate-400">
                {selectedTypeId ? 'Khu vực này không có thiết lập sơ đồ ghế chính xác.' : 'Vui lòng chọn 1 hạng vé ở danh sách bên phải để xem sơ đồ.'}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Ticket Selection */}
        <div className="concert-right-col lg:col-span-4 relative z-20">

          <div className="sticky top-24 glass rounded-3xl border border-white/10 p-8 shadow-2xl backdrop-blur-xl">
            <h2 className="text-2xl font-black mb-6 border-b border-white/10 pb-4">Chọn Hạng Vé</h2>
            
            <div className="space-y-4 mb-8">
              {concert.ticket_types.map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => {
                    if (selectedTypeId !== ticket.id) {
                      setSelectedTypeId(ticket.id);
                      setSelectedTicketIds([]);
                      setSelectedSeatLabels([]);
                    }
                  }}
                  className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 ${
                    selectedTypeId === ticket.id
                      ? 'border-primary bg-primary/20 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                      : 'border-white/10 bg-slate-800/40 hover:border-white/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      {ticket.name}
                      {selectedTypeId === ticket.id && <CheckCircle2 className="w-5 h-5 text-primary" />}
                    </h3>
                    <span className="font-black text-xl text-white">{Number(ticket.price).toLocaleString('vi-VN')}đ</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mt-4">
                    <span className="flex items-center text-slate-400">
                      <Ticket className="w-4 h-4 mr-1.5" />
                      Vé điện tử
                    </span>
                    <span className={`font-medium px-2.5 py-1 rounded-md ${ticket.remaining_quantity > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {ticket.remaining_quantity > 0 ? `Còn ${ticket.remaining_quantity} vé` : 'Hết vé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>



            <div className="mb-4">
              {selectedTicketIds.length > 0 && (
                <div className="text-sm font-bold text-slate-300">
                  Ghế đã chọn: <span className="text-emerald-400">{selectedSeatLabels.join(', ')}</span>
                  <div className="mt-1 text-slate-400">Tổng tiền: {(selectedTicketIds.length * Number(selectedTicketObj?.price || 0)).toLocaleString('vi-VN')}đ</div>
                </div>
              )}
            </div>

            <button 
              onClick={async () => {
                if (!user) {
                  navigate('/login');
                  return;
                }
                
                if (!selectedTicketObj) return;

                if (selectedTicketIds.length === 0) {
                  toast.error('Vui lòng chọn ít nhất 1 ghế trên sơ đồ!');
                  return;
                }

                setIsSubmitting(true);
                
                const idempotencyKey = crypto.randomUUID();

                try {
                  const res = await axios.post(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/orders`, 
                    {
                      ticketTypeId: selectedTicketObj.id,
                      ticketIds: selectedTicketIds
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                        'Idempotency-Key': idempotencyKey
                      }
                    }
                  );
                  
                  navigate(`/checkout/${res.data.data.orderId}`);
                  
                } catch (error: any) {
                  if (error.response?.status === 429) {
                    toast.error('Hệ thống đang rất đông, vui lòng không tải lại trang...');
                    setTimeout(() => setIsSubmitting(false), 3000);
                  } else {
                    toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn hàng!');
                    setIsSubmitting(false);
                  }
                }
              }}
              disabled={!selectedTicketObj || selectedTicketIds.length === 0 || isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center transition-all duration-300 relative overflow-hidden group/btn ${
                selectedTicketObj && selectedTicketIds.length > 0 && !isSubmitting
                  ? 'bg-primary text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] cursor-pointer transform hover:scale-[1.02] hover:bg-rose-500 animate-pulse'
                  : 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                {isSubmitting 
                  ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Đang xử lý...</>
                  : selectedTicketObj 
                    ? (selectedTicketIds.length > 0 ? `Thanh toán ${selectedTicketIds.length} vé ngay` : 'Vui lòng chọn ghế trên sơ đồ') 
                    : 'Vui lòng chọn hạng vé'
                }
              </span>
              {selectedTicketObj && selectedTicketIds.length > 0 && !isSubmitting && (
                <div className="absolute top-0 -inset-full h-full w-1/2 z-0 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover/btn:animate-shine" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
