import { Bot, Code2, House, Wind } from "lucide-react";

const pillars = [
  {
    title: "Engineering",
    text: "Lüftungstechnik, Berechnung, Normen und praxistaugliche Werkzeuge.",
    icon: Wind,
  },
  {
    title: "BIM & Development",
    text: "Revit, Dynamo, Python, Next.js und saubere Softwarearchitektur.",
    icon: Code2,
  },
  {
    title: "AI & Automation",
    text: "Intelligente Assistenten, Dokumentenanalyse und Automatisierung.",
    icon: Bot,
  },
  {
    title: "Smart Infrastructure",
    text: "Home Assistant, Raspberry Pi, Docker, Server und vernetzte Systeme.",
    icon: House,
  },
];

export function Pillars() {
  return (
    <section id="saeulen" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
          Die vier Säulen
        </p>
        <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Eine Plattform für Technik, Wissen und digitale Systeme.
        </h2>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-7 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.055]"
              >
                <Icon className="h-7 w-7 text-cyan-300" />
                <h3 className="mt-6 text-2xl font-semibold">{pillar.title}</h3>
                <p className="mt-3 leading-7 text-slate-400">{pillar.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
