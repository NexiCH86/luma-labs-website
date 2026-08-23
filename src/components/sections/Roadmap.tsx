const items = [
  {
    title: "LuMa Labs Platform",
    status: "LIVE",
    phase: "Foundation",
    description:
      "Website, lumalabs.ch, Vercel-Deployment, Corporate Design sowie die getrennten Zugänge für RADAR, Control Center und Intern sind produktiv.",
    accent: "emerald",
  },
  {
    title: "LuMa Control Center",
    status: "V1 LIVE",
    phase: "Operations",
    description:
      "LuisServer, Master-Intel, Master-Mac und Kali-Mac liefern Live-Telemetrie. Eigener Login, eigener Redis und automatischer Start auf allen vier Systemen sind eingerichtet.",
    accent: "emerald",
  },
  {
    title: "LuMa RADAR · AIR",
    status: "IN ENTWICKLUNG",
    phase: "High Priority · Linear",
    description:
      "Globale Flugzeug- und Flughafenplattform mit Aircraft Type & Registration, Airport-Details und Filtern. Als nächste Linear-Themen folgen Route/ETA, Flight Phase, Aircraft-Kategorien, Squawk-Status sowie Typenbilder und weiterführende Informationen.",
    accent: "cyan",
  },
  {
    title: "LuMa RADAR · SAT",
    status: "IN ENTWICKLUNG",
    phase: "Satellite Tracking · Linear",
    description:
      "Globaler Satellitenmodus mit Orbit-/Ground-Track-Darstellung. Die Linear-Roadmap umfasst Datenquelle und Orbit-Engine, globale Satellitenkarte sowie Objektinformationen und Filter.",
    accent: "cyan",
  },
  {
    title: "LuMa RADAR · SKY",
    status: "NÄCHSTER AUSBAU",
    phase: "Astronomy · Linear",
    description:
      "Interaktive Sternenkarte für Standort und Zeitpunkt. Geplant sind Astronomie-Engine und Kataloge, Sterne und Sternbilder, Planeten sowie Messier-/NGC- und weitere Deep-Sky-Objekte mit Detailpanel.",
    accent: "amber",
  },
  {
    title: "LuMa Air & Engineering Tools",
    status: "GEPLANT",
    phase: "Engineering Software",
    description:
      "Weiterentwicklung der eigenen Engineering-Werkzeuge: Lüftungsrechner, Automatisierung, Revit/BIM-Tools, Kollisionsprüfung und weitere spezialisierte Desktop- und Web-Anwendungen.",
    accent: "slate",
  },
  {
    title: "Academy, Docs & Smart Infrastructure",
    status: "GEPLANT",
    phase: "Knowledge & Infrastructure",
    description:
      "Ausbau von LuMa Academy und LuMa Docs sowie stärkere Verzahnung mit Homelab, Build-/CI-Infrastruktur, Remote-Zugriff und vernetzten LuMa-Services.",
    accent: "slate",
  },
];

const accentStyles = {
  emerald: {
    badge: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200",
    number: "border-emerald-300/30 text-emerald-200",
    dot: "bg-emerald-300",
  },
  cyan: {
    badge: "border-[#00D7D5]/25 bg-[#00D7D5]/[0.055] text-[#55ECE9]",
    number: "border-[#00D7D5]/40 text-[#00D7D5]",
    dot: "bg-[#00D7D5]",
  },
  amber: {
    badge: "border-amber-300/20 bg-amber-300/[0.05] text-amber-200",
    number: "border-amber-300/30 text-amber-200",
    dot: "bg-amber-300",
  },
  slate: {
    badge: "border-white/10 bg-white/[0.025] text-slate-400",
    number: "border-white/15 text-slate-400",
    dot: "bg-slate-500",
  },
} as const;

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="scroll-mt-24 border-t border-white/10 bg-[#08151f] py-28"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
            Roadmap · Stand August 2026
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Schritt für Schritt zum Engineering-Ökosystem.
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-400">
            Der aktuelle Stand kombiniert die bereits produktiven LuMa-Labs-Systeme
            mit der operativen LuMa-RADAR-Roadmap aus Linear.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {items.map((item, index) => {
            const styles = accentStyles[item.accent];

            return (
              <article
                key={item.title}
                className="group grid gap-5 rounded-2xl border border-white/10 bg-[#0A1924] p-6 transition hover:border-[#00D7D5]/20 hover:bg-[#0B1C28] md:grid-cols-[auto_1fr_auto] md:items-center"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-sm font-medium ${styles.number}`}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-medium text-white">{item.title}</h3>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                      {item.phase}
                    </span>
                  </div>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                    {item.description}
                  </p>
                </div>

                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                  {item.status}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
