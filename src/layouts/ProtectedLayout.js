import { Outlet, Navigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import useAuth from '~/hooks/useAuth';
import useRouter from '~/hooks/useRouter';

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-secondary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = router.path + router.location.search;
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}

export default ProtectedLayout;
