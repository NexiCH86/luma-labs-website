import Link from "next/link";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { LumaSignet } from "@/components/brand/LumaSignet";

type LoginPageProps = {
    searchParams: Promise<{ error?: string }>;
};

export default async function ControlCenterLoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const errorText =
        params.error === "locked"
            ? "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen."
            : params.error === "1"
              ? "Benutzername oder Passwort ist nicht korrekt."
              : null;

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#061113] px-6 text-white">
            <div className="w-full max-w-md">
                <div className="mb-10 text-center">
                    <div className="mb-6 flex justify-center">
                        <LumaSignet className="h-14 w-14" gradientId="lumaSignetCcLogin" />
                    </div>
                    <p className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.35em] text-cyan-300/70"><ShieldCheck className="h-3.5 w-3.5" /> Secure Operations</p>
                    <h1 className="text-4xl font-semibold tracking-tight">LuMa Control Center</h1>
                    <p className="mt-4 text-sm leading-6 text-white/45">Eigener geschützter Zugang zur LuMa Infrastruktur, System-Telemetrie und Operations-Übersicht.</p>
                </div>

                <form action="/api/control-center-login" method="POST" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur">
                    <label htmlFor="username" className="mb-2 block text-sm font-medium text-white/70">Benutzername</label>
                    <div className="relative">
                        <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                        <input id="username" name="username" type="text" required autoFocus autoComplete="username" placeholder="Benutzername" className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/50" />
                    </div>

                    <label htmlFor="password" className="mb-2 mt-5 block text-sm font-medium text-white/70">Passwort</label>
                    <div className="relative">
                        <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                        <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••••••" className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/50" />
                    </div>

                    {errorText && <p className="mt-3 text-sm text-red-400">{errorText}</p>}

                    <button type="submit" className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-[#061113] transition hover:bg-cyan-200">Control Center öffnen</button>
                </form>

                <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/30">
                    <Link href="/" className="transition hover:text-cyan-200">Startseite</Link>
                    <span>·</span>
                    <Link href="/radar" className="transition hover:text-cyan-200">RADAR</Link>
                </div>
            </div>
        </main>
    );
}
