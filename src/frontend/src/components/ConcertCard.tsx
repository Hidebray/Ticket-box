import { CalendarDays, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ConcertProps {
  concert: {
    id: string;
    name: string;
    start_time: string;
  };
}

export default function ConcertCard({ concert }: ConcertProps) {
  const navigate = useNavigate();
  const dateObj = new Date(concert.start_time);
  const formattedDate = dateObj.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const time = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div 
      onClick={() => navigate(`/concerts/${concert.id}`)}
      className="group bg-surface rounded-2xl overflow-hidden border border-slate-700/50 hover:border-primary transition-all duration-300 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)] cursor-pointer flex flex-col h-full transform hover:-translate-y-1"
    >
      <div className="h-48 bg-slate-800 relative overflow-hidden">
        {/* Abstract Gradient Background for Event */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-slate-800 to-blue-900/40 group-hover:scale-110 transition-transform duration-700 ease-in-out"></div>
        <div className="absolute top-4 right-4 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
          Sắp diễn ra
        </div>
      </div>
      
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-xl font-bold mb-4 line-clamp-2 group-hover:text-primary transition-colors leading-tight">
          {concert.name}
        </h3>
        
        <div className="space-y-2 mt-auto">
          <div className="flex items-center text-slate-300 text-sm">
            <CalendarDays className="w-4 h-4 mr-2.5 text-primary opacity-80" />
            <span>{time} - {formattedDate}</span>
          </div>
          <div className="flex items-center text-slate-400 text-sm">
            <MapPin className="w-4 h-4 mr-2.5 text-primary opacity-80" />
            <span>Xem chi tiết địa điểm</span>
          </div>
        </div>
        
        <button className="mt-6 w-full bg-slate-700/50 hover:bg-primary text-white font-semibold py-3 rounded-xl transition-all duration-300">
          Mua vé ngay
        </button>
      </div>
    </div>
  );
}
