import { useState } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { cn } from '@/lib/utils';
import { Search, Filter, MessageSquare, Building, GraduationCap, MapPin } from 'lucide-react';

const alumniData = [
  { id: '1', name: 'Sarah Chen', gradYear: 2020, company: 'TechCorp', title: 'Senior Software Engineer', location: 'San Francisco', skills: ['React', 'Node.js', 'AWS'], online: true, industry: 'Technology' },
  { id: '2', name: 'James Miller', gradYear: 2018, company: 'Google', title: 'Product Manager', location: 'Mountain View', skills: ['Product Strategy', 'Analytics'], online: false, industry: 'Technology' },
  { id: '3', name: 'Priya Sharma', gradYear: 2019, company: 'Goldman Sachs', title: 'Quantitative Analyst', location: 'New York', skills: ['Python', 'Machine Learning', 'Finance'], online: true, industry: 'Finance' },
  { id: '4', name: 'David Kim', gradYear: 2021, company: 'Meta', title: 'ML Engineer', location: 'Seattle', skills: ['PyTorch', 'Computer Vision'], online: false, industry: 'Technology' },
  { id: '5', name: 'Emily Brown', gradYear: 2017, company: 'McKinsey', title: 'Associate Partner', location: 'Chicago', skills: ['Strategy', 'Data Analytics'], online: true, industry: 'Consulting' },
  { id: '6', name: 'Carlos Rodriguez', gradYear: 2022, company: 'Stripe', title: 'Full Stack Developer', location: 'Remote', skills: ['TypeScript', 'Go', 'PostgreSQL'], online: true, industry: 'FinTech' },
];

const AlumniPage = () => {
  const [industryFilter, setIndustryFilter] = useState('all');
  const industries = ['all', ...new Set(alumniData.map(a => a.industry))];
  const filtered = industryFilter === 'all' ? alumniData : alumniData.filter(a => a.industry === industryFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alumni Network</h1>
        <p className="text-muted-foreground">Connect with alumni across industries</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="h-9 w-full rounded-lg border bg-secondary pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search alumni..." />
        </div>
        <div className="flex gap-2">
          {industries.map((ind) => (
            <button key={ind} onClick={() => setIndustryFilter(ind)} className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              industryFilter === ind ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}>
              {ind}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((alumni) => (
          <div key={alumni.id} className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="mb-4 flex items-start gap-3">
              <UserAvatar name={alumni.name} size="lg" online={alumni.online} />
              <div>
                <h3 className="text-base font-semibold text-card-foreground">{alumni.name}</h3>
                <p className="text-sm text-muted-foreground">{alumni.title}</p>
              </div>
            </div>
            <div className="mb-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><Building className="h-3.5 w-3.5" /> {alumni.company}</div>
              <div className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5" /> Class of {alumni.gradYear}</div>
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {alumni.location}</div>
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {alumni.skills.map((skill) => (
                <span key={skill} className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">{skill}</span>
              ))}
            </div>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/5 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
              <MessageSquare className="h-4 w-4" /> Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlumniPage;
