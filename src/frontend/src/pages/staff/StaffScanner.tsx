import { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db } from '../../utils/db';
import { CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/getErrorMessage';

export default function StaffScanner() {
  const [scanResult, setScanResult] = useState<{ status: 'IDLE' | 'SUCCESS' | 'DUPLICATE' | 'INVALID', message?: string }>({ status: 'IDLE' });
  const [manualTicketId, setManualTicketId] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    let isComponentMounted = true;
    let scanner: Html5QrcodeScanner | null = null;

    // Delay initialization slightly to prevent React Strict Mode duplicate rendering
    const timer = setTimeout(() => {
      if (!isComponentMounted) return;

      // Check if DB is empty to warn user
      db.tickets.count().then(count => {
        if (count === 0) {
          toast.error('CẢNH BÁO: Chưa có dữ liệu vé! Vui lòng sang tab "Đồng bộ" để tải vé về máy trước khi soát.', { duration: 6000 });
        }
      });

      const el = document.getElementById("qr-reader");
      if (el) el.innerHTML = ''; // Ensure DOM is clean

      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        false
      );
      scannerRef.current = scanner;

      scanner.render(onScanSuccess, onScanFailure);
    }, 100);

    return () => {
      isComponentMounted = false;
      clearTimeout(timer);
      if (scanner) {
        scanner.clear().catch(err => console.log('Scanner clear error (ignored):', err));
      }
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    try {
      // Safely pause scanner if it's currently scanning
      try {
        scannerRef.current?.pause(true);
      } catch (e) {
        // Ignore error if scanner is not running
      }

      const searchKey = decodedText.trim();

      // Lấy toàn bộ vé (local DB thường chỉ vài ngàn vé nên toArray() rất nhanh)
      const allTickets = await db.tickets.toArray();

      // Tìm vé khớp (khớp chính xác id, qr_code HOẶC khớp phần đầu của qr_code/id)
      const ticket = allTickets.find(t =>
        t.id === searchKey ||
        t.qr_code === searchKey ||
        t.qr_code.toUpperCase().startsWith(searchKey.toUpperCase()) ||
        t.id.toUpperCase().startsWith(searchKey.toUpperCase())
      );

      if (!ticket) {
        setScanResult({ status: 'INVALID', message: 'Vé không tồn tại trong hệ thống (Vé giả)!' });
      } else if (ticket.status === 'CHECKED_IN') {
        setScanResult({ status: 'DUPLICATE', message: `Vé đã được sử dụng lúc ${new Date(ticket.scanned_at!).toLocaleTimeString()}!` });
      } else if (ticket.status === 'SOLD') {
        const now = new Date().toISOString();

        // Update Local DB
        await db.tickets.update(ticket.id, {
          status: 'CHECKED_IN',
          scanned_at: now
        });

        // Add to Sync Queue
        await db.syncQueue.put({
          ticketId: ticket.id,
          scannedAt: now
        });

        setScanResult({ status: 'SUCCESS', message: 'Hợp lệ! Mời vào.' });
      } else {
        setScanResult({ status: 'INVALID', message: `Vé có trạng thái không hợp lệ: ${ticket.status}` });
      }
    } catch (err) {
      setScanResult({ status: 'INVALID', message: getErrorMessage(err, 'Lỗi xử lý vé.') });
    }
  };

  const onScanFailure = (_error: any) => {
    // Usually ignoring normal frame read errors
  };

  const resetScan = () => {
    setScanResult({ status: 'IDLE' });
    scannerRef.current?.resume();
  };

  return (
    <div className="p-4 flex flex-col items-center min-h-[calc(100vh-80px)]">
      <h2 className="text-3xl font-black mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 drop-shadow-sm uppercase tracking-widest">
        Kiểm Soát Vé
      </h2>

      <div className={`relative w-full max-w-md mx-auto overflow-hidden rounded-3xl bg-slate-800/80 backdrop-blur-md border border-slate-700/50 shadow-2xl ${scanResult.status !== 'IDLE' ? 'hidden' : ''}`}>
        <div id="qr-reader" className="w-full border-none [&_span]:!text-white [&_span]:font-medium [&_select]:!bg-slate-700 [&_select]:!text-white [&_select]:p-3 [&_select]:rounded-xl [&_select]:border [&_select]:!border-slate-600 [&_select]:w-full [&_select]:mb-4 [&_select]:mt-2 [&_button]:!bg-gradient-to-r [&_button]:from-emerald-500 [&_button]:to-teal-500 [&_button]:hover:from-emerald-600 [&_button]:hover:to-teal-600 [&_button]:!text-white [&_button]:font-bold [&_button]:px-6 [&_button]:py-3 [&_button]:rounded-xl [&_button]:transition-all [&_button]:shadow-lg [&_button]:shadow-emerald-500/20 [&_button]:mb-4 [&_button]:w-full [&_a]:hidden [&_video]:!rounded-t-3xl [&_img]:hidden"></div>
      </div>

      {scanResult.status === 'IDLE' && (
        <div className="w-full max-w-md mt-8 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-slate-700"></div>
            <div className="text-center text-slate-400 text-sm font-medium uppercase tracking-wider">Hoặc nhập thủ công</div>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nhập mã vé (VD: D1B57F3E)..."
              value={manualTicketId}
              onChange={(e) => setManualTicketId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualTicketId) {
                  onScanSuccess(manualTicketId);
                }
              }}
              className="flex-1 bg-slate-800/80 border border-slate-600 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-mono text-lg transition-all placeholder-slate-500"
            />
            <button
              onClick={() => manualTicketId && onScanSuccess(manualTicketId)}
              className="bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              Kiểm tra
            </button>
          </div>
        </div>
      )}

      {scanResult.status !== 'IDLE' && (
        <div className={`w-full max-w-md mt-8 flex flex-col items-center p-10 rounded-3xl border shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in zoom-in-95 ${
          scanResult.status === 'SUCCESS' ? 'bg-emerald-900/40 border-emerald-500/50 shadow-emerald-500/20' :
          scanResult.status === 'DUPLICATE' ? 'bg-amber-900/40 border-amber-500/50 shadow-amber-500/20' :
          'bg-rose-900/40 border-rose-500/50 shadow-rose-500/20'
        }`}>
          {scanResult.status === 'SUCCESS' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-50 rounded-full animate-pulse"></div>
                <CheckCircle className="w-32 h-32 mb-6 text-emerald-400 relative z-10 drop-shadow-lg" />
              </div>
              <h3 className="text-4xl font-black mb-3 text-emerald-400 uppercase tracking-wide">Hợp Lệ</h3>
            </>
          )}

          {scanResult.status === 'DUPLICATE' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-50 rounded-full animate-pulse"></div>
                <XCircle className="w-32 h-32 mb-6 text-amber-400 relative z-10 drop-shadow-lg" />
              </div>
              <h3 className="text-4xl font-black mb-3 text-amber-400 uppercase tracking-wide">Đã Quét</h3>
            </>
          )}

          {scanResult.status === 'INVALID' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500 blur-2xl opacity-50 rounded-full animate-pulse"></div>
                <XCircle className="w-32 h-32 mb-6 text-rose-400 relative z-10 drop-shadow-lg" />
              </div>
              <h3 className="text-4xl font-black mb-3 text-rose-400 uppercase tracking-wide">Vé Giả</h3>
            </>
          )}

          <p className="text-center text-slate-200 text-xl mb-10 font-medium leading-relaxed">{scanResult.message}</p>

          <button
            onClick={resetScan}
            className={`w-full font-bold py-5 rounded-2xl text-xl transition-all shadow-xl uppercase tracking-wider active:scale-95 ${
              scanResult.status === 'SUCCESS' ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-emerald-500/20' :
              scanResult.status === 'DUPLICATE' ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-amber-500/20' :
              'bg-rose-500 hover:bg-rose-400 text-rose-950 shadow-rose-500/20'
            }`}
          >
            Quét vé tiếp theo
          </button>
        </div>
      )}
    </div>
  );
}
