import { ArrowRight, ExternalLink, MapPin } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[900px] overflow-hidden border-b border-white/10 pt-20">
      <div className="absolute inset-0">
        <div className="absolute inset-y-0 right-0 w-full bg-[url('/grosspeter-hero.jpg')] bg-cover bg-[center_top] opacity-80 lg:w-[67%]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#061019_0%,#061019_32%,rgba(6,16,25,.80)_52%,rgba(6,16,25,.22)_78%,rgba(6,16,25,.46)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,215,213,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,215,213,.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
      </div>

      <a
        href="https://www.abicht-gruppe.ch/"
        target="_blank"
        rel="noreferrer"
        title="Abicht Gruppe öffnen"
        className="absolute right-6 top-28 z-20 hidden items-center gap-3 rounded-md border border-[#00A99D]/50 bg-[#07131d]/75 px-4 py-3 text-sm text-slate-200 backdrop-blur-md transition hover:border-[#00D7D5] hover:text-white lg:flex"
      >
        <MapPin className="h-5 w-5 text-[#00D7D5]" />
        <span>47.4010° N, 8.4455° E</span>
        <ExternalLink className="h-4 w-4 text-[#00D7D5]" />
      </a>

      <div className="relative z-10 mx-auto flex min-h-[820px] max-w-[1480px] items-center px-6 py-20 lg:px-10">
        <div className="max-w-2xl">
          <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-[0.28em] text-[#00D7D5]">
            <span className="h-px w-12 bg-[#00D7D5]" />
            Engineering tomorrow
          </div>

          <h1 className="mt-7 text-6xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-7xl lg:text-[92px]">
            Building tools
            <span className="block">
              <span className="text-[#00A99D]">that</span> last.
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">
            LuMa Labs entwickelt Software, BIM-Lösungen und intelligente
            Infrastruktur-Tools, die Engineering effizienter, nachhaltiger und
            zukunftssicher machen.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="#loesungen"
              className="group inline-flex items-center justify-center gap-3 rounded-md bg-[#00A99D] px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#00BDB0]"
            >
              Unsere Lösungen
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>
            <a
              href="#projekte"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-[#07131d]/60 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:border-[#00A99D]/60 hover:bg-white/5"
            >
              Projekte ansehen
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
