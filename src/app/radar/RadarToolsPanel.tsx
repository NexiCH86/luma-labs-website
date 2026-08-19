"use client";

import { useEffect, useMemo, useState } from "react";

type ToolKey = "FILTERS" | "TRAILS" | "DENSITY" | "AIRSPACE";

type ToolItem = {
    key: ToolKey;
    label: string;
    description: string;
    icon: string;
};

const TOOLS: ToolItem[] = [
    { key: "FILTERS", label: "Air Filters", description: "Airline, phase, altitude and category", icon: "◇" },
    { key: "TRAILS", label: "Aircraft Trails", description: "Trail length and phase colors", icon: "⌁" },
    { key: "DENSITY", label: "Traffic Density", description: "Live traffic concentration overlay", icon: "◌" },
    { key: "AIRSPACE", label: "Airspace", description: "FIR and country reference layers", icon: "◫" },
];

export default function RadarToolsPanel() {
    const [open, setOpen] = useState(false);
    const [available, setAvailable] = useState<Record<ToolKey, boolean>>({
        FILTERS: false,
        TRAILS: false,
        DENSITY: false,
        AIRSPACE: false,
    });

    const availableCount = useMemo(
        () => Object.values(available).filter(Boolean).length,
        [available]
    );

    useEffect(() => {
        function syncTriggers() {
            const next: Record<ToolKey, boolean> = {
                FILTERS: false,
                TRAILS: false,
                DENSITY: false,
                AIRSPACE: false,
            };

            for (const button of document.querySelectorAll<HTMLButtonElement>("button")) {
                const text = button.textContent?.trim().toUpperCase() ?? "";
                for (const tool of TOOLS) {
                    if (!text.includes(tool.key)) continue;
                    if (button.closest("[data-luma-tools-panel]")) continue;
                    next[tool.key] = true;
                    button.dataset.lumaLegacyToolTrigger = tool.key;
                    button.style.display = "none";
                }
            }

            setAvailable(next);
        }

        syncTriggers();
        const observer = new MutationObserver(syncTriggers);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });

        return () => {
            observer.disconnect();
            document.querySelectorAll<HTMLElement>("[data-luma-legacy-tool-trigger]").forEach((element) => {
                element.style.display = "";
                delete element.dataset.lumaLegacyToolTrigger;
            });
        };
    }, []);

    function openTool(key: ToolKey) {
        const trigger = document.querySelector<HTMLButtonElement>(`button[data-luma-legacy-tool-trigger="${key}"]`);
        if (!trigger) return;
        trigger.click();
        setOpen(false);
    }

    return (
        <div data-luma-tools-panel style={{ position: "fixed", left: 18, bottom: 102, zIndex: 1520, fontFamily: "inherit" }}>
            {!open ? (
                <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
                    ☰ TOOLS{availableCount ? ` · ${availableCount}` : ""}
                </button>
            ) : (
                <section style={panelStyle}>
                    <div style={headerStyle}>
                        <div>
                            <small style={eyebrowStyle}>AIR MODE</small>
                            <strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>
                                Radar Tools
                            </strong>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} style={closeStyle}>×</button>
                    </div>

                    <div style={{ padding: 12 }}>
                        <div style={{ display: "grid", gap: 7 }}>
                            {TOOLS.map((tool) => (
                                <button
                                    key={tool.key}
                                    type="button"
                                    onClick={() => openTool(tool.key)}
                                    disabled={!available[tool.key]}
                                    style={{ ...toolStyle, opacity: available[tool.key] ? 1 : 0.35 }}
                                >
                                    <span style={iconStyle}>{tool.icon}</span>
                                    <span style={{ minWidth: 0, flex: 1 }}>
                                        <strong style={toolTitleStyle}>{tool.label}</strong>
                                        <small style={toolDescriptionStyle}>{tool.description}</small>
                                    </span>
                                    <span style={arrowStyle}>→</span>
                                </button>
                            ))}
                        </div>

                        <div style={hintStyle}>
                            Central access to LuMa RADAR display and analysis tools. Airport search remains available as a dedicated control.
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

const triggerStyle: React.CSSProperties = { border: "1px solid rgba(99,255,227,0.25)", borderRadius: 999, padding: "10px 14px", background: "rgba(5,17,20,0.94)", color: "rgba(99,255,227,0.96)", boxShadow: "0 10px 34px rgba(0,0,0,0.32)", cursor: "pointer", fontSize: 10, letterSpacing: "0.12em" };
const panelStyle: React.CSSProperties = { width: "min(350px, calc(100vw - 36px))", border: "1px solid rgba(99,255,227,0.22)", borderRadius: 16, background: "rgba(5,17,20,0.97)", boxShadow: "0 22px 60px rgba(0,0,0,0.44)", overflow: "hidden", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(99,255,227,0.68)", fontSize: 8, letterSpacing: "0.15em" };
const closeStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const toolStyle: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, background: "rgba(255,255,255,0.025)", textAlign: "left", color: "white", cursor: "pointer" };
const iconStyle: React.CSSProperties = { width: 28, height: 28, display: "grid", placeItems: "center", flex: "0 0 28px", borderRadius: 8, background: "rgba(99,255,227,0.07)", color: "rgba(99,255,227,0.88)", fontSize: 15 };
const toolTitleStyle: React.CSSProperties = { display: "block", color: "rgba(255,255,255,0.88)", fontSize: 10, letterSpacing: "0.05em" };
const toolDescriptionStyle: React.CSSProperties = { display: "block", marginTop: 2, color: "rgba(255,255,255,0.34)", fontSize: 8, lineHeight: 1.35 };
const arrowStyle: React.CSSProperties = { color: "rgba(99,255,227,0.52)", fontSize: 13 };
const hintStyle: React.CSSProperties = { marginTop: 11, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.28)", fontSize: 8, lineHeight: 1.45 };
