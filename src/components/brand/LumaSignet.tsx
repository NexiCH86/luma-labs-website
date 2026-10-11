/*
 * LM-Monogramm aus dem verbindlichen Master
 * brand/luma-labs/master/LuMaLabs_MASTER_Signet_Gradient.svg (Cyan/Petrol).
 */
export const SIGNET_VIEWBOX = "120 140 780 745";

export const SIGNET_POLYGONS = [
  "138.250,154.500 229.250,242.250 229.250,785.000 473.000,785.000 554.250,869.500 138.250,869.500",
  "333.250,356.000 557.500,573.750 794.750,278.000 882.500,278.000 882.500,869.500 794.750,869.500 794.750,434.000 564.000,668.000 333.250,450.250",
];

export const BRAND_COLORS = {
  cyanDark: "#00AFC2",
  cyan: "#00D7E6",
  cyanLight: "#00F0FF",
  graphite: "#071117",
  offWhite: "#F4F6F8",
};

export function LumaSignet({
  className,
  gradientId = "lumaSignetCyan",
}: {
  className?: string;
  gradientId?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={SIGNET_VIEWBOX}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BRAND_COLORS.cyanDark} />
          <stop offset="55%" stopColor={BRAND_COLORS.cyan} />
          <stop offset="100%" stopColor={BRAND_COLORS.cyanLight} />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradientId})`}>
        {SIGNET_POLYGONS.map((points) => (
          <polygon key={points} points={points} />
        ))}
      </g>
    </svg>
  );
}
