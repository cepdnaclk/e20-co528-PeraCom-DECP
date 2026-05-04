export default function Footer() {
  return (
    <footer className="relative border-t border-border py-12">
      {/* Gradient shimmer line */}
      <div className="absolute left-0 right-0 top-0 gradient-divider" />

      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 text-center sm:flex-row sm:justify-between sm:text-left lg:px-8">
        <div>
          <div className="flex items-center gap-2 font-display text-lg font-bold text-foreground sm:justify-start justify-center">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            DECP
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Department Engagement & Career Platform
          </p>
        </div>

        <div className="flex gap-6">
          {["#overview", "#features", "#architecture"].map((href) => (
            <a
              key={href}
              href={href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {href.replace("#", "").charAt(0).toUpperCase() +
                href.replace("#", "").slice(1)}
            </a>
          ))}
          <a
            href="https://github.com/cepdnaclk/PeraCom-DECP"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </div>

        <p className="font-mono text-xs text-muted-foreground">
          University of Peradeniya · CO528 · 2026
        </p>
      </div>
    </footer>
  );
}
