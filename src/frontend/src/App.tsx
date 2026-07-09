import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
import AdminUsers from './pages/AdminUsers';
import ProtectedRoute from './components/ProtectedRoute';
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
        {/* [UX-01] Toast notifications — thay thế alert() toàn hệ thống */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <Routes>
          {/* Public & Customer Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/concerts/:id" element={<ConcertDetail />} />
            
            {/* Authenticated Customer Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/checkout/:id" element={<Checkout />} />
            </Route>
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['ORGANIZER', 'SUPER_ADMIN']} />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="concerts" element={<AdminConcerts />} />
              <Route path="guests" element={<AdminGuests />} />
              <Route path="users" element={<AdminUsers />} />
            </Route>
          </Route>

          {/* Staff Check-in Routes */}
          <Route path="/staff" element={<ProtectedRoute allowedRoles={['STAFF', 'SUPER_ADMIN']} />}>
            <Route element={<StaffLayout />}>
              <Route path="checkin" element={<StaffScanner />} />
              <Route path="sync" element={<StaffSync />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
