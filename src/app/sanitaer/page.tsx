import type { Metadata } from "next";
import { CloudRain, Droplets, ExternalLink, Gauge, GitBranch, ListChecks, Thermometer } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "BOG Sanitär | LuMa Labs",
  description:
    "Schnellrechner für die Sanitärplanung: Trinkwasser nach SVGW W3 (Belastungswerte, Spitzendurchfluss, Rohrweite, Fliessdruck, Ausstosszeit), Entwässerung mit Fall- und Grundleitungen sowie Dachentwässerung mit Notüberlauf.",
};

const APP = "/sanitaer-rechner/index.html";

const features = [
  [GitBranch, "Netz als Baum", "Teilstrecken ab Verteilbatterie bzw. Kanalisation, Apparate je Teilstrecke – Summen werden automatisch gebildet."],
  [Droplets, "Trinkwasser nach SVGW W3", "Belastungswerte LU, Spitzendurchfluss nach Diagramm 1 und Rohrweite nach v_max für Mepla, Mapress, PushFit oder PE-X."],
  [Gauge, "Fliessdruck an jeder Entnahmestelle", "Reibung, Formstücke und Höhe; zu knappe Stränge werden automatisch vergrössert, bis 1 bar erreicht ist."],
  [Thermometer, "Warmwasser und Ausstosszeit", "Ausstosszeit ab der letzten zirkulierten oder begleitbeheizten Strecke gegen den Zielwert."],
  [ListChecks, "Entwässerung", "Anschlusswerte DU, Qww = K·√ΣDU, Einzel-, Sammel-, Fall- und Grundleitungen mit Füllungsgrad und Auslastung."],
  [CloudRain, "Dachentwässerung", "Regenabfluss, Anzahl Dachabläufe, Regenfallleitung und Breite des Notüberlaufs je Dachfläche."],
] as const;

export default function SanitaerPage() {
  return (
    <PageShell>
      <section className="border-b border-white/10 bg-[#08151f]">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-6 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
              BOG Sanitär · Beta V0.1
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Leitungen dimensionieren – von der Verteilbatterie bis aufs Dach.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Apparate wählen, das Tool rechnet Belastungswerte, Spitzendurchfluss, Rohrweite und
              Fliessdruck für Kalt- und Warmwasser nach SVGW W3 – und im selben Projekt die
              Schmutzwasser- und Dachentwässerung.
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
            title="BOG Sanitär"
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
              Beta-Version für die Vorbemessung. Belastungswerte und Spitzendurchfluss nach SVGW W3 (2013);
              Anschlusswerte und Grenzwerte der Entwässerung sind Richtwerte und mit SN 592000 abzugleichen.
            </li>
            <li>
              Projekte werden nur im eigenen Browser gespeichert (lokaler Speicher) oder als Datei
              heruntergeladen – nichts wird auf lumalabs.ch abgelegt.
            </li>
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
