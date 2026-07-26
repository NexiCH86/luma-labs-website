import {
  ArrowRight,
  BookOpen,
  Boxes,
  Building2,
  Check,
  CloudCog,
  Code2,
  GitBranch,
  GraduationCap,
  Server,
  Sparkles,
  Wind,
  Wrench,
} from "lucide-react";

const products = [
  {
    name: "LuMa Air",
    description:
      "Professionelle Berechnungswerkzeuge für Lüftungsplanung, Dimensionierung und technische Dokumentation.",
    icon: Wind,
    status: "In Entwicklung",
    features: ["Luftmengen", "Kanaldimensionierung", "Monobloc-Auslegung"],
  },
  {
    name: "LuMa BIM",
    description:
      "Werkzeuge und Automatisierungen für Revit, Dynamo und moderne BIM-Workflows.",
    icon: Building2,
    status: "In Planung",
    features: ["Revit", "Dynamo", "Qualitätskontrolle"],
  },
  {
    name: "LuMa Academy",
    description:
      "Eine wachsende Lernplattform für Softwareentwicklung und digitale Infrastruktur.",
    icon: GraduationCap,
    status: "Aktiv",
    features: ["Python", "Git & GitHub", "Docker & Linux"],
  },
  {
    name: "LuMa Docs",
    description:
      "Zentrale Dokumentationen, Benutzerhandbücher, Roadmaps und technische Referenzen.",
    icon: BookOpen,
    status: "Im Aufbau",
    features: ["Handbücher", "Changelogs", "Wissensbasis"],
  },
  {
    name: "LuMa Server",
    description:
      "Die zuverlässige Infrastruktur hinter den Projekten und Entwicklungsprozessen.",
    icon: Server,
    status: "Aktiv",
    features: ["Raspberry Pi", "Docker", "Monitoring"],
  },
  {
    name: "LuMa Sync",
    description:
      "Automatisierte Builds, Veröffentlichungen und Synchronisation über alle Systeme.",
    icon: CloudCog,
    status: "Geplant",
    features: ["CI/CD", "Deployments", "Synchronisation"],
  },
];

const technologies = [
  "Next.js",
  "TypeScript",
  "Python",
  "GitHub",
  "Docker",
  "Raspberry Pi",
  "Revit",
  "Dynamo",
];

const roadmap = [
  {
    title: "LuMa Labs Plattform",
    description: "Markenstruktur, Website und technische Grundlage",
    status: "done",
  },
  {
    title: "LuMa Air Prototyp",
    description: "Erste präsentierbare Version des Lüftungsrechners",
    status: "active",
  },
  {
    title: "Dokumentationsportal",
    description: "Zentrale Plattform für Docs, Academy und Handbücher",
    status: "planned",
  },
  {
    title: "Automatische Releases",
    description: "Builds, Windows-Anwendung und Veröffentlichungen über CI/CD",
    status: "planned",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute bottom-[-280px] right-[-180px] h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#030712]/75 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>

            <div>
              <div className="font-semibold tracking-tight">LuMa Labs</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                Engineering Platform
              </div>
            </div>
          </a>

          <div className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#produkte" className="transition hover:text-white">
              Produkte
            </a>
            <a href="#vision" className="transition hover:text-white">
              Vision
            </a>
            <a href="#roadmap" className="transition hover:text-white">
              Roadmap
            </a>
            <a
              href="https://github.com/NexiCH86"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 transition hover:border-cyan-400/40 hover:bg-white/5"
            >
              <GitBranch className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </nav>
      </header>

      <section className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 pb-20 pt-32 lg:px-8">
        <div className="max-w-5xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-200">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
            Die Plattform für Engineering, Software und BIM
          </div>

          <h1 className="max-w-5xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-7xl lg:text-[92px]">
            Engineering tomorrow.
            <span className="block bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">
              Building tools that last.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">
            LuMa Labs entwickelt professionelle Software, BIM-Werkzeuge,
            Dokumentationen und Infrastruktur für das digitale Planen von
            morgen.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="#produkte"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3.5 font-medium text-slate-950 transition hover:bg-cyan-200"
            >
              Produkte entdecken
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </a>

            <a
              href="#vision"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3.5 font-medium text-white transition hover:border-white/30 hover:bg-white/[0.07]"
            >
              Unsere Vision
            </a>
          </div>

          <div className="mt-16 grid max-w-3xl grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
            {[
              ["6", "Produktlinien"],
              ["1", "gemeinsame Plattform"],
              ["100 %", "langfristiger Aufbau"],
              ["2026", "offizieller Start"],
            ].map(([value, label]) => (
              <div key={label}>
                <div className="text-2xl font-semibold text-white">{value}</div>
                <div className="mt-1 text-sm text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="produkte"
        className="relative scroll-mt-20 border-y border-white/10 bg-white/[0.015] py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
              Produkte
            </div>

            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Ein gemeinsames Dach für starke Werkzeuge.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-400">
              Jede Produktlinie löst eine eigene Aufgabe. Gemeinsam bilden sie
              eine langfristig erweiterbare Engineering-Plattform.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const Icon = product.icon;

              return (
                <article
                  key={product.name}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-7 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.055]"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent opacity-0 transition group-hover:opacity-100" />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                      <Icon className="h-6 w-6 text-cyan-300" />
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                      {product.status}
                    </span>
                  </div>

                  <h3 className="mt-7 text-2xl font-semibold tracking-tight">
                    {product.name}
                  </h3>

                  <p className="mt-3 min-h-20 leading-7 text-slate-400">
                    {product.description}
                  </p>

                  <ul className="mt-6 space-y-3 border-t border-white/10 pt-6">
                    {product.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-3 text-sm text-slate-300"
                      >
                        <Check className="h-4 w-4 text-cyan-300" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="vision"
        className="relative scroll-mt-20 py-24 sm:py-32"
      >
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <div className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
              Vision
            </div>

            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Aus der Praxis. Für die Praxis.
            </h2>
          </div>

          <div className="space-y-8 text-lg leading-8 text-slate-400">
            <p>
              LuMa Labs entsteht aus echten Anforderungen der täglichen
              Ingenieurarbeit. Unser Ziel sind keine kurzlebigen Experimente,
              sondern verständliche und zuverlässige Werkzeuge, die dauerhaft
              Zeit sparen.
            </p>

            <p>
              Software, BIM, Dokumentation und Infrastruktur werden dabei nicht
              getrennt betrachtet. Sie bilden ein gemeinsames System, das
              Schritt für Schritt wächst.
            </p>

            <div className="grid gap-4 pt-4 sm:grid-cols-3">
              {[
                {
                  icon: Wrench,
                  title: "Praxisnah",
                  text: "Entwickelt aus realen Arbeitsabläufen.",
                },
                {
                  icon: Boxes,
                  title: "Modular",
                  text: "Sauber aufgebaut und langfristig erweiterbar.",
                },
                {
                  icon: Code2,
                  title: "Nachhaltig",
                  text: "Dokumentiert, versioniert und wartbar.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <h3 className="mt-4 font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="roadmap"
        className="relative scroll-mt-20 border-y border-white/10 bg-white/[0.015] py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <div className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
                Roadmap
              </div>

              <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Schritt für Schritt zum vollständigen Ökosystem.
              </h2>

              <p className="mt-5 max-w-xl leading-7 text-slate-400">
                LuMa Labs wächst bewusst kontrolliert: zuerst eine stabile
                Grundlage, danach die einzelnen Produkte und automatisierten
                Prozesse.
              </p>
            </div>

            <div className="space-y-4">
              {roadmap.map((item, index) => (
                <div
                  key={item.title}
                  className="flex gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${
                      item.status === "done"
                        ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                        : item.status === "active"
                          ? "border-blue-400/30 bg-blue-400/10 text-blue-200"
                          : "border-white/10 bg-white/[0.04] text-slate-500"
                    }`}
                  >
                    {item.status === "done" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-white">{item.title}</h3>

                      {item.status === "active" && (
                        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs text-blue-200">
                          Aktuell
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/10 via-white/[0.03] to-blue-500/10 p-8 sm:p-12">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
                  Technologie
                </div>

                <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Moderne Werkzeuge. Saubere Prozesse. Eine gemeinsame Basis.
                </h2>

                <div className="mt-7 flex flex-wrap gap-3">
                  {technologies.map((technology) => (
                    <span
                      key={technology}
                      className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300"
                    >
                      {technology}
                    </span>
                  ))}
                </div>
              </div>

              <a
                href="https://github.com/NexiCH86"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-medium text-slate-950 transition hover:bg-slate-200"
              >
                <GitBranch className="h-5 w-5" />
                GitHub öffnen
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="font-semibold">LuMa Labs</div>
            <div className="mt-1 text-sm text-slate-500">
              Engineering · Software · BIM · Infrastructure
            </div>
          </div>

          <div className="text-sm text-slate-500">
            © 2026 LuMa Labs. Building tools that last.
          </div>
        </div>
      </footer>
    </main>
  );
}