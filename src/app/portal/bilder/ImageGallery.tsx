"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";

type ImageFile = {
    pathname: string;
    name: string;
    folder: string;
    size: number;
    uploadedAt: string;
};

export default function ImageGallery() {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadImages() {
            try {
                const response = await fetch("/api/bilder/list", {
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error("Bilder konnten nicht geladen werden.");
                }

                const data = await response.json();
                setImages(data.images ?? []);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        loadImages();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-white/40">
                <Loader2 className="h-4 w-4 animate-spin" />
                Bilder werden geladen …
            </div>
        );
    }

    if (images.length === 0) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-white/40">
                Noch keine Bilder vorhanden.
            </div>
        );
    }

    const grouped = images.reduce<Record<string, ImageFile[]>>(
        (groups, image) => {
            groups[image.folder] ??= [];
            groups[image.folder].push(image);
            return groups;
        },
        {}
    );

    return (
        <div className="space-y-12">
            {Object.entries(grouped).map(([folder, folderImages]) => (
                <section key={folder}>
                    <div className="mb-5">
                        <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/35">
                            Ordner
                        </p>

                        <h2 className="mt-2 text-xl font-medium">
                            {folder}
                        </h2>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {folderImages.map((image) => {
                            const src = `/api/bilder/file?path=${encodeURIComponent(
                                image.pathname
                            )}`;

                            return (
                                <a
                                    key={image.pathname}
                                    href={src}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-1 hover:border-cyan-300/30"
                                >
                                    <div className="aspect-[4/3] overflow-hidden bg-black/20">
                                        <img
                                            src={src}
                                            alt={image.name}
                                            loading="lazy"
                                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 p-4">
                                        <ImageIcon className="h-4 w-4 shrink-0 text-cyan-300" />

                                        <p className="truncate text-sm text-white/70">
                                            {image.name}
                                        </p>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}