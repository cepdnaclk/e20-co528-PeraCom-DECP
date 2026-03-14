import { useState } from 'react';
import UserAvatar from '@/components/UserAvatar';
import RoleBadge from '@/components/RoleBadge';
import { cn } from '@/lib/utils';
import { FlaskConical, Plus, Search, Users, Clock, Tag, Filter } from 'lucide-react';

const projects = [
  { id: '1', title: 'AI-Powered Medical Diagnosis', description: 'Developing ML models for early disease detection using patient data.', status: 'ongoing' as const, owner: 'Dr. Kumar', collaborators: 3, tags: ['AI', 'Healthcare', 'Python'], date: 'Jan 2026' },
  { id: '2', title: 'Quantum Computing Algorithms', description: 'Research into quantum algorithms for optimization problems.', status: 'ongoing' as const, owner: 'Prof. Lee', collaborators: 5, tags: ['Quantum', 'Algorithms'], date: 'Feb 2026' },
  { id: '3', title: 'Sustainable Urban Planning', description: 'Using data analytics to optimize city infrastructure and reduce emissions.', status: 'draft' as const, owner: 'Sarah Chen', collaborators: 2, tags: ['Data Science', 'Sustainability'], date: 'Mar 2026' },
  { id: '4', title: 'NLP for Regional Languages', description: 'Building NLP tools for underrepresented regional languages.', status: 'completed' as const, owner: 'Alex Johnson', collaborators: 4, tags: ['NLP', 'Linguistics'], date: 'Dec 2025' },
];

const statusColors = {
  draft: 'bg-muted text-muted-foreground',
  ongoing: 'bg-success/15 text-success',
  completed: 'bg-info/15 text-info',
  cancelled: 'bg-destructive/15 text-destructive',
};

const ResearchPage = () => {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Research Collaborations</h1>
          <p className="text-muted-foreground">Explore and collaborate on research projects</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="h-9 w-full rounded-lg border bg-secondary pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search projects..." />
        </div>
        <div className="flex gap-2">
          {['all', 'ongoing', 'draft', 'completed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                filter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Project Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((project) => (
          <div key={project.id} className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="mb-3 flex items-start justify-between">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', statusColors[project.status])}>
                {project.status}
              </span>
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-card-foreground group-hover:text-primary transition-colors">{project.title}</h3>
            <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{project.description}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">{tag}</span>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><Users className="h-3 w-3" /> {project.collaborators} collaborators</div>
              <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {project.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResearchPage;
