import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--ts-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--ts-text-secondary)' }}>
          Проверка доступа...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
