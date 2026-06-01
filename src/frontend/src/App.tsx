import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ConcertDetail from './pages/ConcertDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import Checkout from './pages/Checkout';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminConcerts from './pages/AdminConcerts';
import AdminGuests from './pages/AdminGuests';
import StaffLayout from './layouts/StaffLayout';
import StaffScanner from './pages/staff/StaffScanner';
import StaffSync from './pages/staff/StaffSync';

gsap.registerPlugin(ScrollTrigger);

function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-primary/30 relative">
      <Navbar />
      <Outlet />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public & Customer Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/checkout/:id" element={<Checkout />} />
            <Route path="/concerts/:id" element={<ConcertDetail />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="concerts" element={<AdminConcerts />} />
            <Route path="guests" element={<AdminGuests />} />
          </Route>

          {/* Staff Check-in Routes */}
          <Route path="/staff" element={<StaffLayout />}>
            <Route path="checkin" element={<StaffScanner />} />
            <Route path="sync" element={<StaffSync />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
