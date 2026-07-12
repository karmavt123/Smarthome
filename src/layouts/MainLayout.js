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
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 bg-surface-container-low border-r border-outline-variant/30 flex flex-col p-4">
        <div className="mb-8 px-2">
          <h1 className="text-body-lg font-bold text-secondary leading-tight">Lumina Home Logic</h1>
          <p className="text-label-sm text-outline mt-1">Active Home System</p>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
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
        <header className="h-16 shrink-0 bg-surface-container border-b border-outline-variant/30 flex items-center justify-between px-6">
          <h2 className="text-headline-md font-semibold text-secondary">Dashboard Overview</h2>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-surface-container-low border border-outline-variant/30 px-4 py-2">
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
