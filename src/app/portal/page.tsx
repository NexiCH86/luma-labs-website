import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    ShieldCheck,
    Presentation,
    ExternalLink,
    FileText,
    Images,
} from "lucide-react";

const presentations = [
    {
        id: 1,
        title: "Präsentation 1",
    },
    {
        id: 2,
        title: "Präsentation 2",
    },
    {
        id: 3,
        title: "Präsentation 3",
    },
    {
        id: 4,
        title: "Präsentation 4",
    },
];

export default async function PortalPage() {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        redirect("/portal/login");
    }

    return (
        <main className="min-h-screen bg-[#071315] px-6 py-16 text-white">
            <div className="mx-auto max-w-6xl">
                {/* HEADER */}
                <header className="mb-14 flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                    <div>
                        <p className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-cyan-300/70">
                            Private Portal
                        </p>

                        <h1 className="text-4xl font-semibold tracking-tight">
                            LuMa Labs.
                        </h1>

                        <p className="mt-4 max-w-xl text-sm leading-6 text-white/50">
                            Geschützter Bereich für Präsentationen, Projekte und interne
                            Dokumente.
                        </p>
                    </div>

                    <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs text-emerald-300">
                        <ShieldCheck className="h-4 w-4" />
                        Secure Access
                    </div>
                </header>

                {/* DIGITAL STRATEGY */}
                <section>
                    <div className="mb-7">
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                            BOG Bogenschütz AG
                        </p>

                        <h2 className="mt-3 text-2xl font-medium">
                            BOG Digital Strategy 2026–2036
                        </h2>

                        <p className="mt-2 text-sm text-white/40">
                            Präsentationsmaterial · Version 1
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {presentations.map((presentation) => (
                            <a
                                key={presentation.id}
                                href={`/api/presentation/${presentation.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.05]"
                            >
                                <div className="aspect-[16/9] overflow-hidden bg-black/20">
                                    <img
                                        src={`/api/presentation/${presentation.id}`}
                                        alt={presentation.title}
                                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5">
                                            <Presentation className="h-4 w-4 text-cyan-300" />
                                        </div>

                                        <div>
                                            <h3 className="font-medium">
                                                {presentation.title}
                                            </h3>

                                            <p className="mt-1 text-xs text-white/35">
                                                Präsentationsgrafik
                                            </p>
                                        </div>
                                    </div>

                                    <ExternalLink className="h-4 w-4 text-white/30 transition group-hover:text-cyan-300" />
                                </div>
                            </a>
                        ))}
                    </div>
                </section>

                {/* BENCHMARK & TESTS */}
                <section className="mt-16">
                    <div className="mb-7">
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                            Interne Dokumentation
                        </p>

                        <h2 className="mt-3 text-2xl font-medium">
                            Benchmark & Tests
                        </h2>

                        <p className="mt-2 text-sm text-white/40">
                            Technische Vergleiche, Messungen und interne
                            Entscheidungsgrundlagen.
                        </p>
                    </div>

                    <a
                        href="/portal/benchmark"
                        className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.05]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5">
                                <FileText className="h-5 w-5 text-cyan-300" />
                            </div>

                            <div>
                                <h3 className="font-medium">
                                    PDF-Software Vergleich 2026
                                </h3>

                                <p className="mt-1 text-sm text-white/40">
                                    Benchmark von PDF-XChange und Tungsten Power PDF für
                                    grosse CAD-Pläne
                                </p>
                            </div>
                        </div>

                        <ExternalLink className="h-4 w-4 text-white/30 transition group-hover:text-cyan-300" />
                    </a>
                </section>

                {/* BILDER */}
                <section className="mt-16">
                    <div className="mb-7">
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                            Medien
                        </p>

                        <h2 className="mt-3 text-2xl font-medium">
                            Bilder
                        </h2>

                        <p className="mt-2 text-sm text-white/40">
                            Interner Bildbereich für Website, Projekte,
                            Präsentationen und weitere Medien.
                        </p>
                    </div>

                    <a
                        href="/portal/bilder"
                        className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.05]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5">
                                <Images className="h-5 w-5 text-cyan-300" />
                            </div>

                            <div>
                                <h3 className="font-medium">
                                    Bilder
                                </h3>

                                <p className="mt-1 text-sm text-white/40">
                                    Bilder verwalten, anzeigen und hochladen
                                </p>
                            </div>
                        </div>

                        <ExternalLink className="h-4 w-4 text-white/30 transition group-hover:text-cyan-300" />
                    </a>
                </section>

                {/* FOOTER */}
                <footer className="mt-16 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-white/30">
                    <span>LuMa Labs. Private Portal</span>

                    <form action="/api/portal-logout" method="POST">
                        <button
                            type="submit"
                            className="transition hover:text-white"
                        >
                            Abmelden
                        </button>
                    </form>
                </footer>
            </div>
        </main>
    );
}
