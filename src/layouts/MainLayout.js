import { useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import useRouter from '~/hooks/useRouter';
import useAuth from '~/hooks/useAuth';
import useHome from '~/hooks/useHome';
import {
  faTableCellsLarge,
  faHouse,
  faShieldHalved,
  faChartColumn,
  faBell,
  faGear,
  faMagnifyingGlass,
  faCircleUser,
  faBars,
  faXmark,
  faRightFromBracket,
  faSpinner,
  faMicrophone,
} from '@fortawesome/free-solid-svg-icons';
import VoiceSearchModal from '~/components/VoiceSearchModal';

const NAV_ITEMS = [
  { to: '/tong-quan', label: 'Tổng quan', icon: faTableCellsLarge, matchPaths: ['/'] },
  { to: '/phong', label: 'Phòng', icon: faHouse },
  { to: '/an-ninh', label: 'An ninh', icon: faShieldHalved },
  { to: '/thong-ke', label: 'Thống kê', icon: faChartColumn },
  { to: '/thong-bao', label: 'Thông báo', icon: faBell },
  { to: '/cai-dat', label: 'Cài đặt', icon: faGear },
];

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const router = useRouter();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { currentHomeId, isLoadingHomes } = useHome();

  if (isLoading || (isAuthenticated && isLoadingHomes)) {
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

  if (!currentHomeId) {
    return <Navigate to="/chon-nha" replace />;
  }

  // No navigate() here — logout() flips isAuthenticated to false and the guard
  // above redirects to /dang-nhap reactively on the next render.
  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-60 shrink-0 bg-surface-container-low border-r border-outline-variant/30 flex flex-col p-4 transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-2 flex items-center justify-center w-full">
          <div className="flex items-center justify-center">
            <img src="/logo192.png" alt="Lumina Home" className="h-[140px] w-[140px]" />
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu"
            className="md:hidden text-on-surface-variant hover:text-on-surface"
          >
            <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon, matchPaths = [] }) => {
            const isActive = router.path === to || matchPaths.includes(router.path);
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-body-md transition-colors ${
                  isActive
                    ? 'bg-secondary/15 text-secondary font-semibold shadow-[0_0_18px_2px_rgba(123,208,255,0.3)]'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <FontAwesomeIcon icon={icon} className="w-4 h-4" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-body-md text-error hover:bg-error/10 transition-colors"
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="w-4 h-4" />
          Đăng xuất
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-surface-container border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Mở menu"
              className="md:hidden w-9 h-9 shrink-0 rounded-full bg-surface-container-low border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
            >
              <FontAwesomeIcon icon={faBars} className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 rounded-full bg-surface-container-low border border-outline-variant/30 px-4 py-2">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 text-outline" />
              <input
                type="text"
                placeholder="Tìm kiếm thiết bị..."
                className="bg-transparent text-body-md text-on-surface placeholder:text-outline focus:outline-none w-48"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setVoiceModalOpen(true)}
              aria-label="Tìm kiếm bằng giọng nói"
              className="w-9 h-9 rounded-full bg-surface-container-low border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
            >
              <FontAwesomeIcon icon={faMicrophone} className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-surface-container-low border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
            >
              <FontAwesomeIcon icon={faCircleUser} className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <VoiceSearchModal open={voiceModalOpen} onClose={() => setVoiceModalOpen(false)} />
    </div>
  );
}

export default MainLayout;
