import { useState } from 'react';
import Hero from '../components/Hero';
import ConcertList from '../components/ConcertList';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  return (
    <>
      <Hero searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <div className="max-w-7xl mx-auto px-6 py-24">
        <ConcertList searchQuery={searchQuery} />
      </div>
    </>
  );
}
