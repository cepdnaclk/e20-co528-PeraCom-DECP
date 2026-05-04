import { motion } from "framer-motion";
import { useInView } from "@/hooks/useAnimations";
import { ExternalLink } from "lucide-react";

export default function CTA() {
  const { ref, isInView } = useInView();

  return (
    <section className="relative overflow-hidden py-32">
      <div className="gradient-divider" />
      {/* Animated gradient bg */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/3 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-80 w-80 rounded-full bg-purple-600/15 blur-[100px]" />
      </div>

      <div
        ref={ref}
        className="relative mx-auto max-w-2xl px-4 pt-16 text-center sm:px-6 lg:px-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Want to See How It's Built?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Explore the full source code, architecture diagrams, and technical
            documentation on GitHub.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/cepdnaclk/PeraCom-DECP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 font-display text-sm font-semibold text-background transition-all hover:opacity-90"
            >
              View on GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://github.com/cepdnaclk/PeraCom-DECP/tree/main/Planning"
              className="inline-flex items-center gap-2 rounded-xl border border-foreground/30 px-6 py-3 text-sm text-foreground transition-all hover:bg-foreground/10"
            >
              Read the Docs
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
