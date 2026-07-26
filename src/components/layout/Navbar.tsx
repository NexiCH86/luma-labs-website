import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const links = [
  ["Lösungen", "#loesungen"],
  ["Projekte", "#projekte"],
  ["Technologien", "#technologien"],
  ["Roadmap", "#roadmap"],
];

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#061019]/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-6 lg:px-10">
        <a href="#" aria-label="LuMa Labs Startseite">
          <Logo />
        </a>

        <div className="hidden items-center gap-8 text-sm uppercase tracking-[0.12em] text-slate-300 lg:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="transition hover:text-[#00D7D5]">
              {label}
            </a>
          ))}

          <a
            href="https://github.com/NexiCH86"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[#00A99D]/40 px-4 py-2.5 text-[#00D7D5] transition hover:bg-[#00A99D]/10"
          >
            GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </nav>
    </header>
  );
}
