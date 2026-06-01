import { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db } from '../../utils/db';
import { CheckCircle, XCircle } from 'lucide-react';

export default function StaffScanner() {
  const [scanResult, setScanResult] = useState<{ status: 'IDLE' | 'SUCCESS' | 'DUPLICATE' | 'INVALID', message?: string }>({ status: 'IDLE' });
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      false
    );
    scannerRef.current = scanner;

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      scanner.clear().catch(console.error);
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    try {
      // Pause scanner while processing
      scannerRef.current?.pause(true);

      const ticketId = decodedText.trim();
      const ticket = await db.tickets.get(ticketId);

      if (!ticket) {
        setScanResult({ status: 'INVALID', message: 'Vé không tồn tại trong hệ thống (Vé giả)!' });
      } else if (ticket.status === 'CHECKED_IN') {
        setScanResult({ status: 'DUPLICATE', message: `Vé đã được sử dụng lúc ${new Date(ticket.scanned_at!).toLocaleTimeString()}!` });
      } else if (ticket.status === 'SOLD') {
        const now = new Date().toISOString();
        
        // Update Local DB
        await db.tickets.update(ticketId, {
          status: 'CHECKED_IN',
          scanned_at: now
        });

        // Add to Sync Queue
        await db.syncQueue.put({
          ticketId,
          scannedAt: now
        });

        setScanResult({ status: 'SUCCESS', message: 'Hợp lệ! Mời vào.' });
      } else {
        setScanResult({ status: 'INVALID', message: `Vé có trạng thái không hợp lệ: ${ticket.status}` });
      }
    } catch (err) {
      console.error(err);
      setScanResult({ status: 'INVALID', message: 'Lỗi xử lý vé.' });
    }
  };

  const onScanFailure = (error: any) => {
    // Usually ignoring normal frame read errors
  };

  const resetScan = () => {
    setScanResult({ status: 'IDLE' });
    scannerRef.current?.resume();
  };

  return (
    <div className="p-4 flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-6 text-center text-white">Soát Vé</h2>
      
      <div className={`w-full max-w-sm overflow-hidden rounded-2xl bg-white ${scanResult.status !== 'IDLE' ? 'hidden' : ''}`}>
        <div id="qr-reader" className="w-full"></div>
      </div>

      {scanResult.status !== 'IDLE' && (
        <div className="w-full max-w-sm mt-8 flex flex-col items-center bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl">
          {scanResult.status === 'SUCCESS' && (
            <div className="flex flex-col items-center text-emerald-500">
              <CheckCircle className="w-24 h-24 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Thành Công</h3>
            </div>
          )}

          {scanResult.status === 'DUPLICATE' && (
            <div className="flex flex-col items-center text-yellow-500">
              <XCircle className="w-24 h-24 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Vé Đã Quét</h3>
            </div>
          )}

          {scanResult.status === 'INVALID' && (
            <div className="flex flex-col items-center text-red-500">
              <XCircle className="w-24 h-24 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Vé Giả</h3>
            </div>
          )}

          <p className="text-center text-slate-300 text-lg mb-8">{scanResult.message}</p>

          <button
            onClick={resetScan}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl text-lg transition-colors"
          >
            Quét vé tiếp theo
          </button>
        </div>
      )}
    </div>
  );
}
