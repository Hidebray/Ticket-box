import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Scanner } from '@yudiel/react-qr-scanner';
import { get, set } from 'idb-keyval';
import { useAuth } from '../contexts/AuthContext';
import { Wifi, WifiOff, RefreshCw, CheckCircle, XCircle, Download, AlertTriangle } from 'lucide-react';

type TicketDB = {
  [qr_code: string]: { id: string; status: string; scanned_at: string | null };
};

export default function StaffCheckin() {
  const { token } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [concerts, setConcerts] = useState<any[]>([]);
  const [selectedConcertId, setSelectedConcertId] = useState('');
  
  // Stats
  const [localTicketCount, setLocalTicketCount] = useState(0);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [isSyncingDown, setIsSyncingDown] = useState(false);
  const [isSyncingUp, setIsSyncingUp] = useState(false);

  // Scanner State
  const [scanResult, setScanResult] = useState<{ status: 'SUCCESS' | 'ALREADY_SCANNED' | 'INVALID'; msg: string } | null>(null);
  const scannerCooldown = useRef(false);

  // 1. Lắng nghe trạng thái mạng
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Fetch danh sách sự kiện
  useEffect(() => {
    if (isOnline) {
      axios.get(`\${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts`)
        .then(res => setConcerts(res.data))
        .catch(err => console.error(err));
    }
  }, [isOnline]);

  // Khởi tạo & Đọc queue
  useEffect(() => {
    if (selectedConcertId) {
      updateLocalStats();
    }
  }, [selectedConcertId]);

  // Auto Sync-up khi có mạng
  useEffect(() => {
    if (isOnline && syncQueueCount > 0 && !isSyncingUp) {
      handleSyncUp();
    }
  }, [isOnline, syncQueueCount]);

  const updateLocalStats = async () => {
    if (!selectedConcertId) return;
    const db: TicketDB = (await get(`tickets_${selectedConcertId}`)) || {};
    const queue: any[] = (await get(`sync_queue_${selectedConcertId}`)) || [];
    setLocalTicketCount(Object.keys(db).length);
    setSyncQueueCount(queue.length);
  };

  // 3. Sync Down (Tải vé về máy)
  const handleSyncDown = async () => {
    if (!selectedConcertId) return alert('Vui lòng chọn sự kiện');
    if (!isOnline) return alert('Cần có mạng để tải dữ liệu');
    
    setIsSyncingDown(true);
    try {
      const res = await axios.get(`\${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/checkin/sync-down?concertId=${selectedConcertId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const ticketsArray = res.data.data;
      const db: TicketDB = {};
      
      ticketsArray.forEach((t: any) => {
        db[t.qr_code] = { id: t.id, status: t.status, scanned_at: t.scanned_at };
      });

      await set(`tickets_${selectedConcertId}`, db);
      await updateLocalStats();
      alert(`Đã tải về máy ${ticketsArray.length} vé hợp lệ.`);
    } catch (error) {
      console.error(error);
      alert('Lỗi khi tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setIsSyncingDown(false);
    }
  };

  // 4. Sync Up (Đẩy dữ liệu quét lên Server)
  const handleSyncUp = async () => {
    if (!selectedConcertId || !isOnline) return;
    setIsSyncingUp(true);
    try {
      const queue: any[] = (await get(`sync_queue_${selectedConcertId}`)) || [];
      if (queue.length === 0) return;

      const res = await axios.post(`\${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/checkin/sync-up`, {
        scannedTickets: queue
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Clear queue nếu thành công
      await set(`sync_queue_${selectedConcertId}`, []);
      await updateLocalStats();
      console.log('Sync up thành công:', res.data.results);
    } catch (error) {
      console.error('Lỗi khi Sync Up', error);
    } finally {
      setIsSyncingUp(false);
    }
  };

  // 5. Xử lý quét QR (Hoàn toàn Offline)
  const handleScan = async (detectedCodes: any[]) => {
    if (detectedCodes.length === 0 || scannerCooldown.current || !selectedConcertId) return;
    
    const qrText = detectedCodes[0].rawValue;
    if (!qrText) return;

    scannerCooldown.current = true;
    
    const db: TicketDB = (await get(`tickets_${selectedConcertId}`)) || {};
    const queue: any[] = (await get(`sync_queue_${selectedConcertId}`)) || [];
    
    const ticket = db[qrText];

    if (!ticket) {
      // Vé giả hoặc không thuộc sự kiện
      setScanResult({ status: 'INVALID', msg: 'Vé không hợp lệ hoặc giả mạo!' });
    } else if (ticket.status === 'CHECKED_IN') {
      // Vé đã quét
      setScanResult({ status: 'ALREADY_SCANNED', msg: `Vé đã quét lúc: ${new Date(ticket.scanned_at || '').toLocaleTimeString()}` });
    } else if (ticket.status === 'SOLD') {
      // Quét thành công
      const scanTime = new Date().toISOString();
      
      // Update local DB
      db[qrText].status = 'CHECKED_IN';
      db[qrText].scanned_at = scanTime;
      await set(`tickets_${selectedConcertId}`, db);

      // Add to SyncQueue
      queue.push({ ticketId: ticket.id, scannedAt: scanTime });
      await set(`sync_queue_${selectedConcertId}`, queue);

      setScanResult({ status: 'SUCCESS', msg: 'Hợp lệ. Vui lòng cho khách qua!' });
      updateLocalStats();

      // Trigger sync up background
      if (isOnline) handleSyncUp();
    }

    // Reset kết quả quét sau 2 giây
    setTimeout(() => {
      setScanResult(null);
      scannerCooldown.current = false;
    }, 2000);
  };

  return (
    <div className="max-w-md mx-auto relative h-full flex flex-col">
      {/* Network & Event Header */}
      <div className="bg-slate-900 rounded-2xl p-4 shadow-xl border border-slate-800 mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi className="w-5 h-5 text-emerald-400" /> : <WifiOff className="w-5 h-5 text-red-500" />}
            <span className={`text-sm font-bold ${isOnline ? 'text-emerald-400' : 'text-red-500'}`}>
              {isOnline ? 'Online' : 'Offline Mode'}
            </span>
          </div>
          {syncQueueCount > 0 && (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
              <RefreshCw className={`w-3 h-3 ${isSyncingUp ? 'animate-spin' : ''}`} />
              Đợi đồng bộ: {syncQueueCount}
            </div>
          )}
        </div>

        <select 
          value={selectedConcertId} 
          onChange={e => setSelectedConcertId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-emerald-500 mb-4"
        >
          <option value="">-- Chọn sự kiện để soát vé --</option>
          {concerts.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {selectedConcertId && (
          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Local DB</p>
              <p className="text-sm font-bold text-white">{localTicketCount} vé</p>
            </div>
            <button 
              onClick={handleSyncDown}
              disabled={isSyncingDown || !isOnline}
              className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {isSyncingDown ? 'Đang tải...' : 'Tải DB'}
            </button>
          </div>
        )}
      </div>

      {/* Scanner Section */}
      <div className="flex-1 bg-black rounded-3xl overflow-hidden relative shadow-2xl border-2 border-slate-800 flex flex-col justify-center">
        {!selectedConcertId ? (
          <div className="p-8 text-center text-slate-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Vui lòng chọn sự kiện và tải DB trước khi quét vé</p>
          </div>
        ) : localTicketCount === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Download className="w-12 h-12 mx-auto mb-4 opacity-50 animate-bounce" />
            <p>Vui lòng bấm Tải DB về máy</p>
          </div>
        ) : (
          <>
            <Scanner onScan={handleScan} components={{ finder: false }} />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50 z-10">
              <div className="w-full h-full border-2 border-emerald-500/50 relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 -ml-[2px] -mt-[2px]"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 -mr-[2px] -mt-[2px]"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 -ml-[2px] -mb-[2px]"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 -mr-[2px] -mb-[2px]"></div>
                {/* Scanning line animation */}
                <div className="w-full h-0.5 bg-emerald-500 absolute top-0 animate-scan shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"></div>
              </div>
            </div>

            {/* Result Overlays */}
            {scanResult && (
              <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center animate-fade-in backdrop-blur-sm ${
                scanResult.status === 'SUCCESS' ? 'bg-emerald-500/90 text-white' : 'bg-red-600/95 text-white'
              }`}>
                {scanResult.status === 'SUCCESS' ? (
                  <CheckCircle className="w-24 h-24 mb-4 drop-shadow-2xl" />
                ) : (
                  <XCircle className="w-24 h-24 mb-4 drop-shadow-2xl" />
                )}
                <h2 className="text-3xl font-black mb-2 drop-shadow-md">
                  {scanResult.status === 'SUCCESS' ? 'HỢP LỆ' : 'TỪ CHỐI'}
                </h2>
                <p className="text-lg font-medium drop-shadow-md">{scanResult.msg}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
