import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[900px] overflow-hidden border-b border-white/10 pt-20">
      <div className="absolute inset-0">
        {/* Gebäude ca. 10 % grösser und etwas stärker in den Vordergrund gerückt */}
        <div className="absolute inset-y-0 right-[-4%] w-[108%] bg-[url('/grosspeter-hero.jpg')] bg-cover bg-[61%_top] opacity-85 lg:w-[73%]" />

        {/* Lesbarkeit links und ruhiger Übergang zum Gebäude */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#061019_0%,#061019_31%,rgba(6,16,25,.82)_49%,rgba(6,16,25,.19)_77%,rgba(6,16,25,.40)_100%)]" />

        {/* Dezenter atmosphärischer Nebel hinter dem Tower */}
        <div className="absolute right-[7%] top-[12%] h-[62%] w-[46%] rounded-full bg-[radial-gradient(circle,rgba(0,215,213,.12)_0%,rgba(0,169,157,.055)_34%,transparent_72%)] blur-2xl" />

        {/* Technisches Raster */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,215,213,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,215,213,.035)_1px,transparent_1px)] bg-[size:72px_72px]" />

        {/* Leichte Tiefenabdunklung unten */}
        <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[#061019] via-[#061019]/60 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[820px] max-w-[1480px] items-center px-6 py-20 lg:px-10">
        <div className="max-w-2xl">
          <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-[0.28em] text-[#00D7D5]">
            <span className="h-px w-12 bg-[#00D7D5]" />
            LuMa Labs · Engineering Platform
          </div>

          <h1 className="mt-7 max-w-4xl font-semibold tracking-[-0.055em] text-white">
            <span className="block text-6xl leading-[1.12] sm:text-7xl lg:text-[88px]">
              Engineering tomorrow.
            </span>

            <span className="mt-6 block text-3xl font-medium leading-[1.25] text-white sm:text-4xl lg:text-[50px]">
              Connecting
              <span className="block text-[#00A99D]">Engineering,</span>
              <span className="block text-[#00A99D]">Software &</span>
              <span className="block text-[#00A99D]">
                Smart Infrastructure.
              </span>
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
              className="group inline-flex items-center justify-center gap-3 rounded-md bg-[#00A99D] px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_12px_32px_rgba(0,169,157,0.16)] transition hover:-translate-y-0.5 hover:bg-[#00BDB0] hover:shadow-[0_16px_38px_rgba(0,215,213,0.20)]"
            >
              Unsere Lösungen
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>

            <a
              href="#projekte"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-[#07131d]/60 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:-translate-y-0.5 hover:border-[#00A99D]/60 hover:bg-white/5"
            >
              Projekte ansehen
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
