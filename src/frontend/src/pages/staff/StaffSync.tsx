import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../utils/db';
import { CloudDownload, CloudUpload, Database } from 'lucide-react';

export default function StaffSync() {
  const { token } = useAuth();
  const [concerts, setConcerts] = useState<any[]>([]);
  const [selectedConcert, setSelectedConcert] = useState('');
  const [localStats, setLocalStats] = useState({ total: 0, queue: 0 });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load concerts for selection
    axios.get(`\${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts`)
      .then(res => {
        setConcerts(res.data);
        if (res.data.length > 0) setSelectedConcert(res.data[0].id);
      })
      .catch(console.error);
    
    updateStats();

    // Auto sync up when back online
    const handleOnline = () => {
      setStatusMsg({ type: 'info', text: 'Có mạng trở lại! Đang tự động đồng bộ lên server...' });
      handleSyncUp();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

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
      const res = await axios.get(`\${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/checkin/sync-down?concertId=${selectedConcert}`, {
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
      console.error(err);
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Lỗi tải dữ liệu. Cần kết nối mạng.' });
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

      await axios.post(`\${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/checkin/sync-up`, {
        scannedTickets: queueItems
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // If success, clear sync queue
      await db.syncQueue.clear();
      
      setStatusMsg({ type: 'success', text: `Đã đồng bộ ${queueItems.length} bản ghi lên server!` });
      updateStats();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Lỗi đồng bộ. Hãy chắc chắn bạn đang có mạng.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white text-center">Quản Lý Đồng Bộ</h2>
      
      {/* Stats */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 flex justify-around">
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-1">Vé Offline</p>
          <p className="text-2xl font-bold text-emerald-500 flex items-center justify-center gap-2">
            <Database className="w-5 h-5" /> {localStats.total}
          </p>
        </div>
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-1">Chờ Sync Up</p>
          <p className="text-2xl font-bold text-amber-500 flex items-center justify-center gap-2">
            <CloudUpload className="w-5 h-5" /> {localStats.queue}
          </p>
        </div>
      </div>

      {statusMsg.text && (
        <div className={`mb-6 p-4 rounded-xl text-sm ${
          statusMsg.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/30' :
          statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' :
          'bg-blue-500/10 text-blue-400 border border-blue-500/30'
        }`}>
          {statusMsg.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Sync Down Section */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <CloudDownload className="text-emerald-500" />
            1. Tải Vé Về Máy (Có Mạng)
          </h3>
          <p className="text-sm text-slate-400 mb-4">Lưu ý: Hành động này sẽ xóa dữ liệu cũ trên máy và tải danh sách vé mới nhất.</p>
          
          <select 
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-4"
            value={selectedConcert}
            onChange={(e) => setSelectedConcert(e.target.value)}
          >
            {concerts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={handleSyncDown}
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
          >
            Bắt đầu Tải về
          </button>
        </div>

        {/* Sync Up Section */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <CloudUpload className="text-amber-500" />
            2. Đẩy Dữ Liệu Lên (Có Mạng)
          </h3>
          <p className="text-sm text-slate-400 mb-4">Sau khi soát vé ở chế độ Offline, hãy bấm nút này khi có mạng để cập nhật lại Server.</p>
          
          <button
            onClick={handleSyncUp}
            disabled={loading || localStats.queue === 0}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
          >
            Bắt đầu Đồng bộ ({localStats.queue} bản ghi)
          </button>
        </div>
      </div>
    </div>
  );
}
