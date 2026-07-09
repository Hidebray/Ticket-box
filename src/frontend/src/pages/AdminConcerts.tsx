import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Ticket, Grid, Sparkles, FileText, Check, Trash2 } from 'lucide-react';
import SeatingMapBuilder from '../components/admin/SeatingMapBuilder';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/getErrorMessage';


export default function AdminConcerts() {
  const { token } = useAuth();
  const [concerts, setConcerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States for Concert Form Modal
  const [showConcertModal, setShowConcertModal] = useState(false);
  const [currentConcert, setCurrentConcert] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', location: '', start_time: '', status: 'DRAFT' });

  // States for Ticket Type Modal
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [activeConcertId, setActiveConcertId] = useState<string | null>(null);
  const [ticketData, setTicketData] = useState({ name: '', price: '', total_quantity: '', max_per_user: '' });

  // States for Seating Map Modal
  const [showMapModal, setShowMapModal] = useState(false);
  const [activeTicketType, setActiveTicketType] = useState<any>(null);

  // States for AI Bio Modal
  const [showBioModal, setShowBioModal] = useState(false);
  const [activeConcert, setActiveConcert] = useState<any>(null);
  const [bioFile, setBioFile] = useState<File | null>(null);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [generatedBio, setGeneratedBio] = useState('');
  const [bioStep, setBioStep] = useState('');


  const fetchConcerts = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/concerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConcerts(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách sự kiện'));
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
      const payload = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString()
      };

      if (currentConcert) {
        await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/concerts/${currentConcert.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/concerts`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowConcertModal(false);
      toast.success(currentConcert ? 'Cập nhật sự kiện thành công!' : 'Thêm sự kiện thành công!');
      fetchConcerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi lưu sự kiện');
    }
  };

  const handleSaveTicketType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/ticket-types`, {
        concert_id: activeConcertId,
        ...ticketData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowTicketModal(false);
      toast.success('Thêm loại vé thành công!');
      fetchConcerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi thêm loại vé');
    }
  };

  const handleUploadBio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bioFile || !activeConcert) return;

    setIsGeneratingBio(true);
    setGeneratedBio('');
    setBioStep('Đang tải lên và trích xuất PDF...');

    const bioFormData = new FormData();
    bioFormData.append('file', bioFile);

    const stepInterval = setInterval(() => {
      setBioStep(prev => {
        if (prev.includes('trích xuất')) return 'Mô hình AI đang phân tích nội dung...';
        if (prev.includes('phân tích')) return 'Đang tổng hợp bản giới thiệu nghệ sĩ...';
        return 'Sắp hoàn thành...';
      });
    }, 2500);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/concerts/${activeConcert.id}/upload-bio`,
        bioFormData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      clearInterval(stepInterval);
      setGeneratedBio(res.data.bio);
      setIsGeneratingBio(false);
      toast.success('AI đã viết xong! Vui lòng kiểm tra và lưu lại.');
    } catch (err: any) {
      clearInterval(stepInterval);
      toast.error(err.response?.data?.message || 'Lỗi khi tạo AI Bio');
      setIsGeneratingBio(false);
    }
  };

  const handleSaveBio = async () => {
    if (!activeConcert || !generatedBio) return;
    try {
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/concerts/${activeConcert.id}`, {
        name: activeConcert.name,
        description: generatedBio,
        location: activeConcert.location,
        start_time: activeConcert.start_time,
        status: activeConcert.status
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Đã lưu nội dung Bio vào sự kiện!');
      setShowBioModal(false);
      fetchConcerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu Bio');
    }
  };

  const handleDeleteConcert = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sự kiện này? Hành động này không thể hoàn tác.')) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/concerts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Xóa sự kiện thành công!');
      fetchConcerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa sự kiện');
    }
  };

  const handleDeleteTicketType = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hạng vé này?')) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/ticket-types/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Xóa hạng vé thành công!');
      fetchConcerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa hạng vé');
    }
  };


  if (loading) return <div className="text-white">Đang tải...</div>;

  return (
    <div className="text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Quản lý Sự kiện</h1>
        <button 
          onClick={() => { setCurrentConcert(null); setFormData({ name: '', description: '', location: '', start_time: '', status: 'DRAFT' }); setShowConcertModal(true); }}
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
                  <div className="flex flex-wrap gap-2">
                    {concert.ticket_types?.map((tt: any) => (
                      <div key={tt.id} className="flex items-center gap-1 bg-slate-700/50 pr-1 pl-3 py-1 rounded-lg border border-slate-600">
                        <span className="text-xs font-medium text-slate-300">
                          {tt.name} ({tt.total_quantity})
                        </span>
                        {tt.type !== 'GUEST' && (
                          <button 
                            onClick={() => { setActiveConcert(concert); setActiveConcertId(concert.id); setActiveTicketType(tt); setShowMapModal(true); }}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-md transition-colors"
                            title="Sơ đồ ghế"
                          >
                            <Grid className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteTicketType(tt.id)}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-md transition-colors"
                          title="Xóa hạng vé"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                      setActiveConcert(concert);
                      setBioFile(null);
                      setGeneratedBio('');
                      setIsGeneratingBio(false);
                      setShowBioModal(true);
                    }}
                    className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors" title="Tải lên Press Kit & Tạo AI Bio"
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => { 
                      setCurrentConcert(concert); 
                      setFormData({ name: concert.name, description: concert.description, location: concert.location || '', start_time: new Date(concert.start_time).toISOString().slice(0, 16), status: concert.status }); 
                      setShowConcertModal(true); 
                    }}
                    className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors" title="Sửa sự kiện"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteConcert(concert.id)}
                    className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors" title="Xóa sự kiện"
                  >
                    <Trash2 className="w-5 h-5" />
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
                <label className="block text-sm font-medium text-slate-400 mb-1">Địa điểm</label>
                <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white" />
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
              initialRows={activeConcert?.seating_map?.[activeTicketType.id]?.rows || (activeTicketType.total_quantity ? Math.ceil(activeTicketType.total_quantity / Math.min(10, activeTicketType.total_quantity)) : 10)}
              initialCols={activeConcert?.seating_map?.[activeTicketType.id]?.cols || (activeTicketType.total_quantity ? Math.min(10, activeTicketType.total_quantity) : 20)}
              initialDisabled={activeConcert?.seating_map?.[activeTicketType.id]?.disabledSeats || []}
              onSave={() => {
                setShowMapModal(false);
                fetchConcerts();
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Tải lên Press Kit và tạo AI Bio */}
      {showBioModal && activeConcert && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700/80 p-8 rounded-3xl w-full max-w-2xl shadow-2xl relative">
            <button 
              onClick={() => setShowBioModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              Đóng
            </button>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Sparkles className="text-purple-400" />
              Tạo AI Artist Bio
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Tải lên file PDF hồ sơ nghệ sĩ hoặc press kit của sự kiện <span className="text-white font-semibold">"{activeConcert.name}"</span>. Hệ thống sẽ tự động đọc nội dung và sử dụng AI để viết giới thiệu nghệ sĩ ngắn gọn.
            </p>

            <form onSubmit={handleUploadBio} className="space-y-6">
              {!isGeneratingBio && !generatedBio && (
                <div className="border-2 border-dashed border-slate-600 hover:border-purple-400 bg-slate-900/40 rounded-2xl p-8 text-center cursor-pointer relative transition-all duration-300">
                  <input 
                    required 
                    type="file" 
                    accept=".pdf" 
                    onChange={e => setBioFile(e.target.files ? e.target.files[0] : null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  {bioFile ? (
                    <div>
                      <p className="text-lg font-semibold text-purple-400">{bioFile.name}</p>
                      <p className="text-xs text-slate-400">{(bioFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-slate-300 font-medium">Click để chọn file PDF hoặc kéo thả vào đây</p>
                      <p className="text-xs text-slate-500 mt-1">Chấp nhận file định dạng .pdf (Tối đa 10MB)</p>
                    </div>
                  )}
                </div>
              )}

              {(isGeneratingBio || generatedBio) && (
                <div className="p-8 bg-slate-900/50 rounded-2xl border border-purple-500/20 text-center flex flex-col items-center">
                  <div className="relative w-16 h-16 mb-4">
                    {generatedBio ? (
                      <div className="absolute inset-0 rounded-full border-4 border-emerald-500 flex items-center justify-center bg-emerald-500/10">
                        <Check className="w-8 h-8 text-emerald-400" />
                      </div>
                    ) : (
                      <>
                        <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin"></div>
                        <Sparkles className="absolute inset-0 w-6 h-6 text-purple-400 m-auto animate-pulse" />
                      </>
                    )}
                  </div>
                  <p className={`font-bold text-lg mb-1 ${generatedBio ? 'text-emerald-400' : 'text-purple-400'}`}>
                    {generatedBio ? 'Hoàn tất!' : bioStep}
                  </p>
                  {!generatedBio && <p className="text-sm text-slate-400">Quá trình này có thể mất từ 5-15 giây tùy thuộc dung lượng PDF.</p>}
                </div>
              )}

              {generatedBio && (
                <div className="space-y-4">
                  <h3 className="font-bold text-sm text-purple-400 uppercase tracking-wider">Mô tả giới thiệu do AI sinh:</h3>
                  <textarea 
                    value={generatedBio}
                    onChange={(e) => setGeneratedBio(e.target.value)}
                    className="w-full bg-slate-900/60 p-4 rounded-2xl border border-purple-500/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 text-slate-200 text-sm leading-relaxed h-48 custom-scrollbar resize-none transition-all"
                    placeholder="Chỉnh sửa nội dung AI sinh tại đây..."
                  />
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-400 font-medium flex items-start gap-2">
                    <span className="text-lg leading-none">💡</span>
                    <span>Bạn có thể tự do chỉnh sửa lại văn bản trên cho đúng ý đồ trước khi bấm "Lưu vào Sự kiện".</span>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setShowBioModal(false)} 
                  className="flex-1 px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all text-center"
                >
                  Hủy
                </button>
                {!generatedBio && !isGeneratingBio && (
                  <button 
                    type="submit" 
                    disabled={!bioFile}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold transition-all shadow-lg text-center"
                  >
                    Bắt đầu Sinh AI
                  </button>
                )}
                {generatedBio && (
                  <button 
                    type="button"
                    onClick={handleSaveBio}
                    className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl font-bold transition-all shadow-lg text-center text-emerald-950"
                  >
                    Lưu vào Sự kiện
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
