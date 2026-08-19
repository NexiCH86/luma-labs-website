"use client";

import { useEffect } from "react";

let topZIndex = 1600;
const STORAGE_KEY = "luma-radar-panel-layout-v1";

type SavedPosition = { left: number; top: number };
type SavedLayout = Record<string, SavedPosition>;
type DefaultPosition = { left: string; top: string; right: string; bottom: string; margin: string };

function loadLayout(): SavedLayout {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const value = JSON.parse(raw);
        return value && typeof value === "object" ? value as SavedLayout : {};
    } catch {
        return {};
    }
}

function saveLayout(layout: SavedLayout) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
        // Layout persistence is optional; dragging still works without storage.
    }
}

function panelKey(section: HTMLElement) {
    const handle = section.firstElementChild as HTMLElement | null;
    const text = handle?.innerText?.replace(/\s+/g, " ").trim().toUpperCase() || section.innerText?.slice(0, 80).replace(/\s+/g, " ").trim().toUpperCase();
    return text || `PANEL-${Math.random().toString(36).slice(2)}`;
}

export default function RadarPanelWindowManager() {
    useEffect(() => {
        const cleanups = new Map<HTMLElement, () => void>();
        const defaults = new Map<HTMLElement, DefaultPosition>();
        let layout = loadLayout();

        function isInteractive(target: EventTarget | null) {
            return target instanceof Element && Boolean(target.closest("button, input, select, textarea, a, [role='button']"));
        }

        function clampPosition(container: HTMLElement, left: number, top: number) {
            const rect = container.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - Math.min(rect.width, window.innerWidth));
            const maxTop = Math.max(0, window.innerHeight - 44);
            return {
                left: Math.min(maxLeft, Math.max(0, left)),
                top: Math.min(maxTop, Math.max(0, top)),
            };
        }

        function applyAbsolutePosition(container: HTMLElement, left: number, top: number) {
            const clamped = clampPosition(container, left, top);
            container.style.left = `${clamped.left}px`;
            container.style.top = `${clamped.top}px`;
            container.style.right = "auto";
            container.style.bottom = "auto";
            container.style.margin = "0";
            return clamped;
        }

        function makeDraggable(section: HTMLElement) {
            const container = section.parentElement as HTMLElement | null;
            const handle = section.firstElementChild as HTMLElement | null;
            if (!container || !handle || cleanups.has(section)) return;
            if (getComputedStyle(container).position !== "fixed") return;

            const key = panelKey(section);
            section.dataset.lumaDraggablePanel = "true";
            section.dataset.lumaPanelKey = key;
            handle.dataset.lumaDragHandle = "true";
            handle.style.cursor = "grab";
            handle.style.userSelect = "none";

            defaults.set(section, {
                left: container.style.left,
                top: container.style.top,
                right: container.style.right,
                bottom: container.style.bottom,
                margin: container.style.margin,
            });

            const saved = layout[key];
            if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
                requestAnimationFrame(() => applyAbsolutePosition(container, saved.left, saved.top));
            }

            const bringToFront = () => {
                topZIndex += 1;
                container.style.zIndex = String(topZIndex);
            };

            const onPanelPointerDown = () => bringToFront();

            const onHandlePointerDown = (event: PointerEvent) => {
                if (event.button !== 0 || isInteractive(event.target)) return;
                event.preventDefault();
                bringToFront();
                handle.style.cursor = "grabbing";

                const rect = container.getBoundingClientRect();
                const offsetX = event.clientX - rect.left;
                const offsetY = event.clientY - rect.top;
                applyAbsolutePosition(container, rect.left, rect.top);

                const onMove = (moveEvent: PointerEvent) => {
                    applyAbsolutePosition(container, moveEvent.clientX - offsetX, moveEvent.clientY - offsetY);
                };

                const onUp = () => {
                    handle.style.cursor = "grab";
                    const rectNow = container.getBoundingClientRect();
                    const position = clampPosition(container, rectNow.left, rectNow.top);
                    layout = { ...layout, [key]: position };
                    saveLayout(layout);
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", onUp);
                    window.removeEventListener("pointercancel", onUp);
                };

                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
                window.addEventListener("pointercancel", onUp);
            };

            container.addEventListener("pointerdown", onPanelPointerDown);
            handle.addEventListener("pointerdown", onHandlePointerDown);

            cleanups.set(section, () => {
                container.removeEventListener("pointerdown", onPanelPointerDown);
                handle.removeEventListener("pointerdown", onHandlePointerDown);
                delete section.dataset.lumaDraggablePanel;
                delete section.dataset.lumaPanelKey;
                delete handle.dataset.lumaDragHandle;
                handle.style.cursor = "";
                handle.style.userSelect = "";
                defaults.delete(section);
            });
        }

        function scan() {
            document.querySelectorAll<HTMLElement>("section").forEach((section) => {
                const container = section.parentElement as HTMLElement | null;
                if (!container || getComputedStyle(container).position !== "fixed") return;
                makeDraggable(section);
            });

            for (const [section, cleanup] of cleanups) {
                if (!section.isConnected) {
                    cleanup();
                    cleanups.delete(section);
                }
            }
        }

        const resetLayout = () => {
            layout = {};
            try { window.localStorage.removeItem(STORAGE_KEY); } catch {}

            for (const section of cleanups.keys()) {
                const container = section.parentElement as HTMLElement | null;
                const initial = defaults.get(section);
                if (!container || !initial) continue;
                container.style.left = initial.left;
                container.style.top = initial.top;
                container.style.right = initial.right;
                container.style.bottom = initial.bottom;
                container.style.margin = initial.margin;
            }
        };

        scan();
        const observer = new MutationObserver(scan);
        observer.observe(document.body, { childList: true, subtree: true });

        const onResize = () => {
            for (const section of cleanups.keys()) {
                const container = section.parentElement as HTMLElement | null;
                const key = section.dataset.lumaPanelKey;
                if (!container || !container.style.top || !key) continue;
                const rect = container.getBoundingClientRect();
                const position = applyAbsolutePosition(container, rect.left, rect.top);
                if (layout[key]) {
                    layout = { ...layout, [key]: position };
                    saveLayout(layout);
                }
            }
        };

        window.addEventListener("resize", onResize);
        window.addEventListener("luma:radar-reset-layout", resetLayout);

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", onResize);
            window.removeEventListener("luma:radar-reset-layout", resetLayout);
            for (const cleanup of cleanups.values()) cleanup();
            cleanups.clear();
        };
    }, []);

    return null;
}
