"use client";

import Link from "next/link";
import { useState } from "react";
import { Boxes, ExternalLink, LockKeyhole, Menu, Radar, X } from "lucide-react";

const sectionLinks = [
  ["Lösungen", "/#loesungen"],
  ["Projekte", "/#projekte"],
  ["Technologien", "/#technologien"],
  ["Roadmap", "/#roadmap"],
] as const;

const productLinks = [
  ["RADAR", "/radar", Radar],
  ["Control Center", "/control-center", LockKeyhole],
  ["Fusion", "https://bog-fusion.vercel.app", Boxes],
] as const;

/*
 * Navigation fuer Handy, Tablet und kleine Laptops (unter xl). Breiter zeigt die
 * Navbar die Links direkt.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Menü schliessen" : "Menü öffnen"}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-white/15 text-slate-200 transition hover:border-[#00D7E6]/60 hover:text-white"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-20 border-b border-white/10 bg-[#061019]/97 px-6 pb-8 pt-4 backdrop-blur-xl"
        >
          <div className="grid gap-1 text-sm uppercase tracking-[0.12em] text-slate-300">
            {sectionLinks.map(([label, href]) => (
              <Link key={href} href={href} onClick={close} className="rounded-md px-3 py-3 transition hover:bg-white/[0.04] hover:text-[#00D7E6]">
                {label}
              </Link>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {productLinks.map(([label, href, Icon]) => (
              <Link
                key={href}
                href={href}
                onClick={close}
                className="inline-flex items-center gap-3 rounded-md border border-[#00D7E6]/35 bg-[#00D7E6]/[0.05] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#55ECE9]"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4 text-sm uppercase tracking-[0.12em]">
            <Link href="/portal" onClick={close} className="text-slate-300 hover:text-[#00D7E6]">
              Intern
            </Link>
            <a href="https://github.com/NexiCH86" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-white">
              GitHub <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
