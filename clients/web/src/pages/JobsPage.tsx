import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Briefcase, MapPin, Clock, Bookmark, Search, Building, ExternalLink } from 'lucide-react';

const jobs = [
  { id: '1', title: 'Frontend Engineer', company: 'TechCorp', location: 'San Francisco, CA', type: 'full-time' as const, remote: true, industry: 'Technology', posted: '2 days ago', applicants: 24, description: 'Build beautiful user interfaces with React and TypeScript.' },
  { id: '2', title: 'Machine Learning Intern', company: 'DataLabs AI', location: 'New York, NY', type: 'internship' as const, remote: false, industry: 'AI/ML', posted: '1 week ago', applicants: 56, description: 'Work on cutting-edge ML models for NLP applications.' },
  { id: '3', title: 'Backend Developer', company: 'StartupXYZ', location: 'Austin, TX', type: 'full-time' as const, remote: true, industry: 'Technology', posted: '3 days ago', applicants: 18, description: 'Design and implement scalable API services.' },
  { id: '4', title: 'Data Analyst', company: 'FinanceHub', location: 'Chicago, IL', type: 'full-time' as const, remote: false, industry: 'Finance', posted: '5 days ago', applicants: 32, description: 'Analyze financial datasets and generate actionable insights.' },
  { id: '5', title: 'UX Design Intern', company: 'DesignStudio', location: 'Remote', type: 'internship' as const, remote: true, industry: 'Design', posted: '1 day ago', applicants: 41, description: 'Help design user experiences for mobile and web products.' },
  { id: '6', title: 'DevOps Engineer', company: 'CloudScale', location: 'Seattle, WA', type: 'contract' as const, remote: true, industry: 'Technology', posted: '4 days ago', applicants: 15, description: 'Manage CI/CD pipelines and cloud infrastructure.' },
];

const typeColors: Record<string, string> = {
  'full-time': 'bg-success/15 text-success',
  'internship': 'bg-info/15 text-info',
  'part-time': 'bg-warning/15 text-warning',
  'contract': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const JobsPage = () => {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs & Internships</h1>
          <p className="text-muted-foreground">Discover career opportunities from alumni and partners</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="h-9 w-full rounded-lg border bg-secondary pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search jobs..." />
        </div>
        <div className="flex gap-2">
          {['all', 'full-time', 'internship', 'contract'].map((t) => (
            <button key={t} onClick={() => setFilter(t)} className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              filter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((job) => (
          <div key={job.id} className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-card-foreground group-hover:text-primary transition-colors">{job.title}</h3>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', typeColors[job.type])}>{job.type}</span>
                  {job.remote && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Remote</span>}
                </div>
                <p className="mb-2 text-sm text-muted-foreground">{job.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" /> {job.company}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {job.posted}</span>
                  <span>{job.applicants} applicants</span>
                </div>
              </div>
              <div className="flex gap-2 sm:flex-col">
                <button className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:flex-none">Apply</button>
                <button className="rounded-lg border p-2 text-muted-foreground hover:bg-secondary"><Bookmark className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobsPage;
