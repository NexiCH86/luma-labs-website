import { ImageResponse } from "next/og";
import { BRAND_COLORS, SIGNET_POLYGONS, SIGNET_VIEWBOX } from "@/components/brand/LumaSignet";

/*
 * Homescreen-Symbol fuer iPhone/iPad (PNG, beim Build erzeugt).
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_COLORS.graphite,
        }}
      >
        <svg width="124" height="118" viewBox={SIGNET_VIEWBOX}>
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
      </div>
    ),
    size
  );
}
