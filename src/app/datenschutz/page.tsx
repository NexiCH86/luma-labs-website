import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Datenschutz | LuMa Labs",
  description: "Datenschutzerklärung von lumalabs.ch nach dem Schweizer Datenschutzgesetz (DSG)",
};

export default function DatenschutzPage() {
  return (
    <LegalPage eyebrow="Rechtliches" title="Datenschutzerklärung">
      <section>
        <p>
          Diese Erklärung informiert darüber, welche Personendaten beim Besuch von
          lumalabs.ch bearbeitet werden. Sie richtet sich nach dem Schweizer
          Datenschutzgesetz (DSG). Stand: Oktober 2026.
        </p>
      </section>

      <section>
        <h2>Verantwortlicher</h2>
        <p>
          Luis Moran, Schweiz · <a href="mailto:luis.moran@mail.ch">luis.moran@mail.ch</a>
          <br />
          Weitere Angaben im <Link href="/impressum">Impressum</Link>.
        </p>
      </section>

      <section>
        <h2>Kein Tracking</h2>
        <p>
          Diese Website verwendet keine Analyse- oder Werbedienste, keine Tracking-Cookies
          und keine Social-Media-Plugins. Die Schrift (Inter) wird von dieser Website selbst
          ausgeliefert; es wird dafür keine Verbindung zu Google aufgebaut.
        </p>
      </section>

      <section>
        <h2>Hosting und Server-Logs</h2>
        <p>
          Die Website wird bei Vercel Inc. (USA) betrieben. Beim Aufruf werden technisch
          notwendige Daten verarbeitet, insbesondere IP-Adresse, Zeitpunkt, aufgerufene
          Adresse, Browser und Betriebssystem. Sie dienen dem Betrieb, der Sicherheit und
          der Fehleranalyse und werden nach kurzer Zeit gelöscht. Dabei können Daten in die
          USA übermittelt werden; Vercel stellt dafür vertragliche Garantien
          (Standardvertragsklauseln) bereit.
        </p>
      </section>

      <section>
        <h2>Karten (CARTO)</h2>
        <p>
          Die Hintergrundkarten in LuMa RADAR werden direkt von CARTO geladen. Dabei erhält
          CARTO technisch bedingt die IP-Adresse des Browsers und die angefragten
          Kartenausschnitte. Es gelten die Datenschutzbestimmungen von CARTO.
        </p>
      </section>

      <section>
        <h2>Daten in LuMa RADAR</h2>
        <ul>
          <li>
            Flug-, Satelliten- und Himmelsdaten (OpenSky Network, adsb.lol, CelesTrak,
            OurAirports, Natural Earth) werden über den Server dieser Website abgerufen.
            Dabei werden keine Daten über Besucher an diese Dienste weitergegeben.
          </li>
          <li>
            Der Zwischenspeicher für Flugdaten (Redis Cloud) enthält ausschliesslich
            Flugdaten, keine Besucherdaten.
          </li>
          <li>
            Die Ortssuche im SAT-Modus wird über den Server an OpenStreetMap (Nominatim)
            weitergeleitet. Übermittelt wird nur der eingegebene Suchbegriff.
          </li>
          <li>
            „My Location“ fragt den Standort nur nach Zustimmung im Browser ab. Er wird
            ausschliesslich im Browser für die Berechnung verwendet und nicht gespeichert.
          </li>
          <li>
            Einstellungen wie Panel-Positionen oder Beobachtungslisten werden lokal im
            Browser gespeichert (Local Storage) und nicht übertragen.
          </li>
        </ul>
      </section>

      <section>
        <h2>Geschützte Bereiche</h2>
        <p>
          Für das private Portal und das Control Center wird nach dem Login ein technisch
          notwendiges Sitzungs-Cookie gesetzt. Diese Bereiche sind nicht öffentlich.
        </p>
      </section>

      <section>
        <h2>Ihre Rechte</h2>
        <p>
          Sie können Auskunft über Ihre Personendaten verlangen sowie deren Berichtigung
          oder Löschung. Eine E-Mail an{" "}
          <a href="mailto:luis.moran@mail.ch">luis.moran@mail.ch</a> genügt.
        </p>
      </section>
    </LegalPage>
  );
}
