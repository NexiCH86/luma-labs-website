import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Die OpenSky-Flugzeugdaten werden beim Build erzeugt
   * (npm run radar:sync-opensky) und zur Laufzeit von der
   * Airframe-Route gelesen.
   */
  outputFileTracingIncludes: {
    "/api/radar/airframe": ["./public/data/opensky-aircraft/*.json.gz"],
  },

  /*
   * Die fruehere oeffentliche BOG-Fusion-Vorschau zeigte echte
   * Projektnamen ohne Login (NEX-126). BOG Fusion laeuft eigenstaendig.
   */
  async redirects() {
    return [
      { source: "/fusion", destination: "https://bog-fusion.vercel.app", permanent: false },
      { source: "/fusion/:path*", destination: "https://bog-fusion.vercel.app", permanent: false },
    ];
  },
};

export default nextConfig;
