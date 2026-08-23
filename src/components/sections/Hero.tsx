import { ArrowRight, LockKeyhole, Radar } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-[820px] overflow-hidden border-b border-white/10 pt-20">
      <div className="absolute inset-0 bg-[#061019]">
        <div className="absolute inset-y-0 right-0 w-full bg-[url('/luma-hero-castle.jpg')] bg-cover bg-[48%_center] lg:w-[72%] lg:bg-[46%_center]" />

        {/* Kühle LuMa-Tönung wie beim Wallpaper, ohne das Originalbild selbst zu verändern */}
        <div className="absolute inset-y-0 right-0 w-full bg-[linear-gradient(180deg,rgba(0,44,58,.16)_0%,rgba(0,26,38,.10)_38%,rgba(0,14,24,.30)_100%)] mix-blend-multiply lg:w-[72%]" />
        <div className="absolute right-[6%] top-[7%] h-[52%] w-[44%] rounded-full bg-[radial-gradient(circle,rgba(0,215,213,.10)_0%,rgba(0,169,157,.045)_36%,transparent_72%)] blur-3xl" />

        {/* Dunkler Übergang für Lesbarkeit, mit leicht kühlem Petrolton */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#061019_0%,#061019_27%,rgba(5,20,29,.95)_39%,rgba(5,23,33,.70)_53%,rgba(2,28,39,.18)_76%,rgba(0,18,28,.04)_100%)]" />

        {/* Feine Cyan-Lichtkante als Verbindung zur LuMa-Farbwelt */}
        <div className="absolute inset-x-0 top-20 h-px bg-gradient-to-r from-transparent via-[#00D7D5]/35 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#061019] via-[#061019]/45 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[740px] max-w-[1480px] items-center px-6 py-16 lg:px-10">
        <div className="max-w-[700px]">
          <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-[0.28em] text-[#55ECE9]">
            <span className="h-px w-12 bg-gradient-to-r from-[#00A99D] to-[#00D7D5]" />
            LuMa Labs · Engineering Platform
          </div>

          <h1 className="mt-7 max-w-4xl font-semibold tracking-[-0.055em] text-white">
            <span className="block text-6xl leading-[1.08] sm:text-7xl lg:text-[82px]">
              Engineering tomorrow.
            </span>

            <span className="mt-6 block text-3xl font-medium leading-[1.22] text-white sm:text-4xl lg:text-[46px]">
              Connecting
              <span className="block bg-gradient-to-r from-[#00B9AD] to-[#55ECE9] bg-clip-text text-transparent">
                Engineering,
              </span>
              <span className="block bg-gradient-to-r from-[#00A99D] to-[#32DDD7] bg-clip-text text-transparent">
                Software &
              </span>
              <span className="block bg-gradient-to-r from-[#00A99D] to-[#32DDD7] bg-clip-text text-transparent">
                Smart Infrastructure.
              </span>
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
              className="group inline-flex items-center justify-center gap-3 rounded-lg border border-[#00D7D5]/50 bg-gradient-to-r from-[#007D75]/45 to-[#00A99D]/25 px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#91FAF7] shadow-[0_10px_30px_rgba(0,215,213,0.10)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#55ECE9]/80 hover:from-[#008F86]/55 hover:to-[#00BDB0]/35 hover:text-white hover:shadow-[0_14px_34px_rgba(0,215,213,0.16)]"
            >
              <Radar className="h-4 w-4" />
              LuMa RADAR
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>

            <a
              href="/control-center"
              className="group inline-flex items-center justify-center gap-3 rounded-lg border border-[#00A99D]/35 bg-[#06131d]/72 px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[inset_0_0_20px_rgba(0,169,157,0.035)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#00D7D5]/65 hover:bg-[#08202a]/82"
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
