import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface HeroProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function Hero({ searchQuery, setSearchQuery }: HeroProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    
    tl.fromTo(titleRef.current, 
      { y: 50, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1, ease: 'power3.out' }
    )
    .fromTo(subtitleRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' },
      '-=0.5'
    );
  }, []);

  return (
    <header className="relative h-[70vh] flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Animated Mesh Gradient Background */}
      <div className="absolute inset-0 z-0 opacity-40 animate-mesh bg-gradient-to-r from-primary via-purple-600 to-blue-600" style={{ backgroundImage: 'linear-gradient(45deg, rgba(244,63,94,0.4) 0%, rgba(139,92,246,0.4) 50%, rgba(59,130,246,0.4) 100%)' }}></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background z-0"></div>
      
      <div className="relative z-10 text-center px-4 w-full max-w-4xl mx-auto flex flex-col items-center">
        <h1 ref={titleRef} className="text-6xl md:text-8xl font-black mb-6 tracking-tighter text-white">
          TICKET<span className="text-primary text-glow">BOX</span>
        </h1>
        <p ref={subtitleRef} className="text-lg md:text-2xl text-slate-300 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
          Trải nghiệm săn vé sự kiện đỉnh cao, mượt mà và bùng nổ. Không lo sập mạng.
        </p>
        
        {/* Glassmorphism Search Bar */}
        <div className="w-full max-w-2xl mx-auto glass rounded-2xl p-2 flex items-center shadow-2xl transform hover:scale-[1.02] transition-transform duration-300">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm sự kiện, nghệ sĩ, địa điểm..." 
            className="flex-1 bg-transparent border-none outline-none text-white px-6 py-4 placeholder-slate-400 text-lg"
          />
        </div>
      </div>
    </header>
  );
}
