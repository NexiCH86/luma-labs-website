import Link from "next/link";
import { ExternalLink, LockKeyhole, Radar, Boxes } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MobileMenu } from "./MobileMenu";

const sectionLinks = [
  ["Lösungen", "/#loesungen"],
  ["Projekte", "/#projekte"],
  ["Technologien", "/#technologien"],
  ["Roadmap", "/#roadmap"],
] as const;

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#061019]/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-6 lg:px-10">
        <Link href="/" aria-label="LuMa Labs Startseite">
          <Logo gradientId="lumaSignetNav" />
        </Link>

        <div className="hidden items-center gap-5 whitespace-nowrap text-sm uppercase tracking-[0.12em] text-slate-300 xl:flex">
          {sectionLinks.map(([label, href]) => (
            <Link key={href} href={href} className="transition hover:text-[#00D7E6]">
              {label}
            </Link>
          ))}

          <a
            href="https://bog-fusion.vercel.app"
            className="inline-flex items-center gap-2 rounded-md border border-[#00D7E6]/30 bg-[#00D7E6]/[0.035] px-4 py-2.5 font-semibold text-cyan-100/80 transition hover:-translate-y-0.5 hover:border-[#00D7E6]/60 hover:bg-[#00D7E6]/[0.09] hover:text-white"
          >
            <Boxes className="h-4 w-4" />
            FUSION
          </a>

          <Link
            href="/radar"
            className="inline-flex items-center gap-2 rounded-md border border-[#00D7E6]/30 bg-[#00D7E6]/[0.035] px-4 py-2.5 font-semibold text-cyan-100/80 transition hover:-translate-y-0.5 hover:border-[#00D7E6]/60 hover:bg-[#00D7E6]/[0.09] hover:text-white"
          >
            <Radar className="h-4 w-4" />
            RADAR
          </Link>

          <Link
            href="/control-center"
            className="inline-flex items-center gap-2 rounded-md border border-[#00D7E6]/45 bg-[#00D7E6]/[0.06] px-4 py-2.5 font-semibold text-[#55ECE9] shadow-[0_0_24px_rgba(0,215,230,0.06)] transition hover:-translate-y-0.5 hover:border-[#00D7E6]/75 hover:bg-[#00D7E6]/[0.12] hover:text-white hover:shadow-[0_10px_30px_rgba(0,215,230,0.12)]"
          >
            <LockKeyhole className="h-4 w-4" />
            Control Center
          </Link>

          <Link href="/portal" className="transition hover:text-[#00D7E6]">
            Intern
          </Link>

          <a
            href="https://github.com/NexiCH86"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[#00AFC2]/55 bg-gradient-to-r from-[#008A99] to-[#00AFC2] px-4 py-2.5 font-semibold text-white shadow-[0_10px_30px_rgba(0,175,194,0.14)] transition hover:-translate-y-0.5 hover:from-[#0096A6] hover:to-[#00C2D6] hover:shadow-[0_14px_34px_rgba(0,215,230,0.18)]"
          >
            GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <MobileMenu />
      </nav>
    </header>
  );
}
