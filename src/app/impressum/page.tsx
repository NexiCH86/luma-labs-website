import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Impressum | LuMa Labs",
  description: "Impressum von lumalabs.ch",
};

export default function ImpressumPage() {
  return (
    <LegalPage eyebrow="Rechtliches" title="Impressum">
      <section>
        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          Luis Moran
          <br />
          Schweiz
        </p>
        <p className="mt-3">
          E-Mail: <a href="mailto:luis.moran@mail.ch">luis.moran@mail.ch</a>
        </p>
      </section>

      <section>
        <h2>Über diese Website</h2>
        <p>
          lumalabs.ch ist die private, nicht-kommerzielle Projektwebsite von LuMa Labs. Sie
          zeigt eigene Software-, Engineering- und Infrastrukturprojekte, darunter LuMa
          RADAR.
        </p>
      </section>

      <section>
        <h2>Haftung für Inhalte und Daten</h2>
        <p>
          Die Inhalte werden mit Sorgfalt erstellt, eine Gewähr für Richtigkeit,
          Vollständigkeit und Aktualität besteht jedoch nicht. Die Flug-, Satelliten- und
          Himmelsdaten in LuMa RADAR stammen aus öffentlichen Quellen und dienen nur der
          Information. Sie sind nicht für Navigation, Flugsicherheit oder andere
          sicherheitskritische Zwecke geeignet.
        </p>
      </section>

      <section>
        <h2>Haftung für Links</h2>
        <p>
          Für Inhalte verlinkter externer Websites sind ausschliesslich deren Betreiber
          verantwortlich.
        </p>
      </section>

      <section>
        <h2>Datenquellen und Urheberrechte</h2>
        <ul>
          <li>Kartendaten: © OpenStreetMap contributors, © CARTO</li>
          <li>Flugdaten: OpenSky Network und adsb.lol (ODbL)</li>
          <li>Flughäfen: OurAirports · Ländergrenzen: Natural Earth</li>
          <li>Satellitenbahnen: CelesTrak</li>
          <li>Sternkatalog: d3-celestial (Olaf Frohn, BSD-3) · Planeten: astronomy-engine</li>
          <li>Fotos, Logo und Texte: © LuMa Labs</li>
        </ul>
      </section>
    </LegalPage>
  );
}
