import { Logo } from "@/components/brand/Logo";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050D14]">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-8 px-6 py-12 sm:flex-row sm:items-end sm:justify-between lg:px-10">
        <div>
          <Logo />
          <p className="mt-5 text-sm text-slate-500">
            Software · BIM · AI · Smart Infrastructure · Engineering
          </p>
        </div>
        <p className="text-sm text-slate-500">
          © 2026 LuMa Labs. Building tools that last.
        </p>
      </div>
    </footer>
  );
}
