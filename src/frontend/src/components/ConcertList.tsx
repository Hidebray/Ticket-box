import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import gsap from 'gsap';
import ConcertCard from './ConcertCard';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/getErrorMessage';

interface Concert {
  id: string;
  name: string;
  start_time: string;
  status: string;
  location: string;
  created_at: string;
}

interface ConcertListProps {
  searchQuery?: string;
}

export default function ConcertList({ searchQuery = '' }: ConcertListProps) {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch concerts from backend
    axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts`)
      .then(res => {
        setConcerts(res.data);
        setLoading(false);
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Lỗi tải danh sách sự kiện'));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading && concerts.length > 0 && listRef.current) {
      // Apply GSAP stagger animation
      const cards = listRef.current.children;
      
      gsap.fromTo(cards, 
        { y: 50, opacity: 0 },
        {
          y: 0, 
          opacity: 1, 
          duration: 0.6, 
          stagger: 0.1, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: listRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        }
      );
    }
  }, [loading, concerts]);

  if (loading) return <div className="text-center py-20 text-xl animate-pulse">Đang tải danh sách sự kiện...</div>;

  const filteredConcerts = concerts.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.location && c.location.toLowerCase().includes(q));
  });

  return (
    <section>
      <div className="flex justify-between items-end mb-10">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Sự kiện nổi bật</h2>
        <span className="text-primary text-sm font-medium border border-primary px-3 py-1 rounded-full">{filteredConcerts.length} sự kiện</span>
      </div>
      
      {filteredConcerts.length === 0 ? (
        <div className="text-center text-slate-400 py-10 text-lg">
          {searchQuery ? 'Không tìm thấy sự kiện nào phù hợp.' : 'Chưa có sự kiện nào được xuất bản.'}
        </div>
      ) : (
        <div ref={listRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredConcerts.map(c => (
            <ConcertCard key={c.id} concert={c} />
          ))}
        </div>
      )}
    </section>
  );
}
