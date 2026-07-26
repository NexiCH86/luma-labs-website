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

const products = [
  ["LuMa Air", "Lüftungsplanung und Engineering Tools", Wind, "In Entwicklung"],
  ["LuMa BIM", "Revit, Dynamo und BIM-Workflows", Building2, "In Planung"],
  ["LuMa Smart", "Smart Home und vernetzte Infrastruktur", House, "Im Aufbau"],
  ["LuMa AI", "KI-Werkzeuge und intelligente Automatisierung", Bot, "Konzept"],
  ["LuMa Server", "Docker, Linux, Raspberry Pi und Homelab", Server, "Aktiv"],
  ["LuMa Sync", "GitHub, CI/CD, Backups und Deployments", CloudCog, "Geplant"],
  ["LuMa Academy", "Lernen, Python, Git und Weiterbildung", GraduationCap, "Aktiv"],
  ["LuMa Docs", "Handbücher, Wissensbasis und Dokumentation", BookOpen, "Aktiv"],
] as const;

export function Products() {
  return (
    <section
      id="produkte"
      className="relative scroll-mt-20 border-y border-white/10 bg-white/[0.015] py-24"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
          Produkte
        </p>
        <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Acht Produktlinien. Eine gemeinsame Identität.
        </h2>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {products.map(([name, description, Icon, status]) => (
            <article
              key={name}
              className="group rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.055]"
            >
              <div className="flex items-start justify-between gap-4">
                <Icon className="h-6 w-6 text-cyan-300" />
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400">
                  {status}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold">{name}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
