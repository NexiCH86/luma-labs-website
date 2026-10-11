import Link from "next/link";
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

/*
 * Bis es eigene Produktseiten gibt, fuehrt jede Karte zum
 * passenden Abschnitt der Roadmap.
 */
const solutions = [
  ["LuMa Air", "Lüftungssoftware für Planung, Berechnung und Auslegung.", Wind, "#roadmap-engineering"],
  ["LuMa BIM", "BIM-Tools und Revit-Automatisierung für koordinierte Planung.", Building2, "#roadmap-engineering"],
  ["LuMa Server", "Docker, Linux, Raspberry Pi und zuverlässige Infrastruktur.", Server, "#roadmap-knowledge"],
  ["LuMa Smart", "Smart Home, IoT und intelligente Gebäudeautomation.", House, "#roadmap-knowledge"],
  ["LuMa AI", "KI-Assistenten, Dokumentenanalyse und Automatisierung.", Bot, "#roadmap-os"],
  ["LuMa Docs", "Technische Dokumentationen und zentrale Wissensbasis.", BookOpen, "#roadmap-knowledge"],
  ["LuMa Academy", "Python, Git, Docker und praxisorientiertes Lernen.", GraduationCap, "#roadmap-knowledge"],
  ["LuMa Sync", "CI/CD, Releases, Backups und Daten-Synchronisation.", CloudCog, "#roadmap-knowledge"],
] as const;

export function Solutions() {
  return (
    <section id="loesungen" className="scroll-mt-24 py-28">
      <div className="mx-auto max-w-[1480px] px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7E6]">
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
          {solutions.map(([name, description, Icon, href]) => (
            <Link
              key={name}
              href={href}
              className="group min-h-64 rounded-xl border border-white/10 bg-[#0A1924] p-7 shadow-[0_10px_35px_rgba(0,0,0,0.14)] transition duration-300 hover:-translate-y-2 hover:border-[#00AFC2]/60 hover:bg-[#0D202B] hover:shadow-[0_20px_50px_rgba(0,175,194,0.12)]"
            >
              <div className="inline-flex rounded-lg border border-[#00AFC2]/15 bg-[#00AFC2]/5 p-3 transition duration-300 group-hover:border-[#00AFC2]/35 group-hover:bg-[#00AFC2]/10">
                <Icon className="h-8 w-8 text-[#00AFC2]" />
              </div>

              <h3 className="mt-7 text-2xl font-medium text-white">
                {name.split(" ")[0]}{" "}
                <span className="text-[#00AFC2]">{name.split(" ").slice(1).join(" ")}</span>
              </h3>

              <p className="mt-4 leading-7 text-slate-400">{description}</p>

              <div className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-[#00D7E6] transition group-hover:translate-x-1">
                Zur Roadmap →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
