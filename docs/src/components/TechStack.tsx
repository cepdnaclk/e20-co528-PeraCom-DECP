import { motion } from 'framer-motion';
import { useInView } from '@/hooks/useAnimations';

const groups = [
  {
    label: 'Backend & APIs',
    items: ['NestJS', 'Node.js', 'TypeScript', 'Kong Gateway'],
  },
  {
    label: 'Frontend',
    items: ['React', 'TypeScript', 'Vite', 'Material UI'],
  },
  {
    label: 'Event Streaming',
    items: ['Apache Kafka'],
  },
  {
    label: 'Databases',
    items: ['PostgreSQL', 'MongoDB', 'Redis', 'MinIO'],
  },
  {
    label: 'Infrastructure',
    items: ['Docker', 'Kubernetes', 'GitHub Actions'],
  },
  {
    label: 'Observability',
    items: ['Prometheus', 'Grafana', 'ELK Stack', 'OpenTelemetry'],
  },
];

export default function TechStack() {
  const { ref, isInView } = useInView();

  return (
    <section id="tech-stack" className="relative py-32">
      <div className="gradient-divider" />
      <div ref={ref} className="mx-auto max-w-5xl px-4 pt-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built With
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Industry-grade tools, from code to cloud.
          </p>
        </motion.div>

        <div className="mt-16 space-y-10">
          {groups.map((group, gi) => (
            <motion.div
              key={group.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: gi * 0.1 }}
            >
              <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {group.label}
              </h3>
              <div className="flex flex-wrap gap-3">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="shimmer-hover rounded-lg border border-border bg-card px-4 py-2.5 font-mono text-sm text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30"
                  >
                    {item}
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
