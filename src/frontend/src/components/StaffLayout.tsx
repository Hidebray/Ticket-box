import { useEffect } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Scan, LogOut, Settings } from 'lucide-react';

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user || user.role !== 'STAFF') {
      alert('Bạn không có quyền truy cập trang Soát vé!');
      navigate('/');
    }
  }, [user, navigate]);

  if (!user || user.role !== 'STAFF') return null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Navigation for Mobile-friendly Staff PWA */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 p-2 rounded-lg text-white shadow-lg shadow-emerald-500/20">
            <Scan className="w-5 h-5" />
          </div>
          <span className="font-bold text-white tracking-tight">Staff<span className="text-emerald-400">Scanner</span></span>
        </div>
        <button 
          onClick={() => { logout(); navigate('/'); }}
          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Scanner Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-950 p-4">
        <Outlet />
      </main>

      {/* Bottom Navigation for Staff PWA */}
      <nav className="bg-slate-900 border-t border-slate-800 p-2 pb-safe sticky bottom-0">
        <div className="flex justify-around items-center">
          <Link 
            to="/staff/checkin" 
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${location.pathname === '/staff/checkin' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Scan className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-bold">Quét vé</span>
          </Link>
          <Link 
            to="/staff/settings" 
            className={`flex flex-col items-center p-2 rounded-xl transition-colors ${location.pathname === '/staff/settings' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Settings className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-bold">Cài đặt</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
