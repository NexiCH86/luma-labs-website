"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SatRecord = {
    OBJECT_NAME?: string;
    OBJECT_ID?: string;
    NORAD_CAT_ID?: number;
    group?: string;
    groupLabel?: string;
    category?: string;
};

type ApiResponse = {
    ok?: boolean;
    satellites?: SatRecord[];
};

type WatchItem = {
    norad: number;
    name: string;
    groupLabel: string;
};

type Point = { x: number; y: number };

const GROUP_BY_LABEL: Record<string, string> = {
    Stations: "STATIONS",
    GPS: "GPS-OPS",
    GLONASS: "GLO-OPS",
    Galileo: "GALILEO",
    BeiDou: "BEIDOU",
    Starlink: "STARLINK",
    Weather: "WEATHER",
    Earth: "RESOURCE",
};

const WATCH_KEY = "luma-radar-sat-watchlist";
const PANEL_KEY = "luma-radar-sat-tracked-panel-position";

function activeGroupLabels() {
    return Array.from(document.querySelectorAll<HTMLButtonElement>(".sat2-filter.is-on"))
        .map((button) => button.querySelector("b")?.textContent?.trim() ?? "")
        .filter(Boolean);
}

function selectInRadar(item: { norad: number; groupLabel: string }) {
    const groupButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".sat2-filter"))
        .find((button) => button.querySelector("b")?.textContent?.trim() === item.groupLabel);

    const ensureActive = groupButton && !groupButton.classList.contains("is-on");
    if (ensureActive) groupButton.click();

    window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(".radar-search input");
        const searchButton = document.querySelector<HTMLButtonElement>(".radar-search button");
        if (!input || !searchButton) return;

        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
        )?.set;
        setter?.call(input, String(item.norad));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        searchButton.click();
    }, ensureActive ? 900 : 30);
}

function readWatchlist(): WatchItem[] {
    try {
        const raw = localStorage.getItem(WATCH_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as WatchItem[];
        return Array.isArray(parsed) ? parsed.filter((item) => Number.isFinite(item.norad)) : [];
    } catch {
        return [];
    }
}

export default function SatTrackedPanel() {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
    const [records, setRecords] = useState<SatRecord[]>([]);
    const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
    const [tab, setTab] = useState<"tracked" | "watch">("tracked");
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [updatedAt, setUpdatedAt] = useState("");
    const [position, setPosition] = useState<Point | null>(null);

    useEffect(() => {
        setWatchlist(readWatchlist());
        try {
            const stored = localStorage.getItem(PANEL_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Point;
                if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) setPosition(parsed);
            }
        } catch {
            // Ignore stale workspace state.
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        let lastSignature = "";

        async function refresh() {
            const labels = activeGroupLabels();
            const groups = labels.map((label) => GROUP_BY_LABEL[label]).filter(Boolean);
            const signature = groups.sort().join(",");
            if (!signature || signature === lastSignature) return;
            lastSignature = signature;
            setLoading(true);

            try {
                const response = await fetch(
                    `/api/radar/satellites?groups=${encodeURIComponent(signature)}`,
                    { cache: "no-store" }
                );
                const data = (await response.json()) as ApiResponse;
                if (cancelled) return;
                const unique = new Map<number, SatRecord>();
                for (const record of data.satellites ?? []) {
                    if (record.NORAD_CAT_ID != null) unique.set(record.NORAD_CAT_ID, record);
                }
                setRecords(Array.from(unique.values()));
                setUpdatedAt(new Date().toLocaleTimeString("de-CH", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                }));
            } catch {
                if (!cancelled) setRecords([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        refresh();
        const timer = window.setInterval(refresh, 1500);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, []);

    function persistWatchlist(next: WatchItem[]) {
        setWatchlist(next);
        localStorage.setItem(WATCH_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("luma-sat-watchlist-change", { detail: next.length }));
    }

    function toggleWatch(record: SatRecord) {
        const norad = record.NORAD_CAT_ID;
        if (norad == null) return;
        const exists = watchlist.some((item) => item.norad === norad);
        if (exists) {
            persistWatchlist(watchlist.filter((item) => item.norad !== norad));
            return;
        }
        persistWatchlist([
            ...watchlist,
            {
                norad,
                name: record.OBJECT_NAME ?? `NORAD ${norad}`,
                groupLabel: record.groupLabel ?? "Stations",
            },
        ]);
    }

    function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if ((event.target as HTMLElement).closest("button, input")) return;
        const panel = panelRef.current;
        if (!panel) return;
        const rect = panel.getBoundingClientRect();
        dragRef.current = {
            pointerId: event.pointerId,
            dx: event.clientX - rect.left,
            dy: event.clientY - rect.top,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        const panel = panelRef.current;
        if (!drag || drag.pointerId !== event.pointerId || !panel) return;
        const rect = panel.getBoundingClientRect();
        const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - drag.dx));
        const y = Math.max(68, Math.min(window.innerHeight - rect.height - 8, event.clientY - drag.dy));
        setPosition({ x, y });
    }

    function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
        if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
        dragRef.current = null;
        if (position) localStorage.setItem(PANEL_KEY, JSON.stringify(position));
    }

    const trackedRows = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const filtered = needle
            ? records.filter((record) =>
                  `${record.OBJECT_NAME ?? ""} ${record.NORAD_CAT_ID ?? ""} ${record.groupLabel ?? ""}`
                      .toLowerCase()
                      .includes(needle)
              )
            : records;
        return filtered.slice(0, 120);
    }, [records, query]);

    const watchRows = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return watchlist.filter((item) =>
            `${item.name} ${item.norad} ${item.groupLabel}`.toLowerCase().includes(needle)
        );
    }, [watchlist, query]);

    if (!open) {
        return (
            <button className="sat4-tracked-reopen" onClick={() => setOpen(true)}>
                TRACKED · {records.length.toLocaleString("de-CH")}
            </button>
        );
    }

    const style = position
        ? ({ left: position.x, top: position.y, right: "auto" } as React.CSSProperties)
        : undefined;

    return (
        <div ref={panelRef} className="sat4-tracked-panel" style={style}>
            <div
                className="sat4-tracked-head"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => {
                    setPosition(null);
                    localStorage.removeItem(PANEL_KEY);
                }}
            >
                <div>
                    <small>SAT NETWORK</small>
                    <strong>SATELLITES TRACKED</strong>
                </div>
                <b>{records.length.toLocaleString("de-CH")}</b>
                <span>DRAG</span>
                <button onClick={() => setOpen(false)} aria-label="Close tracked panel">×</button>
            </div>

            <div className="sat4-tabs">
                <button className={tab === "tracked" ? "is-active" : ""} onClick={() => setTab("tracked")}>TRACKED</button>
                <button className={tab === "watch" ? "is-active" : ""} onClick={() => setTab("watch")}>★ WATCHLIST <em>{watchlist.length}</em></button>
            </div>

            <div className="sat4-search-row">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter name / NORAD / network..." />
                <span>{loading ? "SYNC" : updatedAt || "---"}</span>
            </div>

            <div className="sat4-list-head">
                <span>SATELLITE</span><span>NETWORK</span><span>NORAD</span><span>★</span>
            </div>

            <div className="sat4-list">
                {tab === "tracked" ? trackedRows.map((record) => {
                    const norad = record.NORAD_CAT_ID!;
                    const watched = watchlist.some((item) => item.norad === norad);
                    return (
                        <div className="sat4-row" key={norad}>
                            <button className="sat4-select" onClick={() => selectInRadar({ norad, groupLabel: record.groupLabel ?? "Stations" })}>
                                <strong>{record.OBJECT_NAME ?? `NORAD ${norad}`}</strong>
                                <small>{record.OBJECT_ID ?? "---"}</small>
                            </button>
                            <span>{record.groupLabel ?? "---"}</span>
                            <code>{norad}</code>
                            <button className={watched ? "sat4-star is-on" : "sat4-star"} onClick={() => toggleWatch(record)}>{watched ? "★" : "☆"}</button>
                        </div>
                    );
                }) : watchRows.map((item) => (
                    <div className="sat4-row" key={item.norad}>
                        <button className="sat4-select" onClick={() => selectInRadar(item)}>
                            <strong>{item.name}</strong>
                            <small>WATCHLIST</small>
                        </button>
                        <span>{item.groupLabel}</span>
                        <code>{item.norad}</code>
                        <button className="sat4-star is-on" onClick={() => persistWatchlist(watchlist.filter((entry) => entry.norad !== item.norad))}>★</button>
                    </div>
                ))}
                {(tab === "tracked" ? trackedRows.length === 0 : watchRows.length === 0) && (
                    <p className="sat4-empty">{tab === "tracked" ? "No satellites match this filter." : "Your watchlist is empty."}</p>
                )}
            </div>
            {tab === "tracked" && records.length > 120 && <div className="sat4-limit-note">Showing first 120 objects · use filter to narrow the list.</div>}
        </div>
    );
}
