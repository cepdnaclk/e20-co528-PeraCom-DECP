import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useScrollDirection } from "@/hooks/useAnimations";
import { Menu, X, ExternalLink } from "lucide-react";

const navLinks = [
  { label: "Overview", href: "#overview" },
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Team", href: "#team" },
  { label: "Built With", href: "#tech-stack" },
];

export default function Navbar() {
  const visible = useScrollDirection();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: -80 }}
          animate={{ y: 0 }}
          exit={{ y: -80 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl"
        >
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Logo */}
            <a
              href="#"
              className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              DECP
            </a>

            {/* Desktop links */}
            <div className="hidden items-center gap-8 md:flex">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* GitHub button */}
            <a
              href="https://github.com/cepdnaclk/PeraCom-DECP"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-all hover:border-primary hover:shadow-[0_0_15px_rgba(26,86,219,0.3)] md:flex"
            >
              View on GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-foreground md:hidden"
            >
              {mobileOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {/* Mobile drawer */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden"
              >
                <div className="flex flex-col gap-4 px-6 py-6">
                  {navLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  ))}
                  <a
                    href="https://github.com/cepdnaclk/PeraCom-DECP"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground"
                  >
                    View on GitHub <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
