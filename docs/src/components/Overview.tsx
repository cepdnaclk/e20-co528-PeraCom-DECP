import { motion } from "framer-motion";
import { useInView } from "@/hooks/useAnimations";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

export default function Overview() {
  const { ref, isInView } = useInView();

  return (
    <section id="overview" className="relative py-32 grid-pattern">
      <div className="gradient-divider" />
      <div ref={ref} className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Text */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              A Platform Built for the Modern University
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              DECP — Department Engagement & Career Platform — is a full-stack
              university social and professional network. It gives students a
              space to grow their careers, alumni a way to give back, and admins
              the tools to keep the community thriving.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              It was designed from the ground up with enterprise-grade
              architecture: microservices, real-time messaging, event-driven
              notifications, and a cloud-ready deployment model.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                "🎓 University of Peradeniya",
                "💻 CO528 Project",
                "🚀 Cloud-Native",
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-secondary/50 px-4 py-1.5 font-mono text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Visual */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center justify-center"
          >
            <div className="animate-float rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-primary/5">
              {/* Fake dashboard mockup */}
              <div className="w-full max-w-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                  <div className="ml-auto font-mono text-[10px] text-muted-foreground">
                    decp.ce.pdn.ac.lk
                  </div>
                </div>
                <div className="h-px w-full bg-border" />
                <div className="space-y-3">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted/60" />
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-20 rounded-lg bg-muted/40 border border-border"
                      />
                    ))}
                  </div>
                  <div className="h-3 w-2/3 rounded bg-muted/40" />
                  <div className="flex gap-2">
                    <div className="h-8 w-20 rounded-md bg-primary/30" />
                    <div className="h-8 w-20 rounded-md bg-muted/30" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
