import { ImageResponse } from "next/og";
import { BRAND_COLORS, SIGNET_POLYGONS, SIGNET_VIEWBOX } from "@/components/brand/LumaSignet";

/*
 * Vorschaubild fuer geteilte Links (WhatsApp, Discord, LinkedIn …).
 */
export const alt = "LuMa Labs – Engineering tomorrow.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 96px",
          gap: 64,
          background: `radial-gradient(circle at 78% 30%, rgba(0,215,230,0.18), transparent 45%), ${BRAND_COLORS.graphite}`,
          color: BRAND_COLORS.offWhite,
        }}
      >
        <svg width="260" height="248" viewBox={SIGNET_VIEWBOX}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={BRAND_COLORS.cyanDark} />
              <stop offset="55%" stopColor={BRAND_COLORS.cyan} />
              <stop offset="100%" stopColor={BRAND_COLORS.cyanLight} />
            </linearGradient>
          </defs>
          {SIGNET_POLYGONS.map((points) => (
            <polygon key={points} points={points} fill="url(#g)" />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, fontWeight: 300, letterSpacing: -3 }}>LuMa Labs</div>
          <div style={{ marginTop: 18, fontSize: 44, color: BRAND_COLORS.cyan }}>Engineering tomorrow.</div>
          <div style={{ marginTop: 28, fontSize: 28, color: "#9DA8AE" }}>
            Software · BIM · Smart Infrastructure · LuMa RADAR
          </div>
        </div>
      </div>
    ),
    size
  );
}
