import { ExternalLink, LockKeyhole, Radar } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const links = [
  ["Lösungen", "#loesungen"],
  ["Projekte", "#projekte"],
  ["Technologien", "#technologien"],
  ["Roadmap", "#roadmap"],
];

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#061019]/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-6 lg:px-10">
        <a href="#" aria-label="LuMa Labs Startseite">
          <Logo />
        </a>

        <div className="hidden items-center gap-7 text-sm uppercase tracking-[0.12em] text-slate-300 lg:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="transition hover:text-[#00D7D5]">
              {label}
            </a>
          ))}

          <a href="/radar" className="inline-flex items-center gap-2 transition hover:text-[#00D7D5]">
            <Radar className="h-4 w-4" />
            RADAR
          </a>

          <a href="/control-center" className="inline-flex items-center gap-2 transition hover:text-[#00D7D5]">
            <LockKeyhole className="h-4 w-4" />
            Control Center
          </a>

          <a href="/portal" className="transition hover:text-[#00D7D5]">
            Intern
          </a>

          <a
            href="https://github.com/NexiCH86"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[#00A99D]/55 bg-gradient-to-r from-[#007D75] to-[#00A99D] px-4 py-2.5 font-semibold text-white shadow-[0_10px_30px_rgba(0,169,157,0.14)] transition hover:-translate-y-0.5 hover:from-[#008E84] hover:to-[#00B7AA] hover:shadow-[0_14px_34px_rgba(0,215,213,0.18)]"
          >
            GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </nav>
    </header>
  );
}
