import type { Metadata } from "next";
import { BatteryCharging, ExternalLink, Gauge, Network, Sun, ThermometerSun, Zap } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "BOG Energy Studio | LuMa Labs",
  description:
    "Energiefluss, Wärmepumpe, Photovoltaik, Batterie und Eigenverbrauchsgemeinschaften als Stundenbilanz über 8'760 Stunden – mit Sankey-Diagramm und Variantenvergleich.",
};

const APP = "/energy-studio/index.html";

const features = [
  [Zap, "Stundenbilanz 8'760 h", "Eigenverbrauch und Autarkie werden berechnet, nicht angenommen."],
  [ThermometerSun, "Wärmepumpe und Kessel", "COP temperaturabhängig, auf die JAZ kalibriert; Gas, Öl, Pellets, Fernwärme."],
  [Sun, "PV und Klimadaten", "Dach- und Fassadenflächen, PVGIS-Meteojahr für jeden Standort."],
  [BatteryCharging, "Batterie und E-Mobilität", "Speicher mit Verlusten, PV-geführtes Laden, Warmwasser-Ladestrategie."],
  [Network, "ZEV · vZEV · LEG", "Vereinfachte Wirtschaftlichkeit von Eigenverbrauchsgemeinschaften."],
  [Gauge, "Variantenvergleich", "Kosten, CO₂, gewichtete Endenergie und Leistungsspitzen nebeneinander."],
] as const;

export default function EnergyStudioPage() {
  return (
    <PageShell>
      <section className="border-b border-white/10 bg-[#08151f]">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-6 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
              BOG Energy Studio · Beta V0.2
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Energiefluss, PV und Gebäudebilanz.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Von der Nutzenergie über Wärmepumpe oder Kessel zu Strom, Photovoltaik, Batterie, Netz,
              Kosten und CO₂ – stündlich gerechnet und als Energiefluss dargestellt. Für
              Machbarkeitsstudien, Energiekonzepte und Variantenentscheide.
            </p>
          </div>
          <a
            href={APP}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-md border border-[#00AFC2]/55 bg-gradient-to-r from-[#008A99] to-[#00AFC2] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,175,194,0.14)] transition hover:-translate-y-0.5 lg:self-auto"
          >
            Im Vollbild öffnen
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="bg-[#061019] px-0 py-0 sm:px-4 sm:py-4 lg:px-6">
        <div className="mx-auto max-w-[1800px] overflow-hidden border-white/10 bg-[#f1f1f1] sm:rounded-xl sm:border">
          <iframe
            src={APP}
            title="BOG Energy Studio"
            className="block h-[calc(100vh-5rem)] min-h-[720px] w-full"
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-6 py-16 lg:px-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([Icon, titel, text]) => (
            <article key={titel} className="rounded-xl border border-white/10 bg-[#0A1924] p-6">
              <Icon className="h-5 w-5 text-[#00D7D5]" />
              <h2 className="mt-4 text-lg font-medium text-white">{titel}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-6 text-sm leading-relaxed text-slate-400">
          <p className="font-medium text-amber-100/90">Hinweise</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Beta-Version für erste Bilanzen. Keine Normberechnung, kein Energienachweis (SIA 380/1 u. a.).
              Kennwerte, Tarife und Faktoren vor Projekteinsatz prüfen.
            </li>
            <li>
              Projekte werden nur im eigenen Browser gespeichert (lokaler Speicher) oder als Datei
              heruntergeladen – nichts wird auf lumalabs.ch abgelegt.
            </li>
            <li>
              Beim Laden von PVGIS-Klimadaten werden nur die Koordinaten über lumalabs.ch an PVGIS
              (Gemeinsame Forschungsstelle der EU-Kommission) übermittelt.
            </li>
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
