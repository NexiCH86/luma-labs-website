import Link from "next/link";
import { Radar } from "lucide-react";
import { LumaSignet } from "@/components/brand/LumaSignet";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#061019] px-6 text-white">
      <div className="max-w-lg text-center">
        <LumaSignet className="mx-auto h-16 w-16" gradientId="lumaSignetNotFound" />
        <p className="mt-8 text-xs font-medium uppercase tracking-[0.3em] text-[#00D7E6]">
          Fehler 404
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Diese Seite gibt es nicht.
        </h1>
        <p className="mt-5 leading-7 text-slate-400">
          Vielleicht wurde sie verschoben oder der Link ist nicht mehr aktuell.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-md border border-[#00AFC2]/55 bg-gradient-to-r from-[#008A99] to-[#00AFC2] px-5 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-white"
          >
            Zur Startseite
          </Link>
          <Link
            href="/radar"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#00D7E6]/35 bg-[#00D7E6]/[0.05] px-5 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#55ECE9]"
          >
            <Radar className="h-4 w-4" /> LuMa RADAR
          </Link>
        </div>
      </div>
    </main>
  );
}
