import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/getErrorMessage';

export default function AdminGuests() {
  const { token } = useAuth();
  const [concerts, setConcerts] = useState<any[]>([]);
  const [selectedConcertId, setSelectedConcertId] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [jobResult, setJobResult] = useState<any>(null);

  const pollingInterval = useRef<any>(null);

  useEffect(() => {
    // Fetch concerts and their ticket types to populate dropdowns
    const fetchConcerts = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/concerts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConcerts(res.data);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Lỗi tải danh sách sự kiện'));
      }
    };
    fetchConcerts();
  }, [token]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1
  });

  const downloadSampleCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFFemail,name\nnguyenvana@example.com,Nguyen Van A\ntranthib@example.com,Tran Thi B";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_guests.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleUpload = async () => {
    if (!file || !selectedConcertId) {
      alert('Vui lòng chọn Sự kiện và File CSV!');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setJobResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('concertId', selectedConcertId);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/guests/upload`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setJobId(res.data.jobId);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi khi upload file'));
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;

    pollingInterval.current = setInterval(async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/guests/progress/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const { state, progress: jobProgress, result, failedReason } = res.data;
        
        setProgress(jobProgress || 0);

        if (state === 'completed') {
          clearInterval(pollingInterval.current);
          setIsUploading(false);
          setProgress(100);
          setJobResult(result);
        } else if (state === 'failed') {
          clearInterval(pollingInterval.current);
          setIsUploading(false);
          alert('Worker thất bại: ' + failedReason);
        }
      } catch (err) {
        return; // Silent error, will retry next interval
      }
    }, 1000);

    return () => clearInterval(pollingInterval.current);
  }, [jobId, token]);

  return (
    <div className="text-white max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Import Danh sách Khách mời (CSV)</h1>

      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl mb-8">
        <h2 className="text-xl font-bold mb-6 border-b border-slate-700 pb-4">1. Cấu hình Cấp vé</h2>
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-400 mb-2">Chọn Sự kiện</label>
          <select 
            value={selectedConcertId} 
            onChange={e => { 
              setSelectedConcertId(e.target.value); 
              setJobId(null);
              setJobResult(null);
              setProgress(0);
              setFile(null);
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">-- Chọn sự kiện --</option>
            {concerts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
          <h2 className="text-xl font-bold">2. Upload File CSV</h2>
          <button 
            onClick={downloadSampleCSV}
            className="text-sm text-primary hover:text-rose-400 font-medium flex items-center gap-1 transition-colors"
          >
            <Download className="w-4 h-4" /> Tải File Mẫu
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-4">File CSV bắt buộc phải có cột `email`. Có thể tùy chọn thêm cột `name` (mặc định mỗi dòng sẽ được cấp 1 vé).</p>
        
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          {
            file ? (
              <div>
                <p className="text-lg font-medium text-white">{file.name}</p>
                <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : isDragActive ?
              <p className="text-primary font-medium">Kéo thả file vào đây...</p> :
              <p className="text-slate-400">Kéo thả file CSV vào đây, hoặc click để chọn file</p>
          }
        </div>

        {/* Nút Upload */}
        <div className="mt-8 flex justify-end">
          <button 
            onClick={handleUpload}
            disabled={!file || !selectedConcertId || isUploading}
            className="bg-primary hover:bg-rose-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg flex items-center gap-2"
          >
            {isUploading ? <><RefreshCw className="w-5 h-5 animate-spin" /> Đang đưa vào Queue...</> : 'Bắt đầu Import'}
          </button>
        </div>
      </div>

      {/* Progress & Result */}
      {(jobId || jobResult) && (
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl animate-fade-in">
          <h2 className="text-xl font-bold mb-6">Tiến trình xử lý (Worker)</h2>
          
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2 font-medium">
              <span className="text-slate-300">Đang cấp vé...</span>
              <span className="text-primary">{progress}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary to-rose-400 h-4 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {jobResult && (
            <div className="mt-8">
              <div className="flex items-center gap-3 p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl mb-6">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <h4 className="font-bold text-emerald-400">Hoàn tất!</h4>
                  <p className="text-emerald-300/80 text-sm">Đã cấp vé thành công cho {jobResult.successCount} khách mời.</p>
                </div>
              </div>

              {jobResult.errors && jobResult.errors.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h4 className="font-bold text-red-400">Có {jobResult.errors.length} dòng lỗi</h4>
                  </div>
                  <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {jobResult.errors.map((err: any, idx: number) => (
                      <div key={idx} className="bg-slate-900 p-3 rounded-lg flex justify-between items-center border border-slate-700/50">
                        <span className="font-mono text-sm text-slate-300">{err.email}</span>
                        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
