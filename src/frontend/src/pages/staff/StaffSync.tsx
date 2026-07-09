import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../utils/db';
import { CloudDownload, CloudUpload, Database } from 'lucide-react';
import { getErrorMessage } from '../../utils/getErrorMessage';
import toast from 'react-hot-toast';

export default function StaffSync() {
  const { token } = useAuth();
  const [concerts, setConcerts] = useState<any[]>([]);
  const [selectedConcert, setSelectedConcert] = useState('');
  const [localStats, setLocalStats] = useState({ total: 0, queue: 0 });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [serverTicketCount, setServerTicketCount] = useState<number | null>(null);

  useEffect(() => {
    // Load concerts for selection
    axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts`)
      .then(res => {
        setConcerts(res.data);
        if (res.data.length > 0) setSelectedConcert(res.data[0].id);
      })
      .catch(err => toast.error(getErrorMessage(err, 'Lỗi tải danh sách sự kiện')));

    updateStats();

    // Auto sync up when back online
    const handleOnline = () => {
      setStatusMsg({ type: 'info', text: 'Có mạng trở lại! Đang tự động đồng bộ lên server...' });
      handleSyncUp();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    if (!selectedConcert) {
      setServerTicketCount(null);
      return;
    }
    setServerTicketCount(null); // reset while loading
    axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/checkin/count?concertId=${selectedConcert}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setServerTicketCount(res.data.count))
      .catch(err => console.error('Failed to fetch ticket count', err));
  }, [selectedConcert, token]);

  const updateStats = async () => {
    const total = await db.tickets.count();
    const queue = await db.syncQueue.count();
    setLocalStats({ total, queue });
  };

  const handleSyncDown = async () => {
    if (!selectedConcert) return;
    setLoading(true);
    setStatusMsg({ type: 'info', text: 'Đang tải dữ liệu vé...' });

    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/checkin/sync-down?concertId=${selectedConcert}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const tickets = res.data.data;

      // Clear old tickets (optional, or just update)
      await db.tickets.clear();

      // Bulk add new tickets
      await db.tickets.bulkPut(tickets);

      setStatusMsg({ type: 'success', text: `Đã tải về thành công ${tickets.length} vé!` });
      updateStats();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: getErrorMessage(err, 'Lỗi tải dữ liệu. Cần kết nối mạng.') });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncUp = async () => {
    setLoading(true);
    setStatusMsg({ type: 'info', text: 'Đang đẩy dữ liệu lên server...' });

    try {
      const queueItems = await db.syncQueue.toArray();

      if (queueItems.length === 0) {
        setStatusMsg({ type: 'success', text: 'Không có dữ liệu mới nào cần đồng bộ lên.' });
        setLoading(false);
        return;
      }

      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/checkin/sync-up`, {
        scannedTickets: queueItems
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // If success, clear sync queue
      await db.syncQueue.clear();

      setStatusMsg({ type: 'success', text: `Đã đồng bộ ${queueItems.length} bản ghi lên server!` });
      updateStats();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: getErrorMessage(err, 'Lỗi đồng bộ. Hãy chắc chắn bạn đang có mạng.') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto min-h-[calc(100vh-80px)] flex flex-col">
      <h2 className="text-3xl font-black mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 drop-shadow-sm uppercase tracking-widest">
        Dữ Liệu Soát Vé
      </h2>
      
      {/* Stats */}
      <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 mb-8 flex justify-around shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
        <div className="text-center relative z-10 flex flex-col items-center justify-center">
          <p className="text-slate-400 text-sm mb-2 font-medium uppercase tracking-wider">Vé Offline</p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-emerald-400 flex items-center justify-center gap-3 drop-shadow-lg">
              <Database className="w-8 h-8 opacity-80" /> {localStats.total}
            </p>
            {serverTicketCount !== null && (
              <span className="text-lg font-bold text-slate-500">
                / {serverTicketCount}
              </span>
            )}
          </div>
        </div>
        <div className="w-px bg-slate-700/50"></div>
        <div className="text-center relative z-10">
          <p className="text-slate-400 text-sm mb-2 font-medium uppercase tracking-wider">Chờ Đồng Bộ</p>
          <p className="text-4xl font-black text-amber-400 flex items-center justify-center gap-3 drop-shadow-lg">
            <CloudUpload className="w-8 h-8 opacity-80" /> {localStats.queue}
          </p>
        </div>
      </div>

      {statusMsg.text && (
        <div className={`mb-8 p-5 rounded-2xl text-base font-medium shadow-lg animate-in fade-in slide-in-from-top-4 ${
          statusMsg.type === 'error' ? 'bg-rose-900/40 text-rose-400 border border-rose-500/50 shadow-rose-500/10' :
          statusMsg.type === 'success' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 shadow-emerald-500/10' :
          'bg-blue-900/40 text-blue-400 border border-blue-500/50 shadow-blue-500/10'
        }`}>
          {statusMsg.text}
        </div>
      )}

      <div className="space-y-6 flex-1">
        {/* Sync Down Section */}
        <div className="bg-slate-800/60 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-xl transition-transform hover:-translate-y-1 duration-300">
          <h3 className="font-bold text-xl mb-3 flex items-center gap-3 text-white">
            <CloudDownload className="text-emerald-400 w-6 h-6" />
            1. Tải Vé Về Máy (Có Mạng)
          </h3>
          <p className="text-slate-400 mb-6 leading-relaxed">Chọn sự kiện để tải toàn bộ danh sách vé hợp lệ về máy. <br/><span className="text-rose-400 font-medium">Lưu ý:</span> Hành động này sẽ xóa dữ liệu vé cũ trên máy.</p>
          
          <div className="relative mb-6">
            <select 
              className="w-full bg-slate-900/80 border border-slate-600 rounded-2xl p-4 text-white appearance-none focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
              value={selectedConcert}
              onChange={(e) => setSelectedConcert(e.target.value)}
            >
              {concerts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
          </div>

          <button
            onClick={handleSyncDown}
            disabled={loading || !selectedConcert}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider active:scale-95"
          >
            {loading && statusMsg.type === 'info' && statusMsg.text.includes('tải') ? 'Đang tải...' : 'Bắt đầu Tải về'}
          </button>
        </div>

        {/* Sync Up Section */}
        <div className="bg-slate-800/60 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-xl transition-transform hover:-translate-y-1 duration-300">
          <h3 className="font-bold text-xl mb-3 flex items-center gap-3 text-white">
            <CloudUpload className="text-amber-400 w-6 h-6" />
            2. Đẩy Dữ Liệu Lên (Có Mạng)
          </h3>
          <p className="text-slate-400 mb-6 leading-relaxed">Sau khi soát vé ở chế độ Offline, bấm nút này để đẩy {localStats.queue} lượt check-in mới lên Server Trung Tâm.</p>
          
          <button
            onClick={handleSyncUp}
            disabled={loading || localStats.queue === 0}
            className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-4 rounded-2xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider active:scale-95"
          >
            {loading && statusMsg.type === 'info' && statusMsg.text.includes('đẩy') ? 'Đang đồng bộ...' : `Bắt đầu Đồng bộ (${localStats.queue})`}
          </button>
        </div>
      </div>
    </div>
  );
}
