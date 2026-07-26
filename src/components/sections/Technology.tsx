const items = [
  "Python", "Next.js", "TypeScript", "Docker", "Linux", "GitHub",
  "Raspberry Pi", "Revit", "Dynamo", "Home Assistant", "FastAPI", "AI"
];

export function Technology() {
  return (
    <section id="technologien" className="scroll-mt-24 py-28">
      <div className="mx-auto max-w-[1480px] px-6 lg:px-10">
        <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
          Technologien
        </p>
        <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
          Moderne Werkzeuge auf einer stabilen Grundlage.
        </h2>

        <div className="mt-10 flex flex-wrap gap-3">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-md border border-white/10 bg-[#0A1924] px-5 py-3 text-sm text-slate-300 transition hover:border-[#00A99D]/50 hover:text-white"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
