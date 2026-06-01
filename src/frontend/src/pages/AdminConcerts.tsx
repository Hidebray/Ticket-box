import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Ticket, Grid } from 'lucide-react';
import SeatingMapBuilder from '../components/admin/SeatingMapBuilder';

export default function AdminConcerts() {
  const { token } = useAuth();
  const [concerts, setConcerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States for Concert Form Modal
  const [showConcertModal, setShowConcertModal] = useState(false);
  const [currentConcert, setCurrentConcert] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', start_time: '', status: 'DRAFT' });

  // States for Ticket Type Modal
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [activeConcertId, setActiveConcertId] = useState<string | null>(null);
  const [ticketData, setTicketData] = useState({ name: '', price: '', total_quantity: '', max_per_user: '' });

  // States for Seating Map Modal
  const [showMapModal, setShowMapModal] = useState(false);
  const [activeTicketType, setActiveTicketType] = useState<any>(null);

  const fetchConcerts = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/admin/concerts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConcerts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConcerts();
  }, [token]);

  const handleSaveConcert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentConcert) {
        await axios.put(`http://localhost:3001/api/admin/concerts/${currentConcert.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:3001/api/admin/concerts', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowConcertModal(false);
      fetchConcerts();
    } catch (err) {
      alert('Lỗi lưu sự kiện');
    }
  };

  const handleSaveTicketType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/admin/ticket-types', {
        concert_id: activeConcertId,
        ...ticketData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowTicketModal(false);
      fetchConcerts();
    } catch (err) {
      alert('Lỗi thêm loại vé');
    }
  };

  if (loading) return <div className="text-white">Đang tải...</div>;

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Quản lý Sự kiện</h1>
        <button 
          onClick={() => { setCurrentConcert(null); setFormData({ name: '', description: '', start_time: '', status: 'DRAFT' }); setShowConcertModal(true); }}
          className="bg-primary hover:bg-rose-600 px-4 py-2 rounded-xl flex items-center gap-2 font-bold"
        >
          <Plus className="w-5 h-5" /> Thêm Sự kiện
        </button>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-700/50 text-slate-300">
            <tr>
              <th className="p-4">Tên sự kiện</th>
              <th className="p-4">Thời gian</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4">Loại vé</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {concerts.map(concert => (
              <tr key={concert.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="p-4 font-bold">{concert.name}</td>
                <td className="p-4 text-slate-400">{new Date(concert.start_time).toLocaleString('vi-VN')}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${concert.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {concert.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    {concert.ticket_types?.map((tt: any) => (
                      <div key={tt.id} className="flex items-center gap-2">
                        <span className="text-xs bg-slate-700 px-2 py-1 rounded-md text-slate-300 inline-block">
                          {tt.name} ({tt.total_quantity} vé) - Max: {tt.max_per_user}
                        </span>
                        <button 
                          onClick={() => { setActiveConcertId(concert.id); setActiveTicketType(tt); setShowMapModal(true); }}
                          className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                          title="Sơ đồ ghế"
                        >
                          <Grid className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button 
                    onClick={() => { setActiveConcertId(concert.id); setTicketData({ name: '', price: '', total_quantity: '', max_per_user: '' }); setShowTicketModal(true); }}
                    className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors" title="Thêm loại vé"
                  >
                    <Ticket className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => { 
                      setCurrentConcert(concert); 
                      setFormData({ name: concert.name, description: concert.description, start_time: new Date(concert.start_time).toISOString().slice(0, 16), status: concert.status }); 
                      setShowConcertModal(true); 
                    }}
                    className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors" title="Sửa sự kiện"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Sự kiện */}
      {showConcertModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-lg border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">{currentConcert ? 'Sửa Sự kiện' : 'Thêm Sự kiện Mới'}</h2>
            <form onSubmit={handleSaveConcert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tên sự kiện</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Mô tả</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" rows={3}></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Thời gian bắt đầu</label>
                <input required type="datetime-local" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Trạng thái</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white">
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowConcertModal(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors">Hủy</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-primary hover:bg-rose-600 rounded-xl font-bold transition-colors">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Loại Vé */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-lg border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Thêm Hạng Vé</h2>
            <form onSubmit={handleSaveTicketType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tên hạng vé (VD: VIP, GA)</label>
                <input required type="text" value={ticketData.name} onChange={e => setTicketData({...ticketData, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Giá tiền (VNĐ)</label>
                <input required type="number" min="0" value={ticketData.price} onChange={e => setTicketData({...ticketData, price: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Tổng số vé (Tùy chọn nếu dùng Map)</label>
                  <input type="number" min="1" value={ticketData.total_quantity} onChange={e => setTicketData({...ticketData, total_quantity: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Tối đa/Tài khoản</label>
                  <input required type="number" min="1" value={ticketData.max_per_user} onChange={e => setTicketData({...ticketData, max_per_user: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowTicketModal(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors">Hủy</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl font-bold transition-colors">Thêm vé</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sơ đồ ghế */}
      {showMapModal && activeConcertId && activeTicketType && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl relative">
            <button 
              onClick={() => setShowMapModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              Đóng
            </button>
            <h2 className="text-2xl font-bold mb-2">Sơ đồ ghế: {activeTicketType.name}</h2>
            <p className="text-slate-400 mb-6">Kéo thả để thiết kế. Lưu ý: Lần lưu tiếp theo sẽ reset lại các ghế chưa bán!</p>
            
            <SeatingMapBuilder 
              concertId={activeConcertId}
              ticketTypeId={activeTicketType.id}
              initialRows={activeTicketType.seating_map?.rows || 10}
              initialCols={activeTicketType.seating_map?.cols || 20}
              initialDisabled={activeTicketType.seating_map?.disabledSeats || []}
              onSave={() => {
                setShowMapModal(false);
                fetchConcerts();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
