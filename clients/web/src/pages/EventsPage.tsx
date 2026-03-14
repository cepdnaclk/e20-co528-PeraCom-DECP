import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Calendar, MapPin, Users, Clock, Plus, Search, Filter } from 'lucide-react';

const events = [
  { id: '1', title: 'AI & Machine Learning Workshop', type: 'workshop', date: 'Mar 12, 2026', time: '2:00 PM', location: 'Room 301, CS Building', attendees: 45, max: 60, status: 'upcoming' as const, description: 'Hands-on workshop covering latest ML frameworks and techniques.' },
  { id: '2', title: 'Alumni Career Talk: Tech Industry', type: 'alumni-talk', date: 'Mar 15, 2026', time: '4:00 PM', location: 'Main Auditorium', attendees: 120, max: 200, status: 'upcoming' as const, description: 'Alumni panel discussing career paths in the tech industry.' },
  { id: '3', title: 'Spring Hackathon 2026', type: 'hackathon', date: 'Mar 20-22, 2026', time: 'All day', location: 'Innovation Hub', attendees: 80, max: 100, status: 'upcoming' as const, description: '48-hour hackathon focused on social impact projects.' },
  { id: '4', title: 'Research Methodology Seminar', type: 'seminar', date: 'Mar 25, 2026', time: '10:00 AM', location: 'Conference Room A', attendees: 30, max: 40, status: 'upcoming' as const, description: 'Learn best practices for academic research methodology.' },
  { id: '5', title: 'Cloud Computing Workshop', type: 'workshop', date: 'Feb 28, 2026', time: '3:00 PM', location: 'Lab 102', attendees: 35, max: 35, status: 'completed' as const, description: 'Introduction to cloud platforms and deployment.' },
];

const typeColors: Record<string, string> = {
  workshop: 'bg-info/15 text-info',
  seminar: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'alumni-talk': 'bg-accent text-accent-foreground',
  hackathon: 'bg-warning/15 text-warning',
};

const EventsPage = () => {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground">Discover and attend department events</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Create Event
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="h-9 w-full rounded-lg border bg-secondary pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search events..." />
        </div>
        <div className="flex gap-2">
          {['all', 'workshop', 'seminar', 'alumni-talk', 'hackathon'].map((t) => (
            <button key={t} onClick={() => setFilter(t)} className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              filter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}>
              {t === 'alumni-talk' ? 'Talks' : t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((event) => (
          <div key={event.id} className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', typeColors[event.type])}>
                {event.type.replace('-', ' ')}
              </span>
              {event.status === 'completed' && <span className="text-xs text-muted-foreground">Completed</span>}
            </div>
            <h3 className="mb-2 text-base font-semibold text-card-foreground group-hover:text-primary transition-colors">{event.title}</h3>
            <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{event.description}</p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {event.date}</div>
              <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {event.time}</div>
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {event.location}</div>
              <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {event.attendees}/{event.max} attending</div>
            </div>
            {event.status === 'upcoming' && (
              <button className="mt-4 w-full rounded-lg border border-primary bg-primary/5 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
                RSVP
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsPage;
