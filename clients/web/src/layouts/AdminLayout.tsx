import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Calendar, Briefcase, FlaskConical,
  MessageSquare, LogOut, Menu, ChevronLeft, Shield,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Events', icon: Calendar, path: '/admin/events' },
  { label: 'Jobs', icon: Briefcase, path: '/admin/jobs' },
  { label: 'Research', icon: FlaskConical, path: '/admin/research' },
  { label: 'Posts', icon: MessageSquare, path: '/admin/posts' },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar transition-all duration-300 lg:relative',
        sidebarOpen ? 'w-64' : 'w-16',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        <div className={cn('flex h-16 items-center border-b border-sidebar-border px-4', !sidebarOpen && 'justify-center')}>
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive font-bold text-destructive-foreground text-sm">
                <Shield className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold text-sidebar-primary-foreground">Admin</span>
            </div>
          ) : (
            <Shield className="h-5 w-5 text-destructive" />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <ul className="space-y-1">
            {adminNav.map((item) => {
              const active = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active ? 'bg-sidebar-primary/15 text-sidebar-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent',
                      !sidebarOpen && 'justify-center px-2',
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden h-12 items-center justify-center border-t border-sidebar-border text-sidebar-foreground lg:flex">
          <ChevronLeft className={cn('h-5 w-5 transition-transform', !sidebarOpen && 'rotate-180')} />
        </button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden"><Menu className="h-6 w-6" /></button>
            <h1 className="text-lg font-semibold text-foreground">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <UserAvatar name={user?.name || 'Admin'} size="sm" />
            <button onClick={handleLogout} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
