import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

const benchmarkFiles: Record<
    string,
    {
        fileName: string;
        contentType: string;
        downloadName: string;
    }
> = {
    // Abschlussbericht
    "report-pdf": {
        fileName:
            "benchmark/Abschlussbericht/PDF_Evaluation_Engineering_2026_Bogenschuetz_AG_Privatzeit.pdf",
        contentType: "application/pdf",
        downloadName:
            "PDF_Evaluation_Engineering_2026_Bogenschuetz_AG_Privatzeit.pdf",
    },
    "report-docx": {
        fileName:
            "benchmark/Abschlussbericht/PDF_Evaluation_Engineering_2026_Bogenschuetz_AG_Privatzeit.docx",
        contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        downloadName:
            "PDF_Evaluation_Engineering_2026_Bogenschuetz_AG_Privatzeit.docx",
    },

    // PowerShell-Skripte
    "script-start": {
        fileName: "benchmark/benchmark-start.ps1",
        contentType: "text/plain; charset=utf-8",
        downloadName: "benchmark-start.ps1",
    },
    "script-pdf": {
        fileName: "benchmark/benchmark-pdf.ps1",
        contentType: "text/plain; charset=utf-8",
        downloadName: "benchmark-pdf.ps1",
    },
    "script-office": {
        fileName: "benchmark/benchmark-office-runner.ps1",
        contentType: "text/plain; charset=utf-8",
        downloadName: "benchmark-office-runner.ps1",
    },

    // Results
    "result-office": {
        fileName: "benchmark/Results/office-benchmark-results.csv",
        contentType: "text/csv; charset=utf-8",
        downloadName: "office-benchmark-results.csv",
    },
    "result-load": {
        fileName: "benchmark/Results/pdf-load-results.csv",
        contentType: "text/csv; charset=utf-8",
        downloadName: "pdf-load-results.csv",
    },
    "result-render": {
        fileName: "benchmark/Results/pdf-render-results.csv",
        contentType: "text/csv; charset=utf-8",
        downloadName: "pdf-render-results.csv",
    },
    "result-startup-v11": {
        fileName: "benchmark/Results/startup-results-v11.csv",
        contentType: "text/csv; charset=utf-8",
        downloadName: "startup-results-v11.csv",
    },
    "result-startup": {
        fileName: "benchmark/Results/startup-results.csv",
        contentType: "text/csv; charset=utf-8",
        downloadName: "startup-results.csv",
    },
    "result-system": {
        fileName: "benchmark/Results/system-info.txt",
        contentType: "text/plain; charset=utf-8",
        downloadName: "system-info.txt",
    },

    // Testfiles
    "test-a": {
        fileName: "benchmark/Testfiles/PDF-A-Office.pdf",
        contentType: "application/pdf",
        downloadName: "PDF-A-Office.pdf",
    },
    "test-b": {
        fileName: "benchmark/Testfiles/PDF-B-Office_klein.pdf",
        contentType: "application/pdf",
        downloadName: "PDF-B-Office_klein.pdf",
    },
    "test-c": {
        fileName: "benchmark/Testfiles/PDF-C-Feldgeräte-farbig.pdf",
        contentType: "application/pdf",
        downloadName: "PDF-C-Feldgeräte-farbig.pdf",
    },
    "test-d": {
        fileName: "benchmark/Testfiles/PDF-D-CAD-Plan.pdf",
        contentType: "application/pdf",
        downloadName: "PDF-D-CAD-Plan.pdf",
    },
};

export async function GET(
    request: Request,
    context: {
        params: Promise<{ id: string }>;
    }
) {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        return NextResponse.json(
            { error: "Nicht autorisiert." },
            { status: 401 }
        );
    }

    const { id } = await context.params;
    const file = benchmarkFiles[id];

    if (!file) {
        return NextResponse.json(
            { error: "Benchmark-Datei nicht gefunden." },
            { status: 404 }
        );
    }

    try {
        const result = await get(file.fileName, {
            access: "private",
        });

        if (!result || result.statusCode !== 200) {
            return NextResponse.json(
                { error: "Benchmark-Datei nicht gefunden." },
                { status: 404 }
            );
        }

        const url = new URL(request.url);
        const download = url.searchParams.get("download") === "1";

        return new Response(result.stream, {
            headers: {
                "Content-Type":
                    result.blob.contentType ?? file.contentType,
                "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.downloadName)}`,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Datei konnte nicht geladen werden." },
            { status: 500 }
        );
    }
}
