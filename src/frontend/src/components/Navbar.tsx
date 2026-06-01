import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, LogOut, Ticket } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="absolute top-0 w-full z-50 px-6 py-6 border-b border-white/10 bg-slate-900/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <div 
          onClick={() => navigate('/')} 
          className="text-2xl font-black tracking-tighter cursor-pointer"
        >
          TICKET<span className="text-primary">BOX</span>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors font-medium"
              >
                <Ticket className="w-4 h-4" /> Vé của tôi
              </button>
              
              <div className="flex items-center gap-4 bg-slate-800/80 pl-4 pr-2 py-1.5 rounded-full border border-slate-700">
                <span className="text-sm text-slate-300 hidden md:block">
                  {user.email}
                </span>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  <User className="w-4 h-4" />
                </div>
                <button 
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors bg-slate-700/50 rounded-full"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/login')}
                className="text-slate-300 hover:text-white font-medium transition-colors"
              >
                Đăng nhập
              </button>
              <button 
                onClick={() => navigate('/register')}
                className="bg-primary hover:bg-rose-600 text-white font-medium px-5 py-2.5 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all transform hover:-translate-y-0.5"
              >
                Đăng ký
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
