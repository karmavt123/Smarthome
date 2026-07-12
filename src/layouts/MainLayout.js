import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTableCellsLarge,
  faHouse,
  faShieldHalved,
  faChartColumn,
  faBell,
  faGear,
  faMagnifyingGlass,
  faCircleUser,
  faSliders,
  faBars,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

const NAV_ITEMS = [
  { to: '/tong-quan', label: 'Tổng quan', icon: faTableCellsLarge },
  { to: '/phong', label: 'Phòng', icon: faHouse },
  { to: '/an-ninh', label: 'An ninh', icon: faShieldHalved },
  { to: '/thong-ke', label: 'Thống kê', icon: faChartColumn },
  { to: '/thong-bao', label: 'Thông báo', icon: faBell },
  { to: '/cai-dat', label: 'Cài đặt', icon: faGear },
];

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <div className="mb-8 px-2 flex items-center justify-between">
          <div>
            <h1 className="text-body-lg font-bold text-secondary leading-tight">Lumina Home Logic</h1>
            <p className="text-label-sm text-outline mt-1">Active Home System</p>
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
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-md transition-colors ${
                  isActive
                    ? 'bg-secondary/10 text-secondary font-medium'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <FontAwesomeIcon icon={icon} className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-lg bg-surface-container p-3">
          <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
            <FontAwesomeIcon icon={faCircleUser} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-body-md text-on-surface truncate">Người Dùng Lumina</p>
            <p className="text-label-sm text-outline truncate">Premium Account</p>
          </div>
        </div>
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
            <h2 className="text-headline-md font-semibold text-secondary truncate">Dashboard Overview</h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-surface-container-low border border-outline-variant/30 px-4 py-2">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4 text-outline" />
              <input
                type="text"
                placeholder="Tìm kiếm thiết bị..."
                className="bg-transparent text-body-md text-on-surface placeholder:text-outline focus:outline-none w-48"
              />
            </div>
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-surface-container-low border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
            >
              <FontAwesomeIcon icon={faCircleUser} className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-surface-container-low border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
            >
              <FontAwesomeIcon icon={faSliders} className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
