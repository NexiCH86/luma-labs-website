import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Stats } from "@/components/sections/Stats";
import { Solutions } from "@/components/sections/Solutions";
import { Projects } from "@/components/sections/Projects";
import { Technology } from "@/components/sections/Technology";
import { Roadmap } from "@/components/sections/Roadmap";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#061019] font-sans text-white">
      <Navbar />

      <Hero />

      <section className="border-y border-cyan-300/10 bg-[#07151d]/70 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 rounded-2xl border border-cyan-300/10 bg-white/[0.025] p-6 backdrop-blur-sm sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-cyan-300/60">
              LuMa Live Services
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Switzerland Flight Radar
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Live-Flugverkehr über der Schweiz mit Positionsdaten,
              Flughäfen, Höhenanzeige, Flugspuren und interaktiver
              Kartenansicht.
            </p>
          </div>

          <a
            href="/radar"
            className="group inline-flex shrink-0 items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-6 py-3 text-sm font-medium text-cyan-200 transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/[0.12] hover:shadow-[0_0_30px_rgba(103,232,249,0.12)]"
          >
            <span className="text-lg transition group-hover:rotate-12">
              ✈
            </span>

            <span>Live Radar öffnen</span>

            <span className="text-cyan-300/50 transition group-hover:translate-x-1">
              →
            </span>
          </a>
        </div>
      </section>

      <Stats />

      <Solutions />

      <Projects />

      <Technology />

      <Roadmap />

      <Footer />
    </main>
  );
}