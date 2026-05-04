import { motion } from 'framer-motion';
import { useInView } from '@/hooks/useAnimations';

const roles = [
  {
    icon: '🎓',
    title: 'Students',
    tagline: 'Your Career Starts Here',
    description:
      'Browse and apply for jobs and internships, connect with alumni mentors, share your projects, join department events, and collaborate on research — all in one place.',
    highlights: ['Job Applications', 'Social Feed', 'Events', 'Messaging'],
    color: 'from-primary/80 to-primary/40',
    borderColor: 'hover:border-primary/50',
    glowColor: 'hover:shadow-primary/10',
  },
  {
    icon: '🏆',
    title: 'Alumni',
    tagline: 'Give Back. Stay Connected.',
    description:
      'Post job openings at your company, mentor current students, create research collaboration projects, and stay engaged with the department community you grew up in.',
    highlights: ['Job Postings', 'Research Projects', 'Mentoring', 'Networking'],
    color: 'from-accent/80 to-accent/40',
    borderColor: 'hover:border-accent/50',
    glowColor: 'hover:shadow-accent/10',
  },
  {
    icon: '⚙️',
    title: 'Admin',
    tagline: 'Full Control. Total Visibility.',
    description:
      'Manage the entire platform — provision student accounts in bulk, moderate content, publish events and announcements, and monitor platform health with a real-time analytics dashboard.',
    highlights: ['Bulk Provisioning', 'Analytics', 'Moderation', 'Events'],
    color: 'from-purple-500/80 to-purple-500/40',
    borderColor: 'hover:border-purple-500/50',
    glowColor: 'hover:shadow-purple-500/10',
  },
];

export default function UserRoles() {
  const { ref, isInView } = useInView();

  return (
    <section className="relative py-32">
      <div className="gradient-divider" />
      <div ref={ref} className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for Everyone in the Department
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Three distinct experiences, one unified platform.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {roles.map((role, i) => (
            <motion.div
              key={role.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className={`group relative rounded-2xl border border-border bg-card p-8 transition-all duration-300 ${role.borderColor} ${role.glowColor} hover:-translate-y-2 hover:shadow-xl`}
            >
              {/* Gradient top border */}
              <div className={`absolute left-0 right-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${role.color}`} />

              <div className="text-4xl">{role.icon}</div>
              <h3 className="mt-4 font-display text-xl font-bold text-foreground">{role.title}</h3>
              <p className="mt-1 font-mono text-xs text-primary">{role.tagline}</p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{role.description}</p>

              <div className="mt-6 flex flex-wrap gap-2">
                {role.highlights.map((h) => (
                  <span
                    key={h}
                    className="rounded-md bg-muted/50 px-2.5 py-1 font-mono text-[10px] text-muted-foreground"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
