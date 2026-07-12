import { Outlet } from 'react-router-dom';

function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[28rem]">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center mb-4">
            <span className="w-4 h-4 rounded-full bg-secondary" />
          </div>
          <h1 className="text-headline-lg font-semibold text-on-surface">Lumina Home Logic</h1>
          <p className="text-body-md text-outline mt-2">Quản lý ngôi nhà thông minh của bạn</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

export default AuthLayout;
