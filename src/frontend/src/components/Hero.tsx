import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function Hero() {
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
    <header className="relative h-[60vh] flex items-center justify-center overflow-hidden bg-surface">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-background/90 z-0"></div>
      <div className="relative z-10 text-center px-4">
        <h1 ref={titleRef} className="text-5xl md:text-7xl font-bold mb-4 tracking-tight">
          TICKET<span className="text-primary">BOX</span> V2
        </h1>
        <p ref={subtitleRef} className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto">
          Trải nghiệm săn vé sự kiện đỉnh cao, mượt mà và không lo sập mạng.
        </p>
      </div>
    </header>
  );
}
