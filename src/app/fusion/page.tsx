import { ArrowRight, Boxes, FileText, ShieldCheck, Users, Wrench } from "lucide-react";

const projects = [
  { name: "BOG Fusion Pilot", code: "PILOT-01", location: "Schweiz", disciplines: "ARCH · H · LUE · SAN · KOORD", issues: 73, critical: 12 },
  { name: "Demo Projekt Architektur", code: "DEMO-ARCH", location: "Schlieren", disciplines: "ARCH · LUE · SAN", issues: 18, critical: 2 },
];

export default function FusionPage() {
  return (
    <main className="min-h-screen bg-[#f5f8f9] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <Boxes className="h-7 w-7 text-[#0097c3]" />
              <h1 className="font-serif text-3xl">BOG Fusion</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">BIM Coordination & Automation · Pilotzugang</p>
          </div>
          <a href="/" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[#0097c3] hover:text-[#0097c3]">Zur LuMa Labs Startseite</a>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0097c3]">Meine Projekte</p>
            <h2 className="mt-2 font-serif text-3xl">Projektübersicht</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Hier werden nach dem Login nur Projekte angezeigt, für die der jeweilige Benutzer freigeschaltet wurde.</p>
          </div>
          <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">Preview · aktueller Entwicklungsstand</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((project, index) => (
            <article key={project.code} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-40 bg-gradient-to-br from-[#e8f6fa] via-[#f3fafb] to-[#dfecef]">
                <div className="absolute inset-0 opacity-70" style={{backgroundImage:"linear-gradient(90deg,rgba(0,151,195,.11) 1px,transparent 1px),linear-gradient(rgba(0,151,195,.11) 1px,transparent 1px)",backgroundSize:"32px 32px"}} />
                <div className="absolute bottom-4 left-4 rounded-md border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#0097c3]">Projektvorschau {index + 1}</div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-serif text-xl">{project.name}</h3><p className="mt-1 text-xs text-slate-500">{project.code} · {project.location}</p></div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Aktiv</span>
                </div>
                <p className="mt-4 text-xs font-medium text-slate-600">{project.disciplines}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-semibold text-[#0097c3]">{project.issues}</div><div className="text-xs text-slate-500">Offene Issues</div></div>
                  <div className="rounded-lg bg-amber-50 p-3"><div className="text-2xl font-semibold text-amber-700">{project.critical}</div><div className="text-xs text-amber-700/70">Kritisch</div></div>
                </div>
                <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0097c3] px-4 py-2.5 text-sm font-semibold text-white opacity-80" title="Viewer wird aktuell entwickelt">
                  Projekt öffnen <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            [Boxes, "2D / 3D", "IFC, Pläne und Split View"],
            [FileText, "Issues", "Clash → Issue → Revit"],
            [Users, "Benutzer", "Projektbezogene Zugriffe"],
            [ShieldCheck, "Rollen", "Intern, extern, nur lesen"],
          ].map(([Icon, title, text]) => {
            const C = Icon as typeof Boxes;
            return <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-4"><C className="h-5 w-5 text-[#0097c3]"/><h3 className="mt-3 font-semibold">{String(title)}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{String(text)}</p></div>;
          })}
        </div>

        <div className="mt-8 rounded-xl border border-cyan-100 bg-cyan-50/60 p-5 text-sm text-slate-700">
          <div className="flex items-center gap-2 font-semibold text-cyan-800"><Wrench className="h-4 w-4"/> Pilotstatus</div>
          <p className="mt-2 leading-6">Diese Seite stellt den aktuellen BOG-Fusion-Zugang auf lumalabs.ch bereit. Der produktive IFC-/2D-Viewer und die Revit-Anbindung werden parallel im BOG-Fusion-Repository weiterentwickelt.</p>
        </div>
      </section>
    </main>
  );
}
