import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CalendarDays, MapPin, Ticket, AlertCircle } from 'lucide-react';
import InteractiveSeatingMap from '../components/InteractiveSeatingMap';
import { useAuth } from '../contexts/AuthContext';
import gsap from 'gsap';


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
  seating_map: any;
  ticket_types: TicketType[];
}

export default function ConcertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [concert, setConcert] = useState<Concert | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [selectedSeatLabels, setSelectedSeatLabels] = useState<string[]>([]);

  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);
    
    axios.get(`http://localhost:3001/api/concerts/${id}`)
      .then(res => {
        setConcert(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
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


  if (loading) return <div className="min-h-screen pt-32 text-center text-xl animate-pulse">Đang tải thông tin sự kiện...</div>;
  if (!concert) return <div className="min-h-screen pt-32 text-center text-xl text-red-500">Sự kiện không tồn tại hoặc đã bị gỡ.</div>;

  const dateObj = new Date(concert.start_time);
  const formattedDate = dateObj.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Get selected ticket object
  const selectedTicketObj = selectedType 
    ? concert.ticket_types.find(t => selectedType.includes(t.name) || t.name.includes(selectedType)) 
    : null;

  return (
    <div className="pt-20 min-h-screen pb-24">
      {/* Hero Banner Area */}
      <div className="relative h-72 md:h-96 w-full bg-slate-800 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-primary/20 mix-blend-overlay z-0" />
        <div className="absolute z-20 bottom-10 left-6 md:left-24 max-w-3xl">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white mb-6 text-sm flex items-center transition-colors">
            ← Quay lại danh sách
          </button>
          <h1 className="concert-title text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-4">{concert.name}</h1>
          <div className="concert-meta flex flex-wrap gap-6 text-slate-300">
            <div className="flex items-center"><CalendarDays className="w-5 h-5 mr-2 text-primary" /> {time} - {formattedDate}</div>
            <div className="flex items-center"><MapPin className="w-5 h-5 mr-2 text-primary" /> Xem bản đồ địa điểm</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Bio & Map */}
        <div className="concert-left-col lg:col-span-8 space-y-12">

          
          {/* Bio Section */}
          <section>
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <span className="bg-primary/20 text-primary p-2 rounded-lg mr-3">🎤</span> Giới thiệu Nghệ sĩ & Sự kiện
            </h2>
            <div className="prose prose-invert prose-slate max-w-none text-slate-300 leading-relaxed bg-surface p-8 rounded-2xl border border-slate-700/50">
              {concert.description}
            </div>
          </section>

          {/* Seating Map Section */}
          <section>
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <span className="bg-primary/20 text-primary p-2 rounded-lg mr-3">🗺️</span> Sơ đồ Chỗ ngồi
            </h2>
            {selectedTicketObj && concert.seating_map && (concert.seating_map as any)[selectedTicketObj.id] ? (
              <InteractiveSeatingMap 
                concertId={concert.id}
                ticketTypeId={selectedTicketObj.id}
                mapConfig={(concert.seating_map as any)[selectedTicketObj.id]}
                selectedTicketIds={selectedTicketIds}
                maxPerUser={selectedTicketObj.max_per_user || 1}
                onToggleSeat={(ticketId, seatLabel) => {
                  setSelectedTicketIds(prev => {
                    if (prev.includes(ticketId)) return prev.filter(id => id !== ticketId);
                    return [...prev, ticketId];
                  });
                  setSelectedSeatLabels(prev => {
                    if (prev.includes(seatLabel)) return prev.filter(label => label !== seatLabel);
                    return [...prev, seatLabel];
                  });
                }}
              />
            ) : (
              <div className="p-10 text-center bg-slate-800 rounded-xl border border-dashed border-slate-600 text-slate-400">
                {selectedType ? 'Khu vực này không có thiết lập sơ đồ ghế chính xác.' : 'Vui lòng chọn 1 hạng vé ở danh sách bên phải để xem sơ đồ.'}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Ticket Selection */}
        <div className="concert-right-col lg:col-span-4">

          <div className="sticky top-24 bg-surface rounded-2xl border border-slate-700 p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-6">Chọn Hạng Vé</h2>
            
            <div className="space-y-4 mb-8">
              {concert.ticket_types.map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => {
                    if (selectedType !== ticket.name) {
                      setSelectedType(ticket.name);
                      setSelectedTicketIds([]);
                      setSelectedSeatLabels([]);
                    }
                  }}
                  className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    (selectedType && (selectedType.includes(ticket.name) || ticket.name.includes(selectedType)))
                      ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{ticket.name}</h3>
                    <span className="font-bold text-primary">{Number(ticket.price).toLocaleString('vi-VN')}đ</span>
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

            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl flex items-start gap-3 mb-8 text-blue-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-blue-400" />
              <p>Số lượng vé hiển thị mang tính tương đối tại thời điểm tải trang do có thể có khách hàng khác đang thanh toán.</p>
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
                  alert('Vui lòng chọn ít nhất 1 ghế trên sơ đồ!');
                  return;
                }

                setIsSubmitting(true);
                
                const idempotencyKey = crypto.randomUUID();

                try {
                  const res = await axios.post(
                    'http://localhost:3001/api/orders', 
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
                    alert('Hệ thống đang rất đông, vui lòng không tải lại trang, chúng tôi đang xử lý yêu cầu của bạn...');
                    setTimeout(() => setIsSubmitting(false), 3000);
                  } else {
                    alert(error.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn hàng!');
                    setIsSubmitting(false);
                  }
                }
              }}
              disabled={!selectedTicketObj || selectedTicketIds.length === 0 || isSubmitting}
              className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center transition-all duration-300 ${
                selectedTicketObj && selectedTicketIds.length > 0 && !isSubmitting
                  ? 'bg-primary hover:bg-rose-600 text-white shadow-lg hover:shadow-primary/50 cursor-pointer transform hover:-translate-y-1'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting 
                ? <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Đang xử lý...</span>
                : selectedTicketObj 
                  ? (selectedTicketIds.length > 0 ? `Thanh toán ${selectedTicketIds.length} vé` : 'Vui lòng chọn ghế trên sơ đồ') 
                  : 'Vui lòng chọn hạng vé'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
