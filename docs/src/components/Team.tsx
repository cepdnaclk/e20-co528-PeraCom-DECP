import { motion } from "framer-motion";
import { useInView } from "@/hooks/useAnimations";
import { useEffect, useState } from "react";
import { Mail, Github, Linkedin, Briefcase, Globe } from "lucide-react";
import * as Avatar from "@radix-ui/react-avatar";
import CHETHIYA from "../asserts/e20032.jpg";
import BIMSARA from "../asserts/e20157.jpg";
import KAVINDU from "../asserts/e20254.jpg";

const quote = "We didn't just build a platform. We built it the right way.";

const TEAM_MEMBERS = [
  {
    reg_no: "E/20/032",
    name: "Chethiya Bandara",
    email: "e20032@eng.pdn.ac.lk",
    github: "https://github.com/ChethiyaB",
    linkedin: "https://www.linkedin.com/in/chethiyab/",
    portfolio: "https://www.linkedin.com/in/chethiyab/",
    website: "#",
    avatar: CHETHIYA,
    gradient: "from-blue-500 to-cyan-400",
  },
  {
    reg_no: "E/20/157",
    name: "Bimsara Janakantha",
    email: "e20157@eng.pdn.ac.lk",
    github: "https://github.com/Bimsara-Janakantha",
    linkedin: "https://www.linkedin.com/in/bimsara-janakantha/",
    portfolio: "https://www.thecn.com/BJ448",
    website: "#",
    avatar: BIMSARA,
    gradient: "from-purple-500 to-pink-400",
  },
  {
    reg_no: "E/20/254",
    name: "Kavindu Methpura",
    email: "e20254@eng.pdn.ac.lk",
    github: "https://github.com/KavinduMethpura",
    linkedin:
      "https://www.linkedin.com/in/kavindu-prabhath-methpura-b20a97242/",
    portfolio: "https://www.thecn.com/EM1302",
    website: "#",
    avatar: KAVINDU,
    gradient: "from-emerald-500 to-teal-400",
  },
];

const socialLinks = (member: (typeof TEAM_MEMBERS)[0]) => [
  { href: `mailto:${member.email}`, icon: Mail, label: "Email" },
  { href: member.github, icon: Github, label: "GitHub" },
  { href: member.linkedin, icon: Linkedin, label: "LinkedIn" },
  { href: member.portfolio, icon: Briefcase, label: "Portfolio" },
  { href: member.website, icon: Globe, label: "Website" },
];

function Typewriter({ text, start }: { text: string; start: boolean }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!start) return;
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [start, text]);
  return (
    <span>
      {displayed}
      <span className="animate-pulse text-primary">|</span>
    </span>
  );
}

export default function Team() {
  const { ref, isInView } = useInView();

  return (
    <section id="team" className="relative py-32 grid-pattern">
      <div className="gradient-divider" />
      <div
        ref={ref}
        className="mx-auto max-w-5xl px-4 pt-16 text-center sm:px-6 lg:px-8"
      >
        {/* Team Introduction */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built By
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A team of computer engineering undergraduates at the University of
            Peradeniya, Sri Lanka.
          </p>
        </motion.div>

        {/* Team Member Cards */}
        <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM_MEMBERS.map((member, i) => (
            <motion.div
              key={member.reg_no}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-2 hover:border-primary/40 hover:shadow-[0_0_30px_rgba(26,86,219,0.12)]"
            >
              {/* Glow top border */}
              <div
                className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${member.gradient} opacity-60 transition-opacity group-hover:opacity-100`}
              />

              {/* Avatar placeholder */}
              <div className="mx-auto mt-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-secondary transition-all duration-300 group-hover:border-primary/50">
                <Avatar.Root className="h-full w-full">
                  <Avatar.Image
                    className="h-full w-full object-cover"
                    src={member.avatar}
                    alt={member.name}
                  />
                  <Avatar.Fallback
                    className="flex h-full w-full items-center justify-center bg-secondary text-sm font-medium"
                    delayMs={600}
                  >
                    {member.name?.charAt(0) || "U"}
                  </Avatar.Fallback>
                </Avatar.Root>
              </div>

              {/* Name & Reg */}
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">
                {member.name}
              </h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {member.reg_no}
              </p>

              {/* Social Icons */}
              <div className="mt-5 flex items-center justify-center gap-2">
                {socialLinks(member).map(({ href, icon: Icon, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/50 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-[0_0_12px_rgba(26,86,219,0.2)]"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* University Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-8"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 font-display text-2xl font-bold text-primary">
            UoP
          </div>
          <h3 className="mt-6 font-display text-lg font-bold text-foreground">
            Department of Computer Engineering
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            University of Peradeniya
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 font-mono text-xs text-muted-foreground">
              CO528 — Applied Software Architecture
            </span>
            <span className="rounded-full bg-secondary px-3 py-1 font-mono text-xs text-muted-foreground">
              2025 / 2026
            </span>
          </div>
        </motion.div>

        {/* Typewriter quote */}
        <motion.blockquote
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 1.0 }}
          className="mt-12 border-primary text-left font-display text-xl italic text-foreground/80 text-center flex items-center justify-center"
        >
          <Typewriter text={quote} start={isInView} />
        </motion.blockquote>
      </div>
    </section>
  );
}
