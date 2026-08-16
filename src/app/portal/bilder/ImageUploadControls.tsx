"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
    Upload,
    FolderUp,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";

type UploadStatus = {
    total: number;
    completed: number;
    failed: number;
    active: boolean;
};

export default function ImageUploadControls() {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const [status, setStatus] = useState<UploadStatus>({
        total: 0,
        completed: 0,
        failed: 0,
        active: false,
    });

    async function uploadFiles(
        files: File[],
        preserveFolders: boolean
    ) {
        if (files.length === 0) {
            return;
        }

        setStatus({
            total: files.length,
            completed: 0,
            failed: 0,
            active: true,
        });

        let completed = 0;
        let failed = 0;

        for (const file of files) {
            try {
                let relativePath = file.name;

                if (preserveFolders) {
                    const browserFile = file as File & {
                        webkitRelativePath?: string;
                    };

                    if (browserFile.webkitRelativePath) {
                        relativePath = browserFile.webkitRelativePath;
                    }
                }

                const cleanPath = relativePath
                    .replaceAll("\\", "/")
                    .replace(/^\/+/, "");

                const pathname = `bilder/${cleanPath}`;

                await upload(pathname, file, {
                    access: "private",
                    handleUploadUrl: "/api/bilder/upload",
                });

                completed++;

                setStatus((current) => ({
                    ...current,
                    completed,
                }));
            } catch (error) {
                console.error("Upload fehlgeschlagen:", file.name, error);

                failed++;

                setStatus((current) => ({
                    ...current,
                    failed,
                }));
            }
        }

        setStatus({
            total: files.length,
            completed,
            failed,
            active: false,
        });
    }

    async function handleImageSelection(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const files = Array.from(event.target.files ?? []);

        await uploadFiles(files, false);

        event.target.value = "";
    }

    async function handleFolderSelection(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const files = Array.from(event.target.files ?? []);

        await uploadFiles(files, true);

        event.target.value = "";
    }

    return (
        <div>
            <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
                multiple
                className="hidden"
                onChange={handleImageSelection}
            />

            <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFolderSelection}
                {...({
                    webkitdirectory: "",
                    directory: "",
                } as React.InputHTMLAttributes<HTMLInputElement>)}
            />

            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    disabled={status.active}
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-4 py-3 text-sm text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Upload className="h-4 w-4" />
                    Bilder hochladen
                </button>

                <button
                    type="button"
                    disabled={status.active}
                    onClick={() => folderInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 transition hover:border-cyan-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <FolderUp className="h-4 w-4" />
                    Ordner hochladen
                </button>
            </div>

            {(status.active ||
                status.completed > 0 ||
                status.failed > 0) && (
                    <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                            {status.active ? (
                                <span className="text-cyan-200">
                                    Upload läuft …
                                </span>
                            ) : status.failed === 0 ? (
                                <span className="flex items-center gap-2 text-emerald-300">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Upload abgeschlossen
                                </span>
                            ) : (
                                <span className="flex items-center gap-2 text-amber-300">
                                    <AlertCircle className="h-4 w-4" />
                                    Upload mit Fehlern beendet
                                </span>
                            )}

                            <span className="text-white/45">
                                {status.completed} / {status.total} hochgeladen
                            </span>

                            {status.failed > 0 && (
                                <span className="text-red-300/80">
                                    {status.failed} fehlgeschlagen
                                </span>
                            )}
                        </div>

                        {status.total > 0 && (
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full bg-cyan-300 transition-all"
                                    style={{
                                        width: `${(status.completed /
                                                status.total) *
                                            100
                                            }%`,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
        </div>
    );
}