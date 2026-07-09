import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, token } = useAuth();
  const location = useLocation();

  if (!token || !user) {
    // Không đăng nhập -> Đá ra trang login, lưu lại đường dẫn cũ để đăng nhập xong quay lại
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Không đủ quyền -> Đá về trang chủ cá nhân
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
