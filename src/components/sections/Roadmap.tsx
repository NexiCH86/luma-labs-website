const items = [
  ["Website & Domain", "Abgeschlossen"],
  ["Branding & Corporate Design", "Aktuell"],
  ["LuMa Air Alpha", "Nächster Meilenstein"],
  ["Academy & Docs", "Geplant"],
  ["Smart Infrastructure", "Geplant"],
];

export function Roadmap() {
  return (
    <section id="roadmap" className="scroll-mt-24 border-t border-white/10 bg-[#08151f] py-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
          Roadmap
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
          Schritt für Schritt zum Engineering-Ökosystem.
        </h2>

        <div className="mt-12 space-y-4">
          {items.map(([title, status], index) => (
            <div
              key={title}
              className="flex items-center gap-5 rounded-xl border border-white/10 bg-[#0A1924] p-6"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#00A99D]/40 text-sm text-[#00D7D5]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="font-medium text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
