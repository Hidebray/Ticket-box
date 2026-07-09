import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, Ticket, CalendarDays, RefreshCw, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/getErrorMessage';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<{ totalConcerts: number, totalTicketsSold: number, totalRevenue: number, chartData: any[], pieChartData: any[] }>({ totalConcerts: 0, totalTicketsSold: 0, totalRevenue: 0, chartData: [], pieChartData: [] });
  const [loading, setLoading] = useState(true);

  const [daysFilter, setDaysFilter] = useState('7');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('Bao_Cao_Doanh_Thu');
  const [exportType, setExportType] = useState('DAILY');

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];

  const fetchStats = async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/dashboard?days=${daysFilter}${refresh ? '&refresh=true' : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải thống kê dashboard'));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token, daysFilter]);

  const handleExport = () => {
    if (!exportFilename.trim()) {
      toast.error('Vui lòng nhập tên file');
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Thêm BOM để Excel đọc đúng tiếng Việt
    
    if (exportType === 'DAILY') {
      csvContent += "Ngày,Doanh thu (VNĐ),Số vé bán ra\n";
      stats.chartData.forEach(row => {
        csvContent += `${row.name},${row.doanhThu},${row.veBan}\n`;
      });
    } else {
      csvContent += "Sự kiện,Doanh thu (VNĐ)\n";
      stats.pieChartData.forEach(row => {
        csvContent += `"${row.name.replace(/"/g, '""')}",${row.value}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${exportFilename.replace(/\.csv$/, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setShowExportModal(false);
    toast.success('Tải xuống báo cáo thành công!');
  };

  if (loading) return <div className="text-white">Đang tải dữ liệu...</div>;

  const isDailyEmpty = !stats.chartData || stats.chartData.length === 0;
  const isPieEmpty = !stats.pieChartData || stats.pieChartData.length === 0;

  return (
    <div className="text-white relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={daysFilter}
            onChange={(e) => setDaysFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="7">7 ngày qua</option>
            <option value="30">30 ngày qua</option>
            <option value="all">Tất cả thời gian</option>
          </select>

          <button 
            onClick={() => fetchStats(true)}
            disabled={isRefreshing}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 text-slate-300 transition-colors disabled:opacity-50"
            title="Làm mới dữ liệu (bỏ qua Cache)"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          </button>

          <button 
            onClick={() => setShowExportModal(true)}
            className="bg-primary hover:bg-rose-600 rounded-xl px-4 py-2.5 flex items-center gap-2 font-bold transition-colors text-sm shadow-lg shadow-rose-600/20"
          >
            <Download className="w-4 h-4" /> Xuất Báo Cáo
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-emerald-500/20 p-3 rounded-lg text-emerald-400"><DollarSign className="w-6 h-6" /></div>
            <h3 className="text-slate-400 font-medium">Tổng doanh thu</h3>
          </div>
          <p className="text-3xl font-bold">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.totalRevenue)}</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-blue-500/20 p-3 rounded-lg text-blue-400"><Ticket className="w-6 h-6" /></div>
            <h3 className="text-slate-400 font-medium">Vé đã bán</h3>
          </div>
          <p className="text-3xl font-bold">{stats.totalTicketsSold} <span className="text-sm text-slate-500 font-normal">vé</span></p>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-purple-500/20 p-3 rounded-lg text-purple-400"><CalendarDays className="w-6 h-6" /></div>
            <h3 className="text-slate-400 font-medium">Sự kiện trên hệ thống</h3>
          </div>
          <p className="text-3xl font-bold">{stats.totalConcerts} <span className="text-sm text-slate-500 font-normal">sự kiện</span></p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-lg font-bold mb-6">
            Doanh thu {daysFilter === '7' ? 'tuần này' : daysFilter === '30' ? '30 ngày qua' : 'toàn thời gian'}
          </h3>
          <div className="h-72">
            {isDailyEmpty ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mb-3 opacity-50" />
                <p>Chưa có dữ liệu giao dịch</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => `${value / 1000000}M`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
                  />
                  <Bar dataKey="doanhThu" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-lg font-bold mb-6">
            Tốc độ bán vé {daysFilter === '7' ? 'tuần này' : daysFilter === '30' ? '30 ngày qua' : 'toàn thời gian'}
          </h3>
          <div className="h-72">
            {isDailyEmpty ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <Ticket className="w-12 h-12 mb-3 opacity-50" />
                <p>Chưa có dữ liệu vé bán</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="veBan" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 lg:col-span-2">
          <h3 className="text-lg font-bold mb-6 text-center">Tỷ trọng doanh thu theo Sự kiện</h3>
          <div className="h-[400px]">
            {isPieEmpty ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <FileSpreadsheet className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Chưa có đủ dữ liệu sự kiện để vẽ biểu đồ</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={100}
                    outerRadius={160}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-md border border-slate-700 shadow-2xl animate-fade-in">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Download className="text-primary w-7 h-7" /> Cấu hình Xuất File
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Tên file (không cần gõ .csv)</label>
                <input 
                  type="text" 
                  value={exportFilename} 
                  onChange={e => setExportFilename(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                  placeholder="Ví dụ: Bao_Cao_Thang_7"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Loại dữ liệu muốn xuất</label>
                <select 
                  value={exportType}
                  onChange={e => setExportType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="DAILY">Doanh thu theo ngày (Biểu đồ cột)</option>
                  <option value="CONCERT">Doanh thu theo Sự kiện (Biểu đồ tròn)</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowExportModal(false)} 
                  className="flex-1 px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all text-center"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleExport}
                  className="flex-1 px-5 py-3 bg-primary hover:bg-rose-600 rounded-xl font-bold transition-all shadow-lg shadow-rose-600/30 text-center"
                >
                  Tải xuống
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
