import { motion } from 'framer-motion';
import { useInView } from '@/hooks/useAnimations';
import {
  Newspaper, Briefcase, CalendarDays, Microscope,
  MessageCircle, Bell, UserCog, BarChart3,
} from 'lucide-react';

const features = [
  { icon: Newspaper, title: 'Social Feed', desc: 'Share updates, media, and ideas with your department community.', span: 'md:col-span-2' },
  { icon: Briefcase, title: 'Jobs & Internships', desc: 'Post and discover career opportunities. Apply with one click.', span: '' },
  { icon: CalendarDays, title: 'Events & Announcements', desc: 'Create and RSVP to department events, workshops, and seminars.', span: '' },
  { icon: Microscope, title: 'Research Collaboration', desc: 'Form research teams, share documents, invite collaborators.', span: 'md:col-span-2' },
  { icon: MessageCircle, title: 'Real-Time Messaging', desc: 'Direct messages and group chats, delivered instantly.', span: '' },
  { icon: Bell, title: 'Smart Notifications', desc: 'Never miss a job update, event invite, or message. Ever.', span: '' },
  { icon: UserCog, title: 'User Management', desc: 'Secure login, role-based access, and seamless onboarding.', span: '' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Admins get full platform visibility — users, posts, applications.', span: '' },
];

export default function Features() {
  const { ref, isInView } = useInView();

  return (
    <section id="features" className="relative py-32 grid-pattern">
      <div className="gradient-divider" />
      <div ref={ref} className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything a University Community Needs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Eight purpose-built modules, each independently scalable.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 ${f.span}`}
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(circle at 50% 0%, rgba(26,86,219,0.08), transparent 70%)' }}
                />
                <Icon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                <h3 className="mt-4 font-display text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
