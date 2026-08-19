"use client";

import { useEffect } from "react";

let topZIndex = 1600;

export default function RadarPanelWindowManager() {
    useEffect(() => {
        const cleanups = new Map<HTMLElement, () => void>();

        function isInteractive(target: EventTarget | null) {
            return target instanceof Element && Boolean(
                target.closest("button, input, select, textarea, a, [role='button']")
            );
        }

        function makeDraggable(section: HTMLElement) {
            const container = section.parentElement as HTMLElement | null;
            const handle = section.firstElementChild as HTMLElement | null;

            if (!container || !handle || cleanups.has(section)) return;
            if (getComputedStyle(container).position !== "fixed") return;

            section.dataset.lumaDraggablePanel = "true";
            handle.dataset.lumaDragHandle = "true";
            handle.style.cursor = "grab";
            handle.style.userSelect = "none";

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

                container.style.left = `${rect.left}px`;
                container.style.top = `${rect.top}px`;
                container.style.right = "auto";
                container.style.bottom = "auto";
                container.style.margin = "0";

                const onMove = (moveEvent: PointerEvent) => {
                    const currentRect = container.getBoundingClientRect();
                    const maxLeft = Math.max(0, window.innerWidth - Math.min(currentRect.width, window.innerWidth));
                    const maxTop = Math.max(0, window.innerHeight - 44);
                    const nextLeft = Math.min(maxLeft, Math.max(0, moveEvent.clientX - offsetX));
                    const nextTop = Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY));

                    container.style.left = `${nextLeft}px`;
                    container.style.top = `${nextTop}px`;
                };

                const onUp = () => {
                    handle.style.cursor = "grab";
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
                delete handle.dataset.lumaDragHandle;
                handle.style.cursor = "";
                handle.style.userSelect = "";
            });
        }

        function scan() {
            document.querySelectorAll<HTMLElement>("section").forEach((section) => {
                const container = section.parentElement as HTMLElement | null;
                if (!container) return;
                if (getComputedStyle(container).position !== "fixed") return;
                makeDraggable(section);
            });

            for (const [section, cleanup] of cleanups) {
                if (!section.isConnected) {
                    cleanup();
                    cleanups.delete(section);
                }
            }
        }

        scan();
        const observer = new MutationObserver(scan);
        observer.observe(document.body, { childList: true, subtree: true });

        const onResize = () => {
            for (const section of cleanups.keys()) {
                const container = section.parentElement as HTMLElement | null;
                if (!container || !container.style.top) continue;
                const rect = container.getBoundingClientRect();
                const left = Math.min(Math.max(0, rect.left), Math.max(0, window.innerWidth - rect.width));
                const top = Math.min(Math.max(0, rect.top), Math.max(0, window.innerHeight - 44));
                container.style.left = `${left}px`;
                container.style.top = `${top}px`;
            }
        };

        window.addEventListener("resize", onResize);

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", onResize);
            for (const cleanup of cleanups.values()) cleanup();
            cleanups.clear();
        };
    }, []);

    return null;
}
