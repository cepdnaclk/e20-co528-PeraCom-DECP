import { motion } from "framer-motion";
import { useInView } from "@/hooks/useAnimations";

const layers = [
  {
    label: "Clients",
    items: [
      { name: "Web Client", color: "bg-primary/20 border-primary/30" },
      { name: "Mobile Client", color: "bg-primary/20 border-primary/30" },
    ],
    connector: "HTTPS",
  },
  {
    label: "Gateway",
    items: [
      {
        name: "Kong API Gateway",
        subtitle: "Security · Routing · Rate Limiting",
        color: "bg-primary/30 border-primary/40",
        wide: true,
      },
    ],
    connector: "REST API",
  },
  {
    label: "Services",
    items: [
      { name: "Identity", color: "bg-blue-500/15 border-blue-500/30" },
      { name: "Engagement", color: "bg-cyan-500/15 border-cyan-500/30" },
      { name: "Career", color: "bg-teal-500/15 border-teal-500/30" },
      { name: "Events", color: "bg-indigo-500/15 border-indigo-500/30" },
      { name: "Collaboration", color: "bg-violet-500/15 border-violet-500/30" },
      { name: "Messaging", color: "bg-sky-500/15 border-sky-500/30" },
      {
        name: "Notification",
        color: "bg-emerald-500/15 border-emerald-500/30",
      },
      { name: "Analytics", color: "bg-rose-500/15 border-rose-500/30" },
    ],
    connector: "Events",
  },
  {
    label: "Streaming",
    items: [
      {
        name: "Apache Kafka",
        subtitle: "Real-Time Event Streaming",
        color: "bg-amber-500/20 border-amber-500/30",
        wide: true,
        pulse: true,
      },
    ],
    connector: "Persists to",
  },
  {
    label: "Storage",
    items: [
      { name: "PostgreSQL", color: "bg-blue-600/15 border-blue-600/30" },
      { name: "MongoDB", color: "bg-green-600/15 border-green-600/30" },
      { name: "Redis + MinIO", color: "bg-red-500/15 border-red-500/30" },
    ],
  },
];

export default function Architecture() {
  const { ref, isInView } = useInView();

  return (
    <section id="architecture" className="relative py-32 grid-pattern">
      <div className="gradient-divider" />
      <div ref={ref} className="mx-auto max-w-4xl px-4 pt-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Architecture at a Glance
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Designed with enterprise patterns used by LinkedIn and Slack.
          </p>
        </motion.div>

        <div className="mt-16 space-y-4">
          {layers.map((layer, li) => (
            <motion.div
              key={layer.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: li * 0.2 }}
            >
              {/* Items */}
              <div
                className={`flex flex-wrap items-stretch justify-center gap-3 ${layer.label === "Services" ? "" : ""}`}
              >
                {layer.items.map((item) => (
                  <div
                    key={item.name}
                    className={`rounded-xl border px-6 py-4 text-center ${item.color} ${item.wide ? "w-full" : "flex-1 min-w-[120px]"} ${item.pulse ? "animate-pulse-glow" : ""}`}
                  >
                    <div className="font-display text-sm font-semibold text-foreground">
                      {item.name}
                    </div>
                    {item.subtitle && (
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Connector */}
              {layer.connector && (
                <div className="flex flex-col items-center py-2">
                  <div className="h-6 w-px bg-border" />
                  <span className="rounded-full bg-secondary px-3 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {layer.connector}
                  </span>
                  <div className="h-6 w-px bg-border" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
