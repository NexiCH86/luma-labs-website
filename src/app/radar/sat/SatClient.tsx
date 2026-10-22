"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SatDetails from "./SatDetails";
import SatList from "./SatList";
import SatLocation from "./SatLocation";
import SatMap, { type MapFocus } from "./SatMap";
import SatNetworks from "./SatNetworks";
import SatPasses from "./SatPasses";
import SatStatus from "./SatStatus";
import { formatAge } from "./format";
import { groundTrack, positionAt, type LivePosition, type Observer } from "./orbit";
import {
    buildShareQuery,
    groupLabel,
    readObserver,
    readSettings,
    readUrlState,
    readWatchlist,
    writeObserver,
    writeSettings,
    writeWatchlist,
    type SatSettings,
    type WatchItem,
} from "./settings";
import { mergeEntries, useSatData } from "./use-sat-data";

/*
 * LuMa RADAR SAT: ein gemeinsamer Zustand (Gruppen, Auswahl,
 * Standort, Beobachtungsliste, Zeit) fuer Karte und alle Panels.
 * Desktop: Panels links und rechts; Handy: eine Leiste von unten.
 */

type RightTab = "details" | "passes" | "status";
type SheetTab = "networks" | "list" | RightTab;

const MOBILE_QUERY = "(max-width: 820px)";

function useIsMobile() {
    const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
    useEffect(() => {
        const query = window.matchMedia(MOBILE_QUERY);
        const update = () => setMobile(query.matches);
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    return mobile;
}

export default function SatClient() {
    const [initialUrl] = useState(() => readUrlState(window.location.search));
    const [settings, setSettings] = useState<SatSettings>(() => {
        const saved = readSettings();
        return initialUrl.groups ? { ...saved, groups: initialUrl.groups } : saved;
    });
    const [observer, setObserver] = useState<Observer | null>(() => initialUrl.observer ?? readObserver());
    const [watchlist, setWatchlist] = useState<WatchItem[]>(readWatchlist);
    const [selectedNorad, setSelectedNorad] = useState<number | null>(initialUrl.norad ?? null);
    const [focus, setFocus] = useState<MapFocus | null>(() => (initialUrl.norad ? { id: 1, norad: initialUrl.norad, zoom: 4 } : null));
    const [now, setNow] = useState(() => new Date());
    const [search, setSearch] = useState("");
    const [searchError, setSearchError] = useState("");
    const [locationOpen, setLocationOpen] = useState(false);
    const [rightTab, setRightTab] = useState<RightTab>("details");
    const [sheetTab, setSheetTab] = useState<SheetTab>(initialUrl.norad ? "details" : "networks");
    const [sheetOpen, setSheetOpen] = useState(initialUrl.norad != null);
    const [shareMessage, setShareMessage] = useState("");
    const mobile = useIsMobile();

    const enabled = settings.groups;
    /* Gruppen der Beobachtungsliste mitladen, damit ihre Ueberfluege auch bei ausgeblendeter Gruppe stimmen. */
    const loadGroups = useMemo(() => Array.from(new Set([...enabled, ...watchlist.map((item) => item.groupKey)])), [enabled, watchlist]);
    const { groups, retry } = useSatData(loadGroups);

    const visibleMap = useMemo(() => mergeEntries(groups, enabled), [groups, enabled]);
    const visible = useMemo(() => Array.from(visibleMap.values()), [visibleMap]);
    const loadedMap = useMemo(() => mergeEntries(groups, loadGroups), [groups, loadGroups]);
    const resolve = useCallback((norad: number) => loadedMap.get(norad), [loadedMap]);
    const selected = selectedNorad != null ? (loadedMap.get(selectedNorad) ?? null) : null;
    const watched = useMemo(() => new Set(watchlist.map((item) => item.norad)), [watchlist]);

    /* Uhr fuer die Positionen; bei sehr vielen Objekten seltener. */
    const crowded = visible.length > 3000;
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), crowded ? 3000 : 1000);
        return () => window.clearInterval(timer);
    }, [crowded]);

    const positions = useMemo(() => {
        const result = new Map<number, LivePosition>();
        for (const entry of visible) {
            const position = positionAt(entry, now);
            if (position) result.set(entry.norad, position);
        }
        if (selected && !result.has(selected.norad)) {
            const position = positionAt(selected, now);
            if (position) result.set(selected.norad, position);
        }
        return result;
    }, [visible, selected, now]);
    const selectedPosition = selected ? (positions.get(selected.norad) ?? null) : null;

    const minute = Math.floor(now.getTime() / 60_000);
    const track = useMemo(() => (selected ? groundTrack(selected, new Date(minute * 60_000)) : []), [selected, minute]);

    /* Einstellungen und Beobachtungsliste speichern, Link aktuell halten. */
    useEffect(() => writeSettings(settings), [settings]);
    useEffect(() => writeWatchlist(watchlist), [watchlist]);
    useEffect(() => {
        const query = buildShareQuery({ norad: selectedNorad ?? undefined, groups: enabled });
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }, [selectedNorad, enabled]);

    useEffect(() => {
        if (!shareMessage) return;
        const timer = window.setTimeout(() => setShareMessage(""), 2500);
        return () => window.clearTimeout(timer);
    }, [shareMessage]);

    const updateSettings = (patch: Partial<SatSettings>) => setSettings((current) => ({ ...current, ...patch }));

    function toggleGroup(group: string) {
        const next = enabled.includes(group) ? enabled.filter((key) => key !== group) : [...enabled, group];
        updateSettings({ groups: next });
    }

    function select(norad: number, groupKey?: string, fly = true) {
        if (groupKey && !enabled.includes(groupKey)) updateSettings({ groups: [...enabled, groupKey] });
        setSelectedNorad(norad);
        setSearchError("");
        setRightTab("details");
        setSheetTab("details");
        setSheetOpen(true);
        /* Die Karte fliegt hin, sobald die Position bekannt ist (Gruppe evtl. noch am Laden). */
        if (fly) setFocus({ id: Date.now(), norad, zoom: 4 });
    }

    function toggleWatch(item: WatchItem) {
        setWatchlist((current) => (current.some((entry) => entry.norad === item.norad) ? current.filter((entry) => entry.norad !== item.norad) : [...current, item]));
    }

    function changeObserver(next: Observer) {
        setObserver(next);
        writeObserver(next);
        setFocus({ latitude: next.latitude, longitude: next.longitude, zoom: 4, id: Date.now() });
    }

    function runSearch() {
        const query = search.trim().toUpperCase();
        setSearchError("");
        if (!query) return;
        const candidates = Array.from(loadedMap.values());
        const match =
            candidates.find((entry) => String(entry.norad) === query || entry.objectId?.toUpperCase() === query) ??
            candidates.find((entry) => entry.name.toUpperCase() === query) ??
            candidates.find((entry) => entry.name.toUpperCase().includes(query) || entry.objectId?.toUpperCase().includes(query));
        if (!match) {
            setSearchError("NOT FOUND IN ACTIVE NETWORKS");
            return;
        }
        select(match.norad);
    }

    async function share() {
        const url = `${window.location.origin}${window.location.pathname}?${buildShareQuery({ norad: selectedNorad ?? undefined, groups: enabled })}`;
        try {
            if (mobile && navigator.share) {
                await navigator.share({ title: selected ? `${selected.name} · LuMa RADAR` : "LuMa RADAR SAT", url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setShareMessage("Link kopiert");
        } catch {
            setShareMessage("Kopieren nicht möglich");
        }
    }

    async function toggleAlerts() {
        if (settings.alerts) return updateSettings({ alerts: false });
        if (typeof Notification === "undefined") return;
        if ((await Notification.requestPermission()) === "granted") updateSettings({ alerts: true });
    }

    function fullscreen() {
        if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
        else void document.exitFullscreen();
    }

    /* Hinweise zum Datenstand fuer die Leiste unten. */
    const failed = enabled.filter((group) => groups[group]?.status === "error");
    const staleAges = enabled.map((group) => groups[group]).filter((state) => state?.stale && state.fetchedAt).map((state) => now.getTime() - (state!.fetchedAt as number));

    const networks = <SatNetworks enabled={enabled} groups={groups} visibleCount={visible.length} onToggle={toggleGroup} onRetry={retry} />;
    const list = <SatList entries={visible} watchlist={watchlist} selectedNorad={selectedNorad} onSelect={(norad, groupKey) => select(norad, groupKey)} onToggleWatch={toggleWatch} />;
    const details = (
        <SatDetails
            entry={selected}
            position={selectedPosition}
            observer={observer}
            now={now}
            watched={selected ? watched.has(selected.norad) : false}
            onToggleWatch={() => selected && toggleWatch({ norad: selected.norad, name: selected.name, groupKey: selected.group })}
            onLocate={() => setLocationOpen(true)}
            onShare={share}
            shareMessage={shareMessage}
        />
    );
    const passes = (
        <SatPasses watchlist={watchlist} resolve={resolve} observer={observer} now={now} alerts={settings.alerts} onToggleAlerts={toggleAlerts} onSelect={(norad, groupKey) => select(norad, groupKey)} onLocate={() => setLocationOpen(true)} />
    );
    const status = <SatStatus enabled={enabled} groups={groups} observer={observer} now={now} onRetry={retry} />;
    const viewToggles = (
        <div className="sat-view-toggles">
            <button className={settings.showMarkers ? "is-on" : ""} onClick={() => updateSettings({ showMarkers: !settings.showMarkers })} aria-pressed={settings.showMarkers}><span /> MARKERS</button>
            <button className={settings.showOrbit ? "is-on" : ""} onClick={() => updateSettings({ showOrbit: !settings.showOrbit })} aria-pressed={settings.showOrbit}><span /> ORBIT TRAIL</button>
        </div>
    );
    const rightContent = { details, passes, status }[rightTab];
    const sheetContent = {
        networks: <>{viewToggles}{networks}</>,
        list,
        details,
        passes,
        status,
    }[sheetTab];

    return (
        <main className={`radar-shell sat-app${mobile ? " is-mobile" : ""}`}>
            <header className="radar-header sat-header">
                <Link href="/" className="radar-brand">
                    <div>LuMa <span>RADAR</span></div>
                    <small>LIVE SATELLITE NETWORK</small>
                </Link>

                <div className="radar-search-wrapper">
                    <div className="radar-search">
                        <input
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setSearchError("");
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") runSearch();
                            }}
                            placeholder={mobile ? "Satellit / NORAD…" : "Satellit / NORAD / COSPAR suchen…"}
                            aria-label="Search satellite"
                        />
                        <button onClick={runSearch}>SEARCH</button>
                    </div>
                    {searchError && <div className="radar-search-error">{searchError}</div>}
                </div>

                <button className={`sat-location-button${observer ? " is-set" : ""}`} onClick={() => setLocationOpen(true)} title={observer ? `${observer.label ?? "Location"} · ${observer.latitude.toFixed(2)}°, ${observer.longitude.toFixed(2)}°` : "Set location"}>
                    <span aria-hidden="true">◉</span>
                    <b>{observer ? (observer.label ?? "MY LOCATION").slice(0, 22) : "MY LOCATION"}</b>
                </button>
                <Link href="/" className="back-button">← LUMA LABS</Link>
                <button className="fullscreen-button" onClick={fullscreen}>FULLSCREEN</button>
            </header>

            <section className="sat-main">
                <SatMap
                    entries={visible}
                    positions={positions}
                    selectedNorad={selectedNorad}
                    watched={watched}
                    track={track}
                    observer={observer}
                    showMarkers={settings.showMarkers}
                    showOrbit={settings.showOrbit}
                    focus={focus}
                    focusOffsetY={mobile && sheetOpen ? Math.round(window.innerHeight * 0.24) : 0}
                    onSelect={(norad) => select(norad, undefined, false)}
                />

                {!mobile && (
                    <>
                        {settings.panels.left ? (
                            <aside className="sat-panel sat-panel-left">
                                <button className="sat-panel-close" onClick={() => updateSettings({ panels: { ...settings.panels, left: false } })} aria-label="Hide networks and list">×</button>
                                {networks}
                                {list}
                            </aside>
                        ) : (
                            <button className="sat-panel-reopen sat-panel-reopen-left" onClick={() => updateSettings({ panels: { ...settings.panels, left: true } })}>NETWORKS · {visible.length.toLocaleString("de-CH")}</button>
                        )}

                        {settings.panels.right ? (
                            <aside className="sat-panel sat-panel-right">
                                <div className="sat-tabs" role="tablist">
                                    {(["details", "passes", "status"] as RightTab[]).map((tab) => (
                                        <button key={tab} role="tab" aria-selected={rightTab === tab} className={rightTab === tab ? "is-active" : ""} onClick={() => setRightTab(tab)}>
                                            {tab === "details" ? "DETAILS" : tab === "passes" ? `PASSES${watchlist.length ? ` · ${watchlist.length}` : ""}` : "STATUS"}
                                        </button>
                                    ))}
                                    <button className="sat-panel-close" onClick={() => updateSettings({ panels: { ...settings.panels, right: false } })} aria-label="Hide details">×</button>
                                </div>
                                <div className="sat-panel-body">{rightContent}</div>
                            </aside>
                        ) : (
                            <button className="sat-panel-reopen sat-panel-reopen-right" onClick={() => updateSettings({ panels: { ...settings.panels, right: true } })}>DETAILS</button>
                        )}

                        <div className="sat-bar">
                            <div className="sat-clock"><small>LOCAL</small><b>{now.toLocaleTimeString("de-CH")}</b></div>
                            <div className="sat-clock"><small>UTC</small><b>{now.toLocaleTimeString("de-CH", { timeZone: "UTC" })}</b></div>
                            {viewToggles}
                            <div className="sat-bar-count">★ <b>{watchlist.length}</b> WATCHED</div>
                            {failed.length > 0 && <button className="sat-bar-warning" onClick={() => setRightTab("status")}>{failed.map(groupLabel).join(", ")} OFFLINE</button>}
                            {staleAges.length > 0 && <button className="sat-bar-warning" onClick={() => setRightTab("status")}>DATA {formatAge(Math.max(...staleAges))} OLD</button>}
                        </div>
                    </>
                )}

                {mobile && (
                    <section className={`sat-sheet${sheetOpen ? " is-open" : ""}`} aria-label="Satellite panels">
                        <div className="sat-sheet-tabs" role="tablist">
                            {(["networks", "list", "details", "passes", "status"] as SheetTab[]).map((tab) => (
                                <button
                                    key={tab}
                                    role="tab"
                                    aria-selected={sheetOpen && sheetTab === tab}
                                    className={sheetOpen && sheetTab === tab ? "is-active" : ""}
                                    onClick={() => {
                                        if (sheetOpen && sheetTab === tab) setSheetOpen(false);
                                        else {
                                            setSheetTab(tab);
                                            setSheetOpen(true);
                                        }
                                    }}
                                >
                                    {{ networks: "NETWORKS", list: "LIST", details: "DETAILS", passes: "PASSES", status: "STATUS" }[tab]}
                                    {tab === "status" && (failed.length > 0 || staleAges.length > 0) && <i className="sat-dot-warning" />}
                                </button>
                            ))}
                        </div>
                        {sheetOpen && <div className="sat-sheet-body">{sheetContent}</div>}
                    </section>
                )}
            </section>

            {locationOpen && <SatLocation observer={observer} onChange={changeObserver} onClose={() => setLocationOpen(false)} />}
        </main>
    );
}
