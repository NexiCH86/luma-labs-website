import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Stats } from "@/components/sections/Stats";
import { Solutions } from "@/components/sections/Solutions";
import { Projects } from "@/components/sections/Projects";
import { Technology } from "@/components/sections/Technology";
import { Roadmap } from "@/components/sections/Roadmap";
import { LockKeyhole, Radar } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#061019] font-sans text-white">
      <Navbar />
      <Hero />

      <section className="border-y border-cyan-300/10 bg-[#07151d]/70 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.32em] text-cyan-300/60">
            LuMa Live Systems
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <a
              href="/radar"
              className="group rounded-2xl border border-cyan-300/10 bg-white/[0.025] p-6 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05]">
                    <Radar className="h-5 w-5 text-cyan-200" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">LuMa RADAR</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                    Live-Flugverkehr, Flughäfen, Airspace und SAT-Workspace in einer eigenen Tracking-Oberfläche.
                  </p>
                </div>
                <span className="mt-1 text-xl text-cyan-300/50 transition group-hover:translate-x-1">→</span>
              </div>
              <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/60">Public Live Access</p>
            </a>

            <a
              href="/control-center"
              className="group rounded-2xl border border-cyan-300/10 bg-white/[0.025] p-6 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05]">
                    <LockKeyhole className="h-5 w-5 text-cyan-200" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">LuMa Control Center</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                    Geschützter eigener Zugang zu LuMa Geräten, Live-Telemetrie, Services und Infrastruktur.
                  </p>
                </div>
                <span className="mt-1 text-xl text-cyan-300/50 transition group-hover:translate-x-1">→</span>
              </div>
              <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/60">Secure Private Access</p>
            </a>
          </div>
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
