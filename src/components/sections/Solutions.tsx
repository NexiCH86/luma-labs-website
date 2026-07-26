import {
  Bot,
  BookOpen,
  Building2,
  CloudCog,
  GraduationCap,
  House,
  Server,
  Wind,
} from "lucide-react";

const solutions = [
  ["LuMa Air", "Lüftungssoftware für Planung, Berechnung und Auslegung.", Wind],
  ["LuMa BIM", "BIM-Tools und Revit-Automatisierung für koordinierte Planung.", Building2],
  ["LuMa Server", "Docker, Linux, Raspberry Pi und zuverlässige Infrastruktur.", Server],
  ["LuMa Smart", "Smart Home, IoT und intelligente Gebäudeautomation.", House],
  ["LuMa AI", "KI-Assistenten, Dokumentenanalyse und Automatisierung.", Bot],
  ["LuMa Docs", "Technische Dokumentationen und zentrale Wissensbasis.", BookOpen],
  ["LuMa Academy", "Python, Git, Docker und praxisorientiertes Lernen.", GraduationCap],
  ["LuMa Sync", "CI/CD, Releases, Backups und Daten-Synchronisation.", CloudCog],
];

export function Solutions() {
  return (
    <section id="loesungen" className="scroll-mt-24 py-28">
      <div className="mx-auto max-w-[1480px] px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
              Lösungen
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Eine Plattform. Acht spezialisierte Produktlinien.
            </h2>
          </div>
          <p className="max-w-lg leading-7 text-slate-400">
            Jede Lösung deckt einen klaren Bereich ab. Gemeinsam verbinden sie
            Engineering, Software, BIM und Smart Infrastructure.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {solutions.map(([name, description, Icon]) => (
            <article
              key={name as string}
              className="group min-h-64 rounded-xl border border-white/10 bg-[#0A1924] p-7 transition duration-300 hover:-translate-y-1 hover:border-[#00A99D]/50 hover:bg-[#0D202B]"
            >
              <Icon className="h-8 w-8 text-[#00A99D]" />
              <h3 className="mt-8 text-2xl font-medium text-white">
                {(name as string).split(" ")[0]}{" "}
                <span className="text-[#00A99D]">
                  {(name as string).split(" ").slice(1).join(" ")}
                </span>
              </h3>
              <p className="mt-4 leading-7 text-slate-400">{description as string}</p>
              <div className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-[#00D7D5]">
                Mehr erfahren →
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
