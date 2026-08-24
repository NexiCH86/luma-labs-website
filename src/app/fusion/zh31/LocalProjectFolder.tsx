"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FolderOpen, HardDrive, RefreshCw, TriangleAlert } from "lucide-react";

type DetectedFile = {
  name: string;
  relativePath: string;
  extension: string;
  discipline: "ARCH" | "HEI" | "LUE" | "SAN" | "KOORD" | "OTHER";
  kind: "IFC" | "2D" | "REVIT" | "OTHER";
  size: number;
};

type DirectoryEntryHandle = {
  kind: "file" | "directory";
  name: string;
};

type FileHandle = DirectoryEntryHandle & {
  kind: "file";
  getFile: () => Promise<File>;
};

type DirectoryHandle = DirectoryEntryHandle & {
  kind: "directory";
  values: () => AsyncIterableIterator<FileHandle | DirectoryHandle>;
};

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<DirectoryHandle>;
  }
}

function disciplineFor(path: string, name: string): DetectedFile["discipline"] {
  const value = `${path} ${name}`.toLowerCase();
  if (/\barch\b|architektur/.test(value)) return "ARCH";
  if (/\bhei\b|heizung/.test(value)) return "HEI";
  if (/\blue\b|lüftung|lueftung/.test(value)) return "LUE";
  if (/\bsan\b|sanitär|sanitaer/.test(value)) return "SAN";
  if (/koord|koordination|coord/.test(value)) return "KOORD";
  return "OTHER";
}

function kindFor(extension: string): DetectedFile["kind"] {
  if (extension === "ifc") return "IFC";
  if (["pdf", "dwg", "dxf"].includes(extension)) return "2D";
  if (["rvt", "rfa"].includes(extension)) return "REVIT";
  return "OTHER";
}

async function scanDirectory(handle: DirectoryHandle, basePath = ""): Promise<DetectedFile[]> {
  const result: DetectedFile[] = [];
  for await (const entry of handle.values()) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      result.push(...(await scanDirectory(entry, relativePath)));
      continue;
    }

    const file = await entry.getFile();
    const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    const kind = kindFor(extension);
    if (kind === "OTHER") continue;

    result.push({
      name: file.name,
      relativePath,
      extension,
      discipline: disciplineFor(basePath, file.name),
      kind,
      size: file.size,
    });
  }
  return result;
}

function bytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function LocalProjectFolder() {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  const ifcs = useMemo(() => files.filter((file) => file.kind === "IFC"), [files]);
  const plans = useMemo(() => files.filter((file) => file.kind === "2D"), [files]);
  const revit = useMemo(() => files.filter((file) => file.kind === "REVIT"), [files]);

  async function connectFolder() {
    if (!window.showDirectoryPicker) {
      setError("Dieser Browser unterstützt die lokale Ordnerauswahl nicht. Bitte Chrome oder Edge verwenden.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const handle = await window.showDirectoryPicker();
      const detected = await scanDirectory(handle);
      setFolderName(handle.name);
      setFiles(detected);
      localStorage.setItem("bog-fusion-zh31-last-folder", handle.name);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name !== "AbortError") setError("Der Projektordner konnte nicht gelesen werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-semibold"><HardDrive className="h-5 w-5 text-[#0097c3]"/>Lokaler Projektordner</div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">BOG Fusion liest IFC-, PDF-, DWG/DXF- und Revit-Dateien direkt aus einem von dir freigegebenen lokalen Ordner. Die Dateien werden bei diesem Schritt nicht auf LuMa Labs hochgeladen.</p>
          </div>
          <button onClick={connectFolder} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-[#0097c3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#007fa5] disabled:opacity-60">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin"/> : <FolderOpen className="h-4 w-4"/>}
            {loading ? "Ordner wird gelesen…" : folderName ? "Ordner neu wählen" : "Projektordner verbinden"}
          </button>
        </div>

        {!supported && <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0"/>Für lokale Ordner bitte Chrome oder Edge auf einem Desktop-PC verwenden.</div>}
        {error && <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}

        {folderName && (
          <div className="mt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Verbunden: {folderName}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-semibold text-[#0097c3]">{ifcs.length}</div><div className="text-xs text-slate-500">IFC-Dateien erkannt</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-semibold text-[#0097c3]">{plans.length}</div><div className="text-xs text-slate-500">2D-Pläne erkannt</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-semibold text-[#0097c3]">{revit.length}</div><div className="text-xs text-slate-500">Revit-Dateien erkannt</div></div>
            </div>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b px-5 py-4"><h3 className="font-semibold">Erkannte Projektdateien</h3><p className="mt-1 text-xs text-slate-500">Automatische Zuordnung nach Dateiname und Ordnerpfad. Später kann jede Zuordnung manuell überschrieben werden.</p></div>
          <div className="max-h-[420px] divide-y overflow-auto">
            {files.map((file) => (
              <div key={file.relativePath} className="grid gap-2 px-5 py-3 sm:grid-cols-[90px_85px_1fr_auto] sm:items-center">
                <span className="w-fit rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-700">{file.discipline}</span>
                <span className="text-xs font-semibold text-slate-600">{file.kind}</span>
                <div className="min-w-0"><div className="truncate text-sm font-medium">{file.name}</div><div className="truncate text-[11px] text-slate-400">{file.relativePath}</div></div>
                <span className="text-xs text-slate-400">{bytes(file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
