"use client";

import { useEffect, useRef, type RefObject } from "react";
import { type Point } from "./types";

/*
 * Bedienung der Karte: ein Finger bzw. die Maus verschiebt, zwei
 * Finger zoomen um ihre Mitte, das Mausrad zoomt zum Zeiger. Ein kurzer
 * Tipp/Klick ohne Bewegung meldet onTap. Die Handler werden ueber einen
 * Ref aktuell gehalten, damit der Wheel-Listener nur einmal haengt.
 */
export type GestureHandlers = {
    onPan: (dx: number, dy: number, rect: DOMRect) => void;
    onPinch: (factor: number, mid: Point, pan: Point, rect: DOMRect) => void;
    onWheel: (factor: number, at: Point, rect: DOMRect) => void;
    onTap: (clientX: number, clientY: number) => void;
};

export function useCanvasGestures(canvasRef: RefObject<HTMLCanvasElement | null>, handlers: GestureHandlers) {
    const handlersRef = useRef(handlers);
    const pointersRef = useRef(new Map<number, Point>());
    const gestureRef = useRef<{ moved: boolean; pinchDistance: number; pinchMid: Point } | null>(null);

    useEffect(() => {
        handlersRef.current = handlers;
    });

    // Eigener Wheel-Listener: React registriert onWheel passiv, dort wirkt preventDefault nicht.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const rect = canvas.getBoundingClientRect();
            handlersRef.current.onWheel(event.deltaY < 0 ? 1.12 : 0.89, { x: event.clientX - rect.left, y: event.clientY - rect.top }, rect);
        };
        canvas.addEventListener("wheel", onWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", onWheel);
    }, [canvasRef]);

    function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const pointers = pointersRef.current;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 1) {
            gestureRef.current = { moved: false, pinchDistance: 0, pinchMid: { x: 0, y: 0 } };
        } else if (pointers.size === 2 && gestureRef.current) {
            const [a, b] = [...pointers.values()];
            gestureRef.current = { moved: true, pinchDistance: Math.hypot(a.x - b.x, a.y - b.y), pinchMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        }
    }

    function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
        const pointers = pointersRef.current;
        const previous = pointers.get(event.pointerId);
        const gesture = gestureRef.current;
        if (!previous || !gesture) return;
        const current = { x: event.clientX, y: event.clientY };
        pointers.set(event.pointerId, current);
        const rect = event.currentTarget.getBoundingClientRect();

        if (pointers.size === 1) {
            const dx = current.x - previous.x;
            const dy = current.y - previous.y;
            if (!gesture.moved && Math.hypot(dx, dy) < 1) return;
            gesture.moved = true;
            handlersRef.current.onPan(dx, dy, rect);
            return;
        }

        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const factor = gesture.pinchDistance > 0 ? distance / gesture.pinchDistance : 1;
            const pan = { x: mid.x - gesture.pinchMid.x, y: mid.y - gesture.pinchMid.y };
            gestureRef.current = { moved: true, pinchDistance: distance, pinchMid: mid };
            handlersRef.current.onPinch(factor, { x: mid.x - rect.left, y: mid.y - rect.top }, pan, rect);
        }
    }

    function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
        const pointers = pointersRef.current;
        const start = pointers.get(event.pointerId);
        pointers.delete(event.pointerId);
        const gesture = gestureRef.current;
        if (pointers.size === 0) {
            gestureRef.current = null;
            if (start && gesture && !gesture.moved && event.type === "pointerup") handlersRef.current.onTap(event.clientX, event.clientY);
        }
    }

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}

export function isTypingTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/*
 * Tastaturkuerzel; die Zuordnung Taste -> Aktion liefert die Komponente.
 * Escape wirkt auch in Eingabefeldern, alles andere nicht.
 */
export function useKeyboardShortcuts(actions: Record<string, () => void>) {
    const actionsRef = useRef(actions);

    useEffect(() => {
        actionsRef.current = actions;
    });

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === "Escape") {
                if (isTypingTarget(event.target)) (event.target as HTMLElement).blur();
                actionsRef.current.Escape?.();
                return;
            }
            if (isTypingTarget(event.target)) return;
            const action = actionsRef.current[event.key] ?? actionsRef.current[event.key.toLowerCase()];
            if (!action) return;
            action();
            event.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
}
