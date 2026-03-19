import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/UserAvatar";
import RoleBadge from "@/components/RoleBadge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  FlaskConical,
  Calendar,
  Briefcase,
  Users,
  User,
  Bell,
  Search,
  LogOut,
  Menu,
  ChevronLeft,
  Newspaper,
} from "lucide-react";

const studentNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Community", icon: Newspaper, path: "/feed" },
  { label: "Messages", icon: MessageSquare, path: "/messages" },
  { label: "Research", icon: FlaskConical, path: "/research" },
  { label: "Events", icon: Calendar, path: "/events" },
  { label: "Jobs", icon: Briefcase, path: "/jobs" },
  { label: "People", icon: Users, path: "/people" },
  { label: "Profile", icon: User, path: "/profile" },
];

const alumniNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Community", icon: Newspaper, path: "/feed" },
  { label: "Messages", icon: MessageSquare, path: "/messages" },
  { label: "Research", icon: FlaskConical, path: "/research" },
  { label: "Events", icon: Calendar, path: "/events" },
  { label: "Jobs", icon: Briefcase, path: "/jobs" },
  { label: "People", icon: Users, path: "/people" },
  { label: "Profile", icon: User, path: "/profile" },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navItems = user?.role === "ALUMNI" ? alumniNav : studentNav;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar transition-all duration-300 lg:relative",
          sidebarOpen ? "w-64" : "w-16",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-4",
            !sidebarOpen && "justify-center",
          )}
        >
          {sidebarOpen ? (
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground text-sm">
                D
              </div>
              <span className="text-lg font-bold text-sidebar-primary-foreground">
                DECP
              </span>
            </Link>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground text-sm">
              D
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary/15 text-sidebar-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      !sidebarOpen && "justify-center px-2",
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

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden h-12 items-center justify-center border-t border-sidebar-border text-sidebar-foreground hover:text-sidebar-accent-foreground lg:flex"
        >
          <ChevronLeft
            className={cn(
              "h-5 w-5 transition-transform",
              !sidebarOpen && "rotate-180",
            )}
          />
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden">
              <Menu className="h-6 w-6 text-muted-foreground" />
            </button>

            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users, research, events, jobs..."
                className="h-9 w-72 rounded-lg border bg-secondary pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring lg:w-96"
              />
            </div>
            <button
              className="sm:hidden"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setProfileOpen(false);
                }}
                className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border bg-card p-4 shadow-lg">
                  <h3 className="mb-3 text-sm font-semibold text-card-foreground">
                    Notifications
                  </h3>
                  {[
                    "New research invitation",
                    "Event tomorrow: AI Workshop",
                    "Job posting update",
                  ].map((n, i) => (
                    <div
                      key={i}
                      className="mb-2 rounded-lg bg-secondary p-3 text-sm text-foreground"
                    >
                      {n}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary"
              >
                <UserAvatar name={user?.name || "User"} size="sm" online />
                <div className="hidden text-left md:block">
                  <p className="text-sm font-medium text-foreground">
                    {user?.name}
                  </p>
                  <RoleBadge role={user?.role || "STUDENT"} size="sm" />
                </div>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-14 z-50 w-56 rounded-xl border bg-card py-2 shadow-lg">
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-secondary"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile search */}
        {searchOpen && (
          <div className="border-b bg-card p-3 sm:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                className="h-9 w-full rounded-lg border bg-secondary pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex border-t bg-card lg:hidden">
          {navItems.slice(0, 5).map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default DashboardLayout;
