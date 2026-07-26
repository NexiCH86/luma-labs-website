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
      <Stats />
      <Solutions />
      <Projects />
      <Technology />
      <Roadmap />
      <Footer />
    </main>
  );
}
