import { LumaSignet } from "./LumaSignet";

/*
 * Horizontales Logo nach brand/luma-labs/master/
 * LuMaLabs_MASTER_Horizontal_Transparent_WhiteText.svg:
 * Cyan-Signet + Wortmarke in Inter Light.
 */
export function Logo({ gradientId }: { gradientId?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <LumaSignet className="h-10 w-10 shrink-0" gradientId={gradientId} />

      <div className="whitespace-nowrap leading-none">
        <div className="text-[22px] font-light tracking-[-0.02em] text-[#F4F6F8]">
          LuMa Labs
        </div>
        <div className="mt-1.5 text-[9px] uppercase tracking-[0.26em] text-[#9DA8AE]">
          Engineering tomorrow
        </div>
      </div>
    </div>
  );
}
