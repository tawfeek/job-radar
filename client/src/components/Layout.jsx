import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { HiViewBoards, HiOutlineCog, HiLogout } from 'react-icons/hi';
import { setToken } from '../api/client';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken(null);
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-surface-50">
      <aside className="w-60 bg-white border-r border-surface-200 flex flex-col">
        <div className="p-5 border-b border-surface-200 flex items-center gap-2">
          <img src="/logo.svg" alt="" className="w-7 h-7" />
          <span className="font-bold text-lg text-surface-900">JobRadar</span>
        </div>

        <nav className="p-3 flex-1 space-y-1">
          <NavItem to="/" icon={<HiViewBoards className="w-4 h-4" />} label="Kanban" end />
          <NavItem to="/profiles" icon={<HiOutlineCog className="w-4 h-4" />} label="Profiles" />
        </nav>

        <button
          onClick={handleLogout}
          className="m-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-600 hover:bg-surface-100 transition"
        >
          <HiLogout className="w-4 h-4" /> Log out
        </button>
      </aside>

      <main className="flex-1 p-8 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
          isActive
            ? 'bg-primary-50 text-primary-700 font-semibold'
            : 'text-surface-600 hover:bg-surface-100'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
