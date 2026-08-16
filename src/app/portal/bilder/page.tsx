import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    ArrowLeft,
    Folder,
    ShieldCheck,
} from "lucide-react";
import ImageUploadControls from "./ImageUploadControls";

const folders = [
    {
        name: "Büro Home",
        description: "Bilder für den Bereich Büro Home",
    },
];

export default async function BilderPage() {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        redirect("/portal/login");
    }

    return (
        <main className="min-h-screen bg-[#071315] px-6 py-16 text-white">
            <div className="mx-auto max-w-6xl">
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

                <section className="mb-12">
                    <ImageUploadControls />
                </section>

                <section>
                    <div className="mb-7">
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                            Hauptordner
                        </p>

                        <h2 className="mt-3 text-2xl font-medium">
                            Bilder
                        </h2>

                        <p className="mt-2 text-sm text-white/40">
                            Unterordner und Bildsammlungen
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {folders.map((folder) => (
                            <div
                                key={folder.name}
                                className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.05]"
                            >
                                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5">
                                    <Folder className="h-5 w-5 text-cyan-300" />
                                </div>

                                <h3 className="font-medium">
                                    {folder.name}
                                </h3>

                                <p className="mt-2 text-sm leading-6 text-white/35">
                                    {folder.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <footer className="mt-16 border-t border-white/10 pt-6 text-xs text-white/30">
                    LuMa Labs. · Internal Image Archive
                </footer>
            </div>
        </main>
    );
}