import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    ArrowLeft,
    ShieldCheck,
} from "lucide-react";
import ImageUploadControls from "./ImageUploadControls";
import ImageGallery from "./ImageGallery";

export default async function BilderPage() {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        redirect("/portal/login");
    }

    return (
        <main className="min-h-screen bg-[#071315] px-6 py-16 text-white">
            <div className="mx-auto max-w-6xl">

                {/* HEADER */}
                <header className="mb-14">
                    <a
                        href="/portal"
                        className="mb-8 inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-cyan-300"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Zurück zum Portal
                    </a>

                    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                        <div>
                            <p className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-cyan-300/70">
                                Medienarchiv
                            </p>

                            <h1 className="text-4xl font-semibold tracking-tight">
                                Bilder
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">
                                Geschützter Bereich zur Verwaltung interner Bilder
                                und Medien für LuMa Labs.
                            </p>
                        </div>

                        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs text-emerald-300">
                            <ShieldCheck className="h-4 w-4" />
                            Private Images
                        </div>
                    </div>
                </header>

                {/* UPLOAD */}
                <section className="mb-14">
                    <div className="mb-6">
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                            Upload
                        </p>

                        <h2 className="mt-3 text-2xl font-medium">
                            Bilder hinzufügen
                        </h2>

                        <p className="mt-2 text-sm text-white/40">
                            Einzelne Bilder, mehrere Dateien oder komplette Ordner
                            in das private Medienarchiv hochladen.
                        </p>
                    </div>

                    <ImageUploadControls />
                </section>

                {/* GALERIE */}
                <section>
                    <div className="mb-7">
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                            Galerie
                        </p>

                        <h2 className="mt-3 text-2xl font-medium">
                            Hochgeladene Bilder
                        </h2>

                        <p className="mt-2 text-sm text-white/40">
                            Bilder aus dem privaten LuMa Labs Medienarchiv.
                        </p>
                    </div>

                    <ImageGallery />
                </section>

                {/* FOOTER */}
                <footer className="mt-16 border-t border-white/10 pt-6 text-xs text-white/30">
                    LuMa Labs. · Internal Image Archive
                </footer>

            </div>
        </main>
    );
}