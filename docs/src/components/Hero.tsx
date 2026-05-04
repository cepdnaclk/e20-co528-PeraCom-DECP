import { motion } from "framer-motion";
import { useInView, useCountUp } from "@/hooks/useAnimations";
import { ChevronDown, ExternalLink } from "lucide-react";
import ParticleField from "./ParticleField";

const words = ["Where,", "Students & Alumni", "Connect."];

const stats = [
  { label: "Microservices", value: 8 },
  { label: "User Roles", value: 3 },
  { label: "Event Streams", value: 8, prefix: "", suffix: "+" },
  { label: "Clients", value: 2 },
];

function StatCounter({
  label,
  value,
  suffix,
  isInView,
}: {
  label: string;
  value: number;
  suffix?: string;
  isInView: boolean;
}) {
  const count = useCountUp(value, 1500, isInView);
  return (
    <div className="text-center">
      <div className="font-display text-3xl font-bold text-foreground">
        {count}
        {suffix}
      </div>
      <div className="mt-1 font-mono text-xs text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export default function Hero() {
  const { ref: statsRef, isInView: statsVisible } = useInView();

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Gradient mesh background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-1/4 top-1/3 h-80 w-80 rounded-full bg-accent/15 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <ParticleField />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 font-mono text-xs text-muted-foreground"
        >
          <span className="text-primary">✦</span>
          CO528 — Applied Software Architecture · University of Peradeniya
        </motion.div>

        {/* Headline */}
        <h1 className="font-display text-5xl font-extrabold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-6xl lg:text-7xl">
          {words.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.2, duration: 0.5 }}
              className={`block ${i === 2 ? "gradient-text" : ""}`}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
        >
          DECP is a cloud-native university engagement platform that bridges the
          gap between current students and alumni through a
          modern, event-driven architecture built for scale.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_25px_rgba(26,86,219,0.4)]"
          >
            Explore the Platform
          </a>
          <a
            href="https://github.com/cepdnaclk/PeraCom-DECP"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm text-foreground transition-all hover:border-muted-foreground"
          >
            View on GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          ref={statsRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8 }}
          className="mx-auto mt-16 grid max-w-lg grid-cols-2 gap-8 sm:grid-cols-4"
        >
          {stats.map((s) => (
            <StatCounter key={s.label} {...s} isInView={statsVisible} />
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2 }}
        className="absolute bottom-8 animate-bounce-slow"
      >
        <ChevronDown className="h-6 w-6 text-muted-foreground" />
      </motion.div>
    </section>
  );
}
