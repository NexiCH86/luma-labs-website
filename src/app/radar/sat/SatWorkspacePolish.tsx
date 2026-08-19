"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const KEY = "luma-radar-sat-network-position";

type Point = { x: number; y: number };

export default function SatWorkspacePolish() {
    const [panel, setPanel] = useState<HTMLElement | null>(null);
    const [title, setTitle] = useState<HTMLElement | null>(null);
    const [open, setOpen] = useState(true);

    useEffect(() => {
        let stopped = false;
        let cleanup: (() => void) | null = null;

        const connect = () => {
            if (stopped) return;
            const nextPanel = document.querySelector<HTMLElement>(".sat2-filter-panel");
            const nextTitle = nextPanel?.querySelector<HTMLElement>(".sat2-filter-title") ?? null;
            if (!nextPanel || !nextTitle) {
                requestAnimationFrame(connect);
                return;
            }

            setPanel(nextPanel);
            setTitle(nextTitle);
            nextPanel.classList.add("satv1-network-movable");
            nextTitle.classList.add("satv1-network-handle");

            try {
                const stored = JSON.parse(localStorage.getItem(KEY) ?? "null") as Point | null;
                if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
                    nextPanel.style.left = `${stored.x}px`;
                    nextPanel.style.top = `${stored.y}px`;
                    nextPanel.style.right = "auto";
                }
            } catch {
                localStorage.removeItem(KEY);
            }

            let dragging = false;
            let dx = 0;
            let dy = 0;
            const move = (event: PointerEvent) => {
                if (!dragging) return;
                const rect = nextPanel.getBoundingClientRect();
                const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - dx));
                const y = Math.max(72, Math.min(window.innerHeight - rect.height - 12, event.clientY - dy));
                nextPanel.style.left = `${x}px`;
                nextPanel.style.top = `${y}px`;
                nextPanel.style.right = "auto";
            };
            const up = () => {
                if (!dragging) return;
                dragging = false;
                const rect = nextPanel.getBoundingClientRect();
                localStorage.setItem(KEY, JSON.stringify({ x: rect.left, y: rect.top }));
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
            };
            const down = (event: PointerEvent) => {
                if ((event.target as HTMLElement).closest("button")) return;
                const rect = nextPanel.getBoundingClientRect();
                dragging = true;
                dx = event.clientX - rect.left;
                dy = event.clientY - rect.top;
                event.preventDefault();
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
            };
            const reset = () => {
                localStorage.removeItem(KEY);
                nextPanel.style.removeProperty("left");
                nextPanel.style.removeProperty("top");
                nextPanel.style.removeProperty("right");
            };

            nextTitle.addEventListener("pointerdown", down);
            nextTitle.addEventListener("dblclick", reset);
            cleanup = () => {
                nextTitle.removeEventListener("pointerdown", down);
                nextTitle.removeEventListener("dblclick", reset);
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
            };
        };

        connect();
        return () => {
            stopped = true;
            cleanup?.();
        };
    }, []);

    useEffect(() => {
        if (panel) panel.style.display = open ? "" : "none";
    }, [panel, open]);

    return (
        <>
            {title && open && createPortal(
                <button className="satv1-network-close" onClick={() => setOpen(false)} aria-label="Close networks">×</button>,
                title
            )}
            {!open && <button className="satv1-network-reopen" onClick={() => setOpen(true)}>NETWORKS</button>}
        </>
    );
}
