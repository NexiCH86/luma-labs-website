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
};

export default nextConfig;
