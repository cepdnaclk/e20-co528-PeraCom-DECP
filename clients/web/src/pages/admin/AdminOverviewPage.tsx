import { useState, useEffect } from "react";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Calendar,
  Briefcase,
  FlaskConical,
} from "lucide-react";
import api from "@/services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";

interface DashboardStats {
  users: { value: number; trend: { value: number; positive: boolean } };
  events: { value: number; trend: { value: number; positive: boolean } };
  jobs: { value: number; trend: { value: number; positive: boolean } };
  researches: { value: number; trend: { value: number; positive: boolean } };
}

const DEFAULT_STATS: DashboardStats = {
  users: { value: 0, trend: { value: 0, positive: true } },
  events: { value: 0, trend: { value: 0, positive: true } },
  jobs: { value: 0, trend: { value: 0, positive: true } },
  researches: { value: 0, trend: { value: 0, positive: true } },
};

const CHART_DATA = [
  { name: 'Jan', users: 400, events: 24, jobs: 24 },
  { name: 'Feb', users: 300, events: 13, jobs: 22 },
  { name: 'Mar', users: 200, events: 58, jobs: 22 },
  { name: 'Apr', users: 278, events: 39, jobs: 20 },
  { name: 'May', users: 189, events: 48, jobs: 21 },
  { name: 'Jun', users: 239, events: 38, jobs: 25 },
];

const AdminOverviewPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);

  const getDashboradData = async () => {
    console.log("Fetching dashboard data for user:", user?.userId);

    try {
      const response = await api.get("admin/dashboard");
      console.log("Dashboard data response:", response.data);
      // setStats if real data comes here
    } catch (error) {
      console.error(
        "Failed to fetch dashboard data:",
        error.response?.data?.message || error.message,
      );
    }
  };

  useEffect(() => {
    if (user?.userId) {
      getDashboradData();
    }
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.users.value}
          icon={<Users className="h-5 w-5" />}
          trend={stats.users.trend}
        />
        <StatCard
          title="Active Events"
          value={stats.events.value}
          icon={<Calendar className="h-5 w-5" />}
          trend={stats.events.trend}
        />
        <StatCard
          title="Job Posts"
          value={stats.jobs.value}
          icon={<Briefcase className="h-5 w-5" />}
          trend={stats.jobs.trend}
        />
        <StatCard
          title="Research Projects"
          value={stats.researches.value}
          icon={<FlaskConical className="h-5 w-5" />}
          trend={stats.researches.trend}
        />
      </div>

      {/* Charts space replacing User Management */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Line Chart */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Platform Growth</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CHART_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#8884d8" opacity={0.2} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={2} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-card-foreground">Activity Overview</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CHART_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#8884d8" opacity={0.2} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend />
                <Bar dataKey="events" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="jobs" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverviewPage;
