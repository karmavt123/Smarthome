import { Outlet, Navigate } from 'react-router-dom';
import useAuth from '~/hooks/useAuth';
import useRouter from '~/hooks/useRouter';

function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) return null;
  if (isAuthenticated) {
    const next = router.queryParams.next;
    return <Navigate to={next ? decodeURIComponent(next) : '/'} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[28rem]">
        <div className="flex flex-col items-center text-center mb-8">
          <img src="/logo192.png" alt="Lumina Home" className="h-[150px] w-[150px]" />
          <div className="text-body-md text-outline">Quản lý ngôi nhà thông minh của bạn</div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

export default AuthLayout;
