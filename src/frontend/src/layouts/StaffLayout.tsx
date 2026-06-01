import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ScanLine, RefreshCw, LogOut } from 'lucide-react';

export default function StaffLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-bold text-emerald-500">TB Check-in</h1>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
        <button onClick={logout} className="text-slate-400 hover:text-white p-2">
          <LogOut className="w-6 h-6" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 flex justify-around p-3 z-50">
        <Link 
          to="/staff/checkin" 
          className={`flex flex-col items-center p-2 ${location.pathname === '/staff/checkin' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <ScanLine className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Quét QR</span>
        </Link>
        <Link 
          to="/staff/sync" 
          className={`flex flex-col items-center p-2 ${location.pathname === '/staff/sync' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <RefreshCw className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Đồng bộ</span>
        </Link>
      </nav>
    </div>
  );
}
