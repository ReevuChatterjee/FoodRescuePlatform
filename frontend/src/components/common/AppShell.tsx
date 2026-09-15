import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../hooks/useAuthStore';
import { LogOut, LayoutDashboard, ClipboardList, Send, CheckCircle2 } from 'lucide-react';

export function AppShell() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navItemClass = (path: string) => {
    const isActive = location.pathname === path || (path !== '/admin' && path !== '/donor' && location.pathname.startsWith(path));
    return `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-emerald-800 text-white'
        : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'
    }`;
  };

  // Define nav links by role
  const roleNav = {
    ADMIN: [
      { path: '/admin', label: 'Overview', icon: LayoutDashboard },
      { path: '/admin/ngos/verify', label: 'Verification Queue', icon: CheckCircle2 },
    ],
    DONOR: [
      { path: '/donor', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/donor/donate', label: 'New Donation', icon: Send },
    ],
    NGO: [
      { path: '/ngo', label: 'Dashboard', icon: LayoutDashboard },
    ],
    DRIVER: [
      { path: '/driver', label: 'Dashboard', icon: LayoutDashboard },
    ],
  };

  const currentRoleNav = user ? roleNav[user.role] : [];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-emerald-900 text-white flex flex-col border-r border-emerald-950 shadow-md z-10">
        <div className="h-16 flex items-center px-6 border-b border-emerald-800">
          <h1 className="text-lg font-bold tracking-tight">CPI Logistics</h1>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1">
          {currentRoleNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} className={navItemClass(item.path)}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-800 flex items-center justify-between">
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-emerald-50 truncate">{user?.name}</p>
            <p className="text-xs text-emerald-300 font-mono tracking-wider">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-md transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-50">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
