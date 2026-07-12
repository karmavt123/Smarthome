import { Outlet } from 'react-router-dom';

function MainLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}

export default MainLayout;
