import { Building2, Code2, Network, ShieldCheck, Leaf } from "lucide-react";

const stats = [
  [Building2, "Engineering", "Praxisnah", "Aus realen Aufgaben"],
  [Code2, "Software", "Modular", "Sauber entwickelt"],
  [Network, "Infrastruktur", "Vernetzt", "Skalierbare Systeme"],
  [ShieldCheck, "Qualität", "100 %", "Dokumentiert"],
  [Leaf, "Zukunft", "Nachhaltig", "Langfristig gedacht"],
];

export function Stats() {
  return (
    <section className="relative z-20 mx-auto -mt-14 max-w-[1480px] px-6 lg:px-10">
      <div className="grid overflow-hidden rounded-xl border border-white/10 bg-[#091722]/95 shadow-2xl shadow-black/30 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([Icon, label, value, description], index) => (
          <article
            key={label as string}
            className={`p-6 ${index ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""}`}
          >
            <Icon className="h-7 w-7 text-[#00A99D]" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {label as string}
            </p>
            <p className="mt-1 text-2xl font-medium text-[#00D7D5]">
              {value as string}
            </p>
            <p className="mt-1 text-sm text-slate-400">{description as string}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
