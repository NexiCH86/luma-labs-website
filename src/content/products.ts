/*
 * Inhalte der Produktseiten /loesungen/<slug> (NEX-131).
 * Stand Oktober 2026, abgeleitet aus den Linear-Projekten und der Roadmap.
 * Status bewusst zurueckhaltend formuliert.
 */
export type ProductStatus = "Live" | "Pilot" | "In Entwicklung" | "Im Aufbau" | "Geplant";

export type Product = {
  slug: string;
  name: string;
  icon: string;
  status: ProductStatus;
  tagline: string;
  intro: string;
  features: string[];
  stack: string[];
  links: { label: string; href: string }[];
  roadmap: string;
};

export const products: Product[] = [
  {
    slug: "air",
    name: "LuMa Air",
    icon: "/brand/app-icons/LuMa-Air.svg",
    status: "In Entwicklung",
    tagline: "Lüftungssoftware für Planung, Berechnung und Auslegung.",
    intro:
      "LuMa Air bündelt Werkzeuge für die Lüftungs- und Klimaplanung: vom Lüftungsrechner über das h-x-Diagramm bis zu Simulationen. Ziel sind schnelle, nachvollziehbare Berechnungen direkt aus dem Planungsalltag.",
    features: [
      "Lüftungsrechner für Luftmengen, Kanaldimensionierung und Druckverluste",
      "LuMa h-x: Zustandspunkte, Prozesse und Diagramm für feuchte Luft",
      "Coandă-Simulation und Auswertungen als Diagramm",
      "Geplant: Projektverwaltung und PDF-Berichte",
    ],
    stack: ["Python", "Dart / Flutter", "Windows & iPad"],
    links: [],
    roadmap: "#roadmap-engineering",
  },
  {
    slug: "bim",
    name: "LuMa BIM",
    icon: "/brand/app-icons/BOG-Fusion.svg",
    status: "Pilot",
    tagline: "BIM-Tools und Revit-Automatisierung für koordinierte Planung.",
    intro:
      "Mit BOG Fusion entsteht ein herstellerneutraler Open-BIM-Arbeitsplatz für die Fachkoordination: IFC-Modelle, Pläne und Issues an einem Ort, mit Brücke zu Revit.",
    features: [
      "IFC-Viewer mit 2D-, 3D- und Split-Ansicht",
      "Issues aus Bauteilen, Viewpoints und Markups",
      "Kollisionsprüfung mit direkter Übernahme als Issue",
      "Revit-Brücke und lokaler Projektordner (Dateien bleiben lokal)",
    ],
    stack: ["Next.js", "TypeScript", "IFC / Open BIM", "Revit API"],
    links: [{ label: "BOG Fusion öffnen", href: "https://bog-fusion.vercel.app" }],
    roadmap: "#roadmap-engineering",
  },
  {
    slug: "server",
    name: "LuMa Server",
    icon: "/brand/app-icons/LuMa-Server.svg",
    status: "Live",
    tagline: "Docker, Linux, Raspberry Pi und zuverlässige Infrastruktur.",
    intro:
      "Das LuMa-Homelab trägt die Dienste hinter LuMa Labs: Server, Raspberry Pis, Container, Backups und Überwachung. Es ist auf Ausfallsicherheit und Wiederherstellbarkeit ausgelegt.",
    features: [
      "Linux-Server und Raspberry Pis mit Docker und Portainer",
      "Überwachung mit Uptime Kuma und Discord-Alarmen",
      "Verschlüsselte Offsite-Backups mit Restic",
      "Fernzugriff über Tailscale und Wake-on-LAN",
    ],
    stack: ["Linux", "Docker", "Raspberry Pi", "Uptime Kuma", "Restic", "Tailscale"],
    links: [{ label: "Control Center", href: "/control-center" }],
    roadmap: "#roadmap-knowledge",
  },
  {
    slug: "smart",
    name: "LuMa Smart",
    icon: "/brand/app-icons/LuMa-Home.svg",
    status: "Im Aufbau",
    tagline: "Smart Home, IoT und intelligente Gebäudeautomation.",
    intro:
      "LuMa Smart verbindet Geräte im Haus zu einer zentralen, lokal betriebenen Steuerung, vom Licht über Kameras bis zum Status-Display an der Wand.",
    features: [
      "Home Assistant als unabhängige 24/7-Zentrale",
      "Tapo-Steckdosen und -Kameras, Shelly-Storen und -Rauchmelder",
      "Status-Display (M5Stack Tab5) für Licht, Klima, Medien und Systeme",
      "Geplant: Automationen und Dashboards",
    ],
    stack: ["Home Assistant", "ESP32 / M5Stack", "go2rtc"],
    links: [],
    roadmap: "#roadmap-knowledge",
  },
  {
    slug: "ai",
    name: "LuMa AI",
    icon: "/brand/app-icons/LuMa-AI.svg",
    status: "Geplant",
    tagline: "KI-Assistenten, Dokumentenanalyse und Automatisierung.",
    intro:
      "LuMa AI soll ein lokal betriebener KI-Assistent werden: sensible Dokumente und Modelle bleiben im eigenen Netz, Cloud-Modelle sind nur optional, mit transparentem Kostenzähler.",
    features: [
      "Lokale Modelle in den Stufen FAST, STANDARD und MAX",
      "Wissensbasis und Langzeitgedächtnis über eigene Dokumente (RAG)",
      "Bedienung über das LuMa-Labs-Portal",
      "Kostenmonitor für optionale Cloud-Dienste",
    ],
    stack: ["Lokale LLMs", "RAG", "Next.js-Portal"],
    links: [],
    roadmap: "#roadmap-os",
  },
  {
    slug: "docs",
    name: "LuMa Docs",
    icon: "/brand/app-icons/LuMa-Docs.svg",
    status: "Im Aufbau",
    tagline: "Technische Dokumentationen und zentrale Wissensbasis.",
    intro:
      "LuMa Docs sammelt Architektur, Betrieb und Standards aller LuMa-Projekte an einem Ort, damit Systeme nachvollziehbar bleiben und sich wieder aufbauen lassen.",
    features: [
      "Developer Handbook und Projekt-Standards",
      "Betriebs- und Wiederherstellungsanleitungen (z. B. Radar-Collector)",
      "Checklisten und Architekturentscheidungen",
    ],
    stack: ["Markdown", "GitHub", "Linear"],
    links: [{ label: "GitHub", href: "https://github.com/NexiCH86" }],
    roadmap: "#roadmap-knowledge",
  },
  {
    slug: "academy",
    name: "LuMa Academy",
    icon: "/brand/app-icons/LuMa-Academy.svg",
    status: "Im Aufbau",
    tagline: "Python, Git, Docker und praxisorientiertes Lernen.",
    intro:
      "LuMa Academy strukturiert Weiterbildung entlang echter Projekte: Programmieren, Infrastruktur und IT-Sicherheit, immer mit praktischem Bezug.",
    features: [
      "Lernpfade für Python, Git, Docker und Flutter",
      "CS50 und strukturierte Informatik-Grundlagen",
      "Ethical Hacking im isolierten CyberLab",
    ],
    stack: ["Python", "Git", "Docker", "Flutter", "Kali Linux"],
    links: [],
    roadmap: "#roadmap-knowledge",
  },
  {
    slug: "sync",
    name: "LuMa Sync",
    icon: "/brand/app-icons/LuMa-Sync.svg",
    status: "Im Aufbau",
    tagline: "CI/CD, Releases, Backups und Daten-Synchronisation.",
    intro:
      "LuMa Sync sorgt dafür, dass Software und Daten zuverlässig dort ankommen, wo sie gebraucht werden: automatische Deployments, signierte Releases und Backups.",
    features: [
      "Automatische Deployments über GitHub und Vercel",
      "Signierte Android-Releases für LuMa Slate",
      "Geplant: Update-Server mit OTA, Rollback und Prüfsummen",
      "Backup-Strategie mit Integritätsprüfung",
    ],
    stack: ["GitHub", "Vercel", "Restic"],
    links: [],
    roadmap: "#roadmap-knowledge",
  },
];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}
