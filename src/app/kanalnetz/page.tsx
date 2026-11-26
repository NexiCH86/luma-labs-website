import type { Metadata } from "next";
import { AudioLines, ExternalLink, Gauge, GitBranch, Ruler, SlidersHorizontal, Wind } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "BOG Kanalnetz | LuMa Labs",
  description:
    "Schnellrechner für Lüftungskanalnetze: Dimensionierung, Druckverlust, ungünstigster Strang und Ventilatordruck – mit integrierter Schalldämpfer-Auslegung in Oktavbändern.",
};

const APP = "/kanalnetz-rechner/index.html";

const features = [
  [GitBranch, "Netz als Baum", "Teilstrecken ab Gerät, Volumenströme werden von den Endsträngen aufsummiert."],
  [Ruler, "Automatische Dimensionierung", "Normdurchmesser oder Kanalbreite nach v_max und R_max je Kanalkategorie."],
  [Gauge, "Ungünstigster Strang", "Druckverlust nach Colebrook-White und ζ-Werten, Drosselbedarf je Auslass, Ventilatordruck und SFP."],
  [AudioLines, "Akustik in Oktaven", "Ventilator, Verzweigungen, Kanal, Bögen, Mündungsreflexion und Raumpegel gegen den Zielwert."],
  [Wind, "Schalldämpfer integriert", "Typ und Länge werden ausgelegt; der Druckverlust fliesst in Ventilatordruck und Schallleistung zurück."],
  [SlidersHorizontal, "Einzelrechnung", "Schnellprüfung eines Schalldämpfers ohne Netz – für den kurzen Check zwischendurch."],
] as const;

export default function KanalnetzPage() {
  return (
    <PageShell>
      <section className="border-b border-white/10 bg-[#08151f]">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-6 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
              BOG Kanalnetz · Beta V0.1
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Kanalnetz und Schalldämpfer in einem Durchgang.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Querschnitte, Geschwindigkeiten und Druckverluste für das ganze Lüftungsnetz, der
              ungünstigste Strang und der Ventilatordruck – und im selben Modell die
              Schalldämpfer-Auslegung für jeden versorgten Raum.
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
            title="BOG Kanalnetz"
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
              Beta-Version für die Vorbemessung. Schalldämpfer-Kennwerte und Akustik-Ansätze (VDI 2081,
              ASHRAE) sind Näherungen – für die Ausführung gelten Herstellerauslegungen und die Akustikplanung.
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
