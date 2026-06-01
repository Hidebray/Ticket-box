import Hero from '../components/Hero';
import ConcertList from '../components/ConcertList';

export default function Home() {
  return (
    <>
      <Hero />
      <div className="max-w-7xl mx-auto px-6 py-24">
        <ConcertList />
      </div>
    </>
  );
}
