import { ArrowRight, LockKeyhole, Radar } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[820px] overflow-hidden border-b border-white/10 pt-20">
      <div className="absolute inset-0 bg-[#061019]">
        <div className="absolute inset-y-0 right-0 w-full bg-[url('/luma-hero-castle.jpg')] bg-cover bg-[48%_center] lg:w-[72%] lg:bg-[46%_center]" />

        <div className="absolute inset-0 bg-[linear-gradient(90deg,#061019_0%,#061019_29%,rgba(6,16,25,.94)_40%,rgba(6,16,25,.66)_54%,rgba(6,16,25,.15)_75%,rgba(6,16,25,.02)_100%)]" />

        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#061019] via-[#061019]/35 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[740px] max-w-[1480px] items-center px-6 py-16 lg:px-10">
        <div className="max-w-[700px]">
          <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-[0.28em] text-[#00D7D5]">
            <span className="h-px w-12 bg-[#00D7D5]" />
            LuMa Labs · Engineering Platform
          </div>

          <h1 className="mt-7 max-w-4xl font-semibold tracking-[-0.055em] text-white">
            <span className="block text-6xl leading-[1.08] sm:text-7xl lg:text-[82px]">
              Engineering tomorrow.
            </span>

            <span className="mt-6 block text-3xl font-medium leading-[1.22] text-white sm:text-4xl lg:text-[46px]">
              Connecting
              <span className="block text-[#00A99D]">Engineering,</span>
              <span className="block text-[#00A99D]">Software &</span>
              <span className="block text-[#00A99D]">Smart Infrastructure.</span>
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">
            LuMa Labs entwickelt Software, BIM-Lösungen und intelligente
            Infrastruktur-Tools, die Engineering effizienter, nachhaltiger und
            zukunftssicher machen.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="/radar"
              className="group inline-flex items-center justify-center gap-3 rounded-lg border border-[#00D7D5]/40 bg-[#00D7D5]/[0.09] px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#7AF4F1] shadow-[0_10px_28px_rgba(0,215,213,0.08)] transition hover:-translate-y-0.5 hover:border-[#00D7D5]/75 hover:bg-[#00D7D5]/[0.14] hover:text-white"
            >
              <Radar className="h-4 w-4" />
              LuMa RADAR
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>

            <a
              href="/control-center"
              className="group inline-flex items-center justify-center gap-3 rounded-lg border border-white/20 bg-[#07131d]/72 px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#00A99D]/65 hover:bg-[#0A1A24]/85"
            >
              <LockKeyhole className="h-4 w-4 text-[#55ECE9]" />
              Control Center
            </a>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            <a href="#loesungen" className="transition hover:text-[#55ECE9]">
              Lösungen ansehen
            </a>
            <a href="#projekte" className="transition hover:text-[#55ECE9]">
              Projekte entdecken
            </a>
            <a href="#roadmap" className="transition hover:text-[#55ECE9]">
              Roadmap
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
