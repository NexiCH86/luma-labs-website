import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/*
 * Rahmen fuer Unterseiten (Produkte, Impressum, Datenschutz)
 * mit Navigation und Footer wie auf der Startseite.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#061019] font-sans text-white">
      <Navbar />
      <div className="pt-20">{children}</div>
      <Footer />
    </main>
  );
}
