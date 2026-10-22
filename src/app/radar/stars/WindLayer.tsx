"use client";

import { useEffect, useRef, type RefObject } from "react";
import { windVector, type WeatherGrid } from "./weather-layers";
import { type Point } from "./types";

/*
 * Animierte Windpartikel ueber der Erdansicht (wie bei earth.nullschool):
 * Partikel treiben mit dem interpolierten Wind und ziehen kurze Spuren.
 * Eigene Zeichenflaeche ueber der Karte, damit die Sternkarte nicht
 * 60-mal pro Sekunde neu gezeichnet werden muss.
 */

type Particle = { lat: number; lon: number; age: number; life: number };

const COUNT = 2200;
// Grad pro Bild je km/h; 50 km/h ~ 0,2°/Bild
const DEGREES_PER_KMH = 0.004;

function spawn(): Particle {
    // Gleichmaessig ueber die Kugel verteilt
    return { lat: (Math.asin(2 * Math.random() - 1) * 180) / Math.PI * 0.95, lon: Math.random() * 360 - 180, age: 0, life: 60 + Math.random() * 90 };
}

export default function WindLayer({ grid, timeIndex, projectRef, viewKey, width, height }: {
    grid: WeatherGrid;
    timeIndex: number;
    projectRef: RefObject<((lat: number, lon: number) => Point | null) | null>;
    viewKey: string;
    width: number;
    height: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const particlesRef = useRef<Particle[]>(Array.from({ length: COUNT }, spawn));

    // Bei neuem Blick (Drehen, Zoomen) alte Spuren loeschen.
    useEffect(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }, [viewKey]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || width === 0 || height === 0 || timeIndex < 0) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        let frame = 0;
        let last = performance.now();

        const step = (now: number) => {
            frame = window.requestAnimationFrame(step);
            // Zeitbasiert statt pro Bild: gleich schnell bei 60 und 144 Hz.
            const dt = Math.min(3, (now - last) / 16.7);
            last = now;
            if (document.hidden) return;
            const project = projectRef.current;
            if (!project) return;

            // Spuren langsam ausblenden
            ctx.globalCompositeOperation = "destination-in";
            ctx.fillStyle = `rgba(0,0,0,${Math.pow(0.94, dt)})`;
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = "source-over";
            ctx.lineWidth = 1.6;

            for (const particle of particlesRef.current) {
                const { u, v } = windVector(grid, timeIndex, particle.lat, particle.lon);
                const speed = Math.hypot(u, v);
                const from = project(particle.lat, particle.lon);
                particle.lat = Math.max(-84, Math.min(84, particle.lat + v * DEGREES_PER_KMH * dt));
                particle.lon = (((particle.lon + (u * DEGREES_PER_KMH * dt) / Math.max(0.2, Math.cos((particle.lat * Math.PI) / 180)) + 180) % 360) + 360) % 360 - 180;
                particle.age += dt;
                const to = project(particle.lat, particle.lon);
                if (from && to && Math.hypot(to.x - from.x, to.y - from.y) < 40) {
                    ctx.strokeStyle = speed > 60 ? "rgba(255,190,90,.95)" : speed > 30 ? "rgba(150,235,255,.9)" : "rgba(235,245,255,.7)";
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.stroke();
                }
                if (particle.age > particle.life || speed < 0.5) Object.assign(particle, spawn());
            }
        };
        frame = window.requestAnimationFrame(step);
        return () => window.cancelAnimationFrame(frame);
    }, [grid, timeIndex, projectRef, width, height]);

    return <canvas ref={canvasRef} className="stars-wind-layer" style={{ width, height }} aria-hidden="true" />;
}
