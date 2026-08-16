import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    ArrowLeft,
    FileText,
    FileSpreadsheet,
    FileCode2,
    Download,
    ExternalLink,
    ShieldCheck,
    MonitorCog,
} from "lucide-react";

const reports = [
    {
        id: "report-pdf",
        title: "Abschlussbericht PDF",
        description: "Finale Auswertung für GL und IT",
        type: "PDF",
    },
    {
        id: "report-docx",
        title: "Abschlussbericht Word",
        description: "Bearbeitbare Originalfassung",
        type: "DOCX",
    },
];

const results = [
    {
        id: "result-office",
        title: "office-benchmark-results.csv",
        description: "Benchmark-Ergebnisse der Office-Tests",
    },
    {
        id: "result-load",
        title: "pdf-load-results.csv",
        description: "Messwerte zum Laden der PDF-Dateien",
    },
    {
        id: "result-render",
        title: "pdf-render-results.csv",
        description: "Messwerte zum Rendering der PDF-Dateien",
    },
    {
        id: "result-startup-v11",
        title: "startup-results-v11.csv",
        description: "Startzeitmessungen – Version 11",
    },
    {
        id: "result-startup",
        title: "startup-results.csv",
        description: "Startzeitmessungen",
    },
    {
        id: "result-system",
        title: "system-info.txt",
        description: "Systeminformationen des Benchmark-Rechners",
    },
];

const testfiles = [
    {
        id: "test-a",
        title: "PDF-A-Office.pdf",
        description: "Office-basierte PDF-Testdatei",
    },
    {
        id: "test-b",
        title: "PDF-B-Office_klein.pdf",
        description: "Kleinere Office-basierte PDF-Testdatei",
    },
    {
        id: "test-c",
        title: "PDF-C-Feldgeräte-farbig.pdf",
        description: "Farbige technische PDF-Testdatei",
    },
    {
        id: "test-d",
        title: "PDF-D-CAD-Plan.pdf",
        description: "Grosser CAD-Plan als Haupttestdatei",
    },
];

const scripts = [
    {
        id: "script-start",
        title: "benchmark-start.ps1",
        description: "Start- und Steuerungsskript des Benchmarks",
    },
    {
        id: "script-pdf",
        title: "benchmark-pdf.ps1",
        description: "PowerShell-Skript für PDF-Messungen",
    },
    {
        id: "script-office",
        title: "benchmark-office-runner.ps1",
        description: "PowerShell-Skript für Office-basierte Tests",
    },
];

export default async function BenchmarkPage() {
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
                                Engineering Benchmark
                            </p>

                            <h1 className="text-4xl font-semibold tracking-tight">
                                PDF-Software Vergleich 2026
                            </h1>

                            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/50">
                                Technischer Vergleich von PDF-XChange Editor und
                                Tungsten Power PDF unter realen Bedingungen mit
                                grossen CAD-Plänen und Engineering-Dokumenten.
                            </p>
                        </div>

                        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs text-emerald-300">
                            <ShieldCheck className="h-4 w-4" />
                            Private Benchmark
                        </div>
                    </div>
                </header>

                <section className="mb-16">
                    <div className="mb-7 flex items-center gap-3">
                        <FileText className="h-5 w-5 text-cyan-300" />

                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                                Management Summary
                            </p>

                            <h2 className="mt-1 text-2xl font-medium">
                                Abschlussbericht
                            </h2>
                        </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        {reports.map((file) => (
                            <div
                                key={file.id}
                                className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-6"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-medium">
                                            {file.title}
                                        </h3>

                                        <p className="mt-2 text-sm text-white/40">
                                            {file.description}
                                        </p>

                                        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-cyan-300/60">
                                            {file.type}
                                        </p>
                                    </div>

                                    <FileText className="h-5 w-5 text-cyan-300" />
                                </div>

                                <div className="mt-6 flex flex-wrap gap-3">
                                    <a
                                        href={`/api/benchmark/${file.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Öffnen
                                    </a>

                                    <a
                                        href={`/api/benchmark/${file.id}?download=1`}
                                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-cyan-300/30 hover:text-white"
                                    >
                                        <Download className="h-4 w-4" />
                                        Download
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mb-16">
                    <div className="mb-7 flex items-center gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-cyan-300" />

                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                                Rohdaten
                            </p>

                            <h2 className="mt-1 text-2xl font-medium">
                                Results
                            </h2>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {results.map((file) => (
                            <a
                                key={file.id}
                                href={`/api/benchmark/${file.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.05]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5">
                                        <FileSpreadsheet className="h-5 w-5 text-cyan-300" />
                                    </div>

                                    <div>
                                        <h3 className="font-medium">
                                            {file.title}
                                        </h3>

                                        <p className="mt-1 text-xs text-white/35">
                                            {file.description}
                                        </p>
                                    </div>
                                </div>

                                <ExternalLink className="h-4 w-4 text-white/30 transition group-hover:text-cyan-300" />
                            </a>
                        ))}
                    </div>
                </section>

                <section className="mb-16">
                    <div className="mb-7 flex items-center gap-3">
                        <MonitorCog className="h-5 w-5 text-cyan-300" />

                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                                Testgrundlagen
                            </p>

                            <h2 className="mt-1 text-2xl font-medium">
                                Testfiles
                            </h2>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {testfiles.map((file) => (
                            <a
                                key={file.id}
                                href={`/api/benchmark/${file.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.05]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5">
                                        <FileText className="h-5 w-5 text-cyan-300" />
                                    </div>

                                    <div>
                                        <h3 className="font-medium">
                                            {file.title}
                                        </h3>

                                        <p className="mt-1 text-xs text-white/35">
                                            {file.description}
                                        </p>
                                    </div>
                                </div>

                                <ExternalLink className="h-4 w-4 text-white/30 transition group-hover:text-cyan-300" />
                            </a>
                        ))}
                    </div>
                </section>

                <section>
                    <div className="mb-7 flex items-center gap-3">
                        <FileCode2 className="h-5 w-5 text-cyan-300" />

                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
                                Reproduzierbarkeit
                            </p>

                            <h2 className="mt-1 text-2xl font-medium">
                                Benchmark-Skripte
                            </h2>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {scripts.map((file) => (
                            <div
                                key={file.id}
                                className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/5">
                                        <FileCode2 className="h-5 w-5 text-cyan-300" />
                                    </div>

                                    <div>
                                        <h3 className="font-medium">
                                            {file.title}
                                        </h3>

                                        <p className="mt-1 text-xs text-white/35">
                                            {file.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <a
                                        href={`/api/benchmark/${file.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-cyan-300"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Anzeigen
                                    </a>

                                    <a
                                        href={`/api/benchmark/${file.id}?download=1`}
                                        className="inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-cyan-300"
                                    >
                                        <Download className="h-4 w-4" />
                                        Download
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <footer className="mt-16 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-white/30">
                    <span>LuMa Labs. · Internal Benchmark Archive</span>
                    <span>PDF Software Evaluation 2026</span>
                </footer>

            </div>
        </main>
    );
}