import { Navigate, useLocation } from 'react-router-dom';

export default function AuthGuard({ children, allowedRole }) {
  const location = useLocation();
  const adminData = sessionStorage.getItem('admin');
  const workerData = sessionStorage.getItem('worker');

  if (allowedRole === 'admin') {
    if (adminData) {
      return children;
    }
    if (workerData) {
      return <Navigate to="/worker-dashboard" replace />;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRole === 'worker') {
    if (workerData) {
      return children;
    }
    if (adminData) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Navigate to="/login" replace />;
}
