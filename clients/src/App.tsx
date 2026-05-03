import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/layouts/DashboardLayout";
import AdminLayout from "@/layouts/AdminLayout";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import MessagesPage from "@/pages/MessagesPage";
import ResearchPage from "@/pages/ResearchPage";
import EventsPage from "@/pages/EventsPage";
import JobsPage from "@/pages/JobsPage";
import JobsManagementPage from "@/pages/JobsManagementPage";
import ViewJobPage from "@/pages/ViewJobPage";
import ApplyJobPage from "@/pages/ApplyJobPage";
import AlumniPage from "@/pages/AlumniPage";
import ProfilePage from "@/pages/ProfilePage";
import SocialFeedPage from "@/pages/SocialFeedPage";
import AdminOverviewPage from "@/pages/admin/AdminOverviewPage";
import UserManagement from "@/pages/admin/UserManagement";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user?.role === "ADMIN" ? "/admin" : "/feed"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Student & Alumni routes */}
            {[
              "/dashboard",
              "/feed",
              "/messages",
              "/research",
              "/events",
              "/jobs",
              "/people",
              "/profile",
              "/profile/:id",
              "/jobs/view/:id",
              "/jobs/apply/:id"
            ].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute allowedRoles={["ALUMNI", "STUDENT"]}>
                    <DashboardLayout>
                      {path === "/feed" && <SocialFeedPage />}
                      {path === "/dashboard" && <DashboardPage />}
                      {path === "/messages" && <MessagesPage />}
                      {path === "/research" && <ResearchPage />}
                      {path === "/events" && <EventsPage />}
                      {path === "/jobs" && <JobsPage />}
                      {path === "/people" && <AlumniPage />}
                      {(path === "/profile" || path === "/profile/:id") && <ProfilePage />}
                      {path === "/jobs/view/:id" && <ViewJobPage />}
                      {path === "/jobs/apply/:id" && <ApplyJobPage />}
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
            ))}

            {/* Alumni routes */}
            <Route
              path="/jobs/manage"
              element={
                <ProtectedRoute allowedRoles={["ALUMNI"]}>
                  <DashboardLayout>
                    <JobsManagementPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            {[
              "/admin",
              "/admin/users",
              "/admin/events",
              "/admin/jobs",
              "/admin/research",
              "/admin/posts",
              "/admin/jobs/view/:id"
            ].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <AdminLayout>
                      {path === "/admin" && <AdminOverviewPage />}
                      {path === "/admin/users" && <UserManagement />}
                      {path === "/admin/events" && <EventsPage />}
                      {path === "/admin/jobs" && <JobsManagementPage />}
                      {path === "/admin/research" && <ResearchPage />}
                      {path === "/admin/posts" && <SocialFeedPage />}
                      {path === "/admin/jobs/view/:id" && <ViewJobPage />}
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />
            ))}

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
