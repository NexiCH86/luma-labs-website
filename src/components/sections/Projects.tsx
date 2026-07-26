const projects = [
  ["LuMa Labs Website", "Live", "100%"],
  ["LuMa Air", "In Entwicklung", "20%"],
  ["LuMa Server", "Aktiv", "35%"],
  ["LuMa Smart", "Im Aufbau", "15%"],
];

export function Projects() {
  return (
    <section id="projekte" className="scroll-mt-24 border-y border-white/10 bg-[#08151f] py-28">
      <div className="mx-auto max-w-[1480px] px-6 lg:px-10">
        <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
          Aktuelle Projekte
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
          Fortschritt, der sichtbar bleibt.
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {projects.map(([name, status, progress]) => (
            <article key={name} className="rounded-xl border border-white/10 bg-[#0A1924] p-7">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-medium text-white">{name}</h3>
                <span className="text-sm text-[#00D7D5]">{status}</span>
              </div>
              <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#007D75] to-[#00D7D5]"
                  style={{ width: progress }}
                />
              </div>
              <p className="mt-3 text-right text-xs text-slate-500">{progress}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
