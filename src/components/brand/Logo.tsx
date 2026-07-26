export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg
        aria-hidden="true"
        viewBox="0 0 72 72"
        className="h-11 w-11 shrink-0"
        fill="none"
      >
        <defs>
          <linearGradient id="lumaMetal" x1="10" y1="12" x2="63" y2="62">
            <stop stopColor="#F8FAFC" />
            <stop offset="0.48" stopColor="#A8B3BD" />
            <stop offset="1" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="lumaTeal" x1="8" y1="60" x2="42" y2="10">
            <stop stopColor="#007D75" />
            <stop offset="1" stopColor="#00D7D5" />
          </linearGradient>
        </defs>
        <path d="M10 9v54h31V52H22V9H10Z" fill="url(#lumaTeal)" />
        <path
          d="M29 25 42 37 61 17v46H50V43L42 51 29 39V25Z"
          fill="url(#lumaMetal)"
        />
      </svg>

      <div className="leading-none">
        <div className="text-xl font-semibold tracking-[-0.03em] text-white">
          LuMa <span className="text-[#00A99D]">Labs</span>
        </div>
        <div className="mt-1.5 text-[9px] uppercase tracking-[0.26em] text-slate-500">
          Engineering Platform
        </div>
      </div>
    </div>
  );
}
