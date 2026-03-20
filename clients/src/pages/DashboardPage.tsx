import { useAuth } from '@/contexts/AuthContext';
import StatCard from '@/components/StatCard';
import UserAvatar from '@/components/UserAvatar';
import RoleBadge from '@/components/RoleBadge';
import { MessageSquare, FlaskConical, Calendar, Briefcase, TrendingUp, Users, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const recentMessages = [
  { id: '1', name: 'Sarah Chen', message: 'Sure, let\'s schedule the meeting for Friday.', time: '2m ago', online: true },
  { id: '2', name: 'Dr. Kumar', message: 'The research proposal looks great!', time: '1h ago', online: false },
  { id: '3', name: 'Mike Ross', message: 'Thanks for the internship referral!', time: '3h ago', online: true },
];

const upcomingEvents = [
  { id: '1', title: 'AI & ML Workshop', date: 'Mar 12, 2026', type: 'Workshop', attendees: 45 },
  { id: '2', title: 'Alumni Career Talk', date: 'Mar 15, 2026', type: 'Talk', attendees: 120 },
  { id: '3', title: 'Spring Hackathon', date: 'Mar 20, 2026', type: 'Hackathon', attendees: 80 },
];

const latestJobs = [
  { id: '1', title: 'Frontend Engineer', company: 'TechCorp', type: 'Full-time', location: 'Remote' },
  { id: '2', title: 'ML Intern', company: 'DataLabs', type: 'Internship', location: 'New York' },
  { id: '3', title: 'Backend Developer', company: 'StartupXYZ', type: 'Full-time', location: 'San Francisco' },
];

const DashboardPage = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground">Here's what's happening in your department community</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Unread Messages" value={5} icon={<MessageSquare className="h-5 w-5" />} trend={{ value: 12, positive: true }} />
        <StatCard title="Active Research" value={3} icon={<FlaskConical className="h-5 w-5" />} />
        <StatCard title="Upcoming Events" value={7} icon={<Calendar className="h-5 w-5" />} trend={{ value: 20, positive: true }} />
        <StatCard title="New Job Posts" value={12} icon={<Briefcase className="h-5 w-5" />} trend={{ value: 8, positive: true }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Messages */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-card-foreground">Recent Messages</h2>
            <Link to="/messages" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-secondary">
                <UserAvatar name={msg.name} size="sm" online={msg.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{msg.name}</p>
                    <span className="text-xs text-muted-foreground">{msg.time}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-card-foreground">Upcoming Events</h2>
            <Link to="/events" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((evt) => (
              <div key={evt.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{evt.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {evt.date}
                    </div>
                  </div>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{evt.type}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {evt.attendees} attending
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Jobs */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-card-foreground">Latest Jobs</h2>
            <Link to="/jobs" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {latestJobs.map((job) => (
              <div key={job.id} className="rounded-lg border p-3 transition-colors hover:bg-secondary">
                <p className="text-sm font-medium text-foreground">{job.title}</p>
                <p className="text-xs text-muted-foreground">{job.company}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{job.type}</span>
                  <span className="text-xs text-muted-foreground">{job.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
