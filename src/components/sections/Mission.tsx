export function Mission() {
  return (
    <section className="relative border-y border-white/10 bg-white/[0.015] py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
            Mission
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Aus echten Anforderungen entstehen langlebige Werkzeuge.
          </h2>
        </div>

        <div className="space-y-6 text-lg leading-8 text-slate-400">
          <p>
            LuMa Labs entwickelt keine isolierten Experimente. Jedes Projekt
            entsteht aus realen technischen Aufgaben und wird so aufgebaut,
            dass es verständlich, dokumentiert und langfristig erweiterbar ist.
          </p>
          <p>
            Engineering, Software, BIM, künstliche Intelligenz und Smart
            Infrastructure werden dabei als zusammenhängendes System gedacht.
          </p>
        </div>
      </div>
    </section>
  );
}
