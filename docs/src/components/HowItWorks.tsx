import { motion } from 'framer-motion';
import { useInView } from '@/hooks/useAnimations';
import { Globe, Zap, Radio, Bell } from 'lucide-react';

const steps = [
  {
    icon: Globe,
    title: 'You Open the App',
    description: 'Whether on web or mobile, every request flows through a secure API gateway that handles authentication and routing.',
  },
  {
    icon: Zap,
    title: 'Smart Services Handle Your Request',
    description: 'Behind the scenes, 8 specialised services each own a piece of the platform your feed, your jobs, your messages. No single point of failure.',
  },
  {
    icon: Radio,
    title: 'Events Flow in Real Time',
    description: 'When something happens, a new job post, a message, an RSVP — an event ripples instantly across the platform. No delays. No missed updates.',
  },
  {
    icon: Bell,
    title: 'You Get Notified',
    description: 'The notification engine listens to everything happening on the platform and sends you only what matters by email, push notification, or in-app alert.',
  },
];

export default function HowItWorks() {
  const { ref, isInView } = useInView();

  return (
    <section id="how-it-works" className="relative py-32">
      <div className="gradient-divider" />
      <div ref={ref} className="mx-auto max-w-3xl px-4 pt-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Engineered for Scale
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A peek under the hood — built the right way.
          </p>
        </motion.div>

        <div className="relative mt-16">
          {/* Animated line */}
          <motion.div
            initial={{ scaleY: 0 }}
            animate={isInView ? { scaleY: 1 } : {}}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            className="absolute left-8 top-0 h-full w-px origin-top bg-gradient-to-b from-primary via-accent to-transparent md:left-1/2"
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.3 }}
                className="relative mb-16 last:mb-0 pl-20 md:pl-0"
              >
                {/* Node dot */}
                <div className="absolute left-6 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-background md:left-1/2 md:-translate-x-1/2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>

                <div className={`md:w-5/12 ${i % 2 === 0 ? 'md:pr-16' : 'md:ml-auto md:pl-16'}`}>
                  <div className="rounded-xl border border-border bg-card p-6">
                    <Icon className="h-6 w-6 text-primary" />
                    <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
