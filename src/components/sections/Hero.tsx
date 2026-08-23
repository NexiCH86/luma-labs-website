import {
  ArrowRight,
  BarChart3,
  Code2,
  LockKeyhole,
  MapPin,
  Network,
  Radar,
  ShieldCheck,
} from "lucide-react";

const capabilities = [
  {
    icon: Code2,
    title: "Software",
    text: "Intelligente Tools für Ingenieure",
  },
  {
    icon: BarChart3,
    title: "Daten",
    text: "Echtzeit-Analytics & Insights",
  },
  {
    icon: Network,
    title: "Infrastruktur",
    text: "Smart, sicher & skalierbar",
  },
  {
    icon: ShieldCheck,
    title: "Sicherheit",
    text: "Security by Design",
  },
];

export function Hero() {
  return (
    <section className="relative min-h-[930px] overflow-hidden border-b border-white/10 pt-20 lg:min-h-[980px]">
      <div className="absolute inset-0 bg-[#03101a]">
        <div className="absolute inset-0 bg-[url('/luma-hero-castle.jpg')] bg-cover bg-[54%_center] lg:bg-[56%_center]" />

        {/* Cinematic LuMa grading – the uploaded source image itself stays untouched. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,19,31,.34)_0%,rgba(0,31,43,.30)_42%,rgba(0,12,22,.72)_100%)] mix-blend-multiply" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,15,25,.96)_0%,rgba(2,17,28,.91)_28%,rgba(2,20,31,.60)_48%,rgba(0,26,38,.19)_72%,rgba(0,15,24,.20)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(0,215,213,.13),transparent_34%)]" />
        <div className="absolute inset-x-0 top-20 h-px bg-gradient-to-r from-[#00D7D5]/20 via-[#00D7D5]/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#03101a] via-[#03101a]/72 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[850px] max-w-[1480px] flex-col justify-center px-6 pb-12 pt-20 lg:min-h-[900px] lg:px-10 lg:pb-14">
        <div className="max-w-[650px]">
          <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#49E9E6]">
            <span className="h-px w-12 bg-[#00D7D5]" />
            LuMa Labs
          </div>

          <h1 className="mt-5 font-semibold tracking-[-0.055em] text-white">
            <span className="block font-serif text-6xl leading-[0.95] sm:text-7xl lg:text-[86px]">
              Engineering
            </span>
            <span className="mt-1 block font-serif text-6xl leading-[0.95] text-[#00C9D8] sm:text-7xl lg:text-[86px]">
              tomorrow.
            </span>
          </h1>

          <p className="mt-7 max-w-[560px] font-serif text-2xl leading-snug text-slate-200 sm:text-3xl">
            Connecting Engineering, Software &{" "}
            <span className="text-[#49E9E6]">Smart Infrastructure.</span>
          </p>

          <div className="mt-7 max-w-[590px] border-l border-[#00D7D5]/60 pl-5">
            <p className="text-sm leading-6 text-slate-300/90 sm:text-base">
              Wir entwickeln intelligente Lösungen für die digitale Transformation
              im Engineering und in der Infrastruktur. Mit Software, Daten und
              Automatisierung gestalten wir die Zukunft – heute.
            </p>
          </div>

          <div className="mt-9 grid max-w-[650px] gap-4 sm:grid-cols-2">
            <a
              href="/radar"
              className="group rounded-xl border border-[#00D7D5]/65 bg-[#021824]/72 p-5 shadow-[0_0_32px_rgba(0,215,213,.08)] backdrop-blur-md transition hover:-translate-y-1 hover:border-[#56F4F0] hover:bg-[#042330]/82 hover:shadow-[0_12px_38px_rgba(0,215,213,.16)]"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#00D7D5]/60 text-[#55ECE9]">
                  <Radar className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-xl text-white">LuMa RADAR</h2>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#55ECE9]/70">
                    Live Tracking Platform
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#55ECE9] transition group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/control-center"
              className="group rounded-xl border border-[#00D7D5]/55 bg-[#021824]/72 p-5 shadow-[0_0_32px_rgba(0,215,213,.06)] backdrop-blur-md transition hover:-translate-y-1 hover:border-[#56F4F0] hover:bg-[#042330]/82 hover:shadow-[0_12px_38px_rgba(0,215,213,.14)]"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#00D7D5]/55 text-[#55ECE9]">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-xl text-white">Control Center</h2>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#55ECE9]/70">
                    Systeme & Services
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#55ECE9] transition group-hover:translate-x-1" />
              </div>
            </a>
          </div>
        </div>

        <div className="mt-12 grid max-w-[900px] gap-3 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex items-start gap-3 border-l border-[#00D7D5]/20 bg-[#02151f]/35 px-4 py-3 backdrop-blur-sm first:border-l-0"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#00D7D5]/35 bg-[#00D7D5]/[0.045] text-[#55ECE9]">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#55ECE9]">
                  {title}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.16em] text-slate-400/80">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-[#00D7D5]" />
            Schweiz
          </span>
          <span className="h-1 w-1 rounded-full bg-[#00D7D5]/70" />
          <a href="#loesungen" className="transition hover:text-[#55ECE9]">
            Lösungen
          </a>
          <span className="h-1 w-1 rounded-full bg-[#00D7D5]/50" />
          <a href="#projekte" className="transition hover:text-[#55ECE9]">
            Projekte
          </a>
          <span className="h-1 w-1 rounded-full bg-[#00D7D5]/50" />
          <a href="#roadmap" className="transition hover:text-[#55ECE9]">
            Roadmap
          </a>
        </div>
      </div>
    </section>
  );
}
