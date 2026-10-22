"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Body, GeoMoon, HelioVector, SiderealTime } from "astronomy-engine";
import { type EarthMap } from "./earth-view";
import { type SmallBodiesFile } from "./kepler";
import { type Observer } from "./sky-catalog";
import { type StarObject } from "./stars-data";
import { type SatelliteState } from "./satellites";
import {
    absoluteMagnitude,
    AU_KM,
    distance,
    EARTH_RADIUS_KM,
    formatAu,
    galacticPosition,
    galaxyParticles,
    heliocentric,
    moonFromEarth,
    orbitPoints,
    PLANETS,
    smallBodyPaths,
    starPosition,
    starsWithDistance,
    SUN_GALACTIC_KLY,
    type Vec3,
} from "./space-data";

/*
 * 3D-Modus des STARS-Modus (three.js), vier Massstaebe:
 *   earth  - Erde (Einheit: Erdradius) mit Tag/Nacht, Satelliten in
 *            echter Hoehe und dem Mond in echtem Abstand
 *   solar  - Sonnensystem (AE): Planeten und Bahnen, Kometen, Kleinplaneten
 *   stars  - Sternumgebung (Lichtjahre): Sterne in echter Entfernung
 *   galaxy - Milchstrasse (tausend Lichtjahre) mit Sonne und Objekten
 * Beschriftungen zeichnet eine 2D-Flaeche darueber; ein Klick waehlt das
 * naechstgelegene beschriftete Objekt.
 */

export type SpaceScale = "earth" | "solar" | "stars" | "galaxy";

export type SatelliteTrack = { id: string; color: string; points: { lat: number; lon: number }[]; heightKm: number };

// maxDistance: Beschriftung nur, wenn die Kamera naeher als dieser Abstand ist
type Label = { id: string; text: string; position: THREE.Vector3; color: string; pickable: boolean; important: boolean; maxDistance?: number };

export type Space3DProps = {
    scale: SpaceScale;
    date: Date;
    observer: Observer;
    observerLabel: string;
    stars: StarObject[];
    smallBodies: SmallBodiesFile | null;
    satellites: SatelliteState[];
    tracks: SatelliteTrack[];
    earthPhoto: HTMLCanvasElement | null;
    earthMap: EarthMap | null;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onInfo: (text: string) => void;
};

const RAD = Math.PI / 180;

// Notable objects with distance for the galaxy scale (RA h, Dec deg, ly)
const GALAXY_OBJECTS: [string, string, number, number, number][] = [
    ["dso-M42", "Orion Nebula", 5.588, -5.391, 1344],
    ["dso-M45", "Pleiades", 3.79, 24.117, 444],
    ["dso-M1", "Crab Nebula", 5.575, 22.014, 6500],
    ["dso-M16", "Eagle Nebula", 18.313, -13.79, 7000],
    ["dso-M8", "Lagoon Nebula", 18.06, -24.38, 4100],
    ["dso-M57", "Ring Nebula", 18.893, 33.03, 2570],
    ["dso-M27", "Dumbbell Nebula", 19.993, 22.721, 1360],
    ["dso-M13", "Hercules Cluster", 16.695, 36.467, 25100],
    ["dso-M4", "M4", 16.393, -26.526, 7200],
    ["gal-omega", "Omega Centauri", 13.446, -47.479, 17100],
    ["gal-carina", "Carina Nebula", 10.75, -59.87, 8500],
    ["gal-lmc", "Large Magellanic Cloud", 5.393, -69.756, 163000],
    ["gal-smc", "Small Magellanic Cloud", 0.877, -72.829, 200000],
];

function latLonToVector(lat: number, lon: number, radius: number) {
    // Passt zur UV-Abbildung von THREE.SphereGeometry (Laenge 0 auf +x, 90°W auf +z).
    const phi = lat * RAD;
    const lambda = lon * RAD;
    return new THREE.Vector3(Math.cos(phi) * Math.cos(lambda) * radius, Math.sin(phi) * radius, -Math.cos(phi) * Math.sin(lambda) * radius);
}

function vec(v: Vec3) {
    return new THREE.Vector3(v[0], v[1], v[2]);
}

function line(points: THREE.Vector3[], color: string, opacity: number, dashed = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = dashed
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.02, gapSize: 0.015 })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const object = new THREE.Line(geometry, material);
    if (dashed) object.computeLineDistances();
    return object;
}

function circle(radius: number, color: string, opacity: number, segments = 128) {
    return line(Array.from({ length: segments + 1 }, (_, i) => new THREE.Vector3(Math.cos((i / segments) * Math.PI * 2) * radius, 0, Math.sin((i / segments) * Math.PI * 2) * radius)), color, opacity);
}

// Weiche runde Punkte mit eigener Groesse pro Punkt
function pointCloud(positions: Float32Array, colors: Float32Array, sizes: Float32Array, additive = false) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = clamp(size * (300.0 / -mv.z), 1.5, 18.0);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                float a = smoothstep(0.5, 0.0, d);
                gl_FragColor = vec4(vColor, a);
            }`,
        vertexColors: true,
    });
    return new THREE.Points(geometry, material);
}

function earthTexture(photo: HTMLCanvasElement | null, map: EarthMap | null) {
    // Grundlage: Kontinente aus der Weltkarte; das Satellitenfoto kommt darueber.
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0d2a52";
    ctx.fillRect(0, 0, 2048, 1024);
    if (map) {
        const toX = (lon: number) => ((lon + 180) / 360) * 2048;
        const toY = (lat: number) => ((90 - lat) / 180) * 1024;
        ctx.fillStyle = "#3a6e4f";
        ctx.strokeStyle = "rgba(200,230,210,.5)";
        for (const ring of map.land) {
            ctx.beginPath();
            for (let i = 0; i < ring.length; i += 2) {
                if (i === 0) ctx.moveTo(toX(ring[i]), toY(ring[i + 1]));
                else ctx.lineTo(toX(ring[i]), toY(ring[i + 1]));
            }
            ctx.closePath();
            ctx.fill();
        }
    }
    if (photo) {
        // Luecken im Foto (Polarnacht, fehlende Streifen) zeigen die Karte.
        const base = ctx.getImageData(0, 0, 2048, 1024);
        const scaled = document.createElement("canvas");
        scaled.width = 2048;
        scaled.height = 1024;
        const sctx = scaled.getContext("2d")!;
        sctx.drawImage(photo, 0, 0, 2048, 1024);
        const image = sctx.getImageData(0, 0, 2048, 1024);
        for (let i = 0; i < image.data.length; i += 4) {
            if (image.data[i] + image.data[i + 1] + image.data[i + 2] < 24) {
                image.data[i] = base.data[i];
                image.data[i + 1] = base.data[i + 1];
                image.data[i + 2] = base.data[i + 2];
            }
        }
        ctx.putImageData(image, 0, 0);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function named<T extends THREE.Object3D>(light: T) {
    light.name = "static-light";
    return light;
}

function disposeGroup(group: THREE.Object3D) {
    group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else if (material) {
            (material as THREE.MeshPhongMaterial).map?.dispose();
            material.dispose();
        }
    });
    group.clear();
}

const CAMERA: Record<SpaceScale, { position: Vec3; near: number; far: number; min: number; max: number }> = {
    earth: { position: [2.6, 1.6, 2.2], near: 0.01, far: 3000, min: 1.05, max: 180 },
    solar: { position: [0, 3.5, 5], near: 0.001, far: 5000, min: 0.02, max: 160 },
    stars: { position: [0, 35, 70], near: 0.05, far: 50000, min: 0.5, max: 6000 },
    galaxy: { position: [0, 70, 85], near: 0.05, far: 5000, min: 1, max: 900 },
};

export default function Space3D(props: Space3DProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const labelsRef = useRef<HTMLCanvasElement | null>(null);
    const stateRef = useRef<{
        renderer: THREE.WebGLRenderer;
        camera: THREE.PerspectiveCamera;
        controls: OrbitControls;
        scene: THREE.Scene;
        staticGroup: THREE.Group;
        dynamicGroup: THREE.Group;
        labels: Label[];
        flyTo: { from: THREE.Vector3; to: THREE.Vector3; start: number } | null;
        keys: Set<string>;
    } | null>(null);
    const propsRef = useRef(props);

    useEffect(() => {
        propsRef.current = props;
    });

    // Einmalig: Renderer, Kamera, Steuerung, Schleife
    useEffect(() => {
        const wrapper = wrapperRef.current;
        const labelCanvas = labelsRef.current;
        if (!wrapper || !labelCanvas) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor("#01030b");
        wrapper.insertBefore(renderer.domElement, labelCanvas);
        const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 3000);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        const scene = new THREE.Scene();
        const staticGroup = new THREE.Group();
        const dynamicGroup = new THREE.Group();
        scene.add(staticGroup, dynamicGroup);
        const state = { renderer, camera, controls, scene, staticGroup, dynamicGroup, labels: [] as Label[], flyTo: null as { from: THREE.Vector3; to: THREE.Vector3; start: number } | null, keys: new Set<string>() };
        stateRef.current = state;

        const resize = () => {
            const { width, height } = wrapper.getBoundingClientRect();
            renderer.setSize(width, height);
            camera.aspect = width / Math.max(1, height);
            camera.updateProjectionMatrix();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            labelCanvas.width = Math.floor(width * dpr);
            labelCanvas.height = Math.floor(height * dpr);
            labelCanvas.style.width = `${width}px`;
            labelCanvas.style.height = `${height}px`;
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(wrapper);

        // Tastatur: W/S vor/zurueck, A/D seitlich, Q/E hoch/runter (fliegen)
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
            if ("wasdqe".includes(event.key.toLowerCase())) state.keys.add(event.key.toLowerCase());
        };
        const onKeyUp = (event: KeyboardEvent) => state.keys.delete(event.key.toLowerCase());
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        // Klick (ohne Ziehen) waehlt das naechste beschriftete Objekt.
        let down: { x: number; y: number } | null = null;
        const onPointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
        const onPointerUp = (event: PointerEvent) => {
            if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
            const rect = renderer.domElement.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            let best: { id: string; d: number } | null = null;
            for (const label of state.labels) {
                if (!label.pickable) continue;
                const p = label.position.clone().project(camera);
                if (p.z > 1) continue;
                const sx = ((p.x + 1) / 2) * rect.width;
                const sy = ((1 - p.y) / 2) * rect.height;
                // Planeten und benannte Objekte gewinnen knappe Faelle.
                const d = Math.hypot(sx - x, sy - y) - (label.important ? 6 : 0);
                if (d < 18 && (!best || d < best.d)) best = { id: label.id, d };
            }
            propsRef.current.onSelect(best?.id ?? null);
        };
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointerup", onPointerUp);

        let frame = 0;
        let last = performance.now();
        const loop = (now: number) => {
            frame = requestAnimationFrame(loop);
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            // Fliegen mit der Tastatur: Tempo waechst mit dem Abstand zum Ziel.
            if (state.keys.size) {
                const forward = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
                const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
                const speed = camera.position.distanceTo(controls.target) * 0.9 * dt;
                const move = new THREE.Vector3();
                if (state.keys.has("w")) move.add(forward);
                if (state.keys.has("s")) move.sub(forward);
                if (state.keys.has("d")) move.add(right);
                if (state.keys.has("a")) move.sub(right);
                if (state.keys.has("e")) move.add(camera.up);
                if (state.keys.has("q")) move.sub(camera.up);
                move.multiplyScalar(speed);
                camera.position.add(move);
                controls.target.add(move);
            }
            // Sanft zum gewaehlten Objekt fliegen
            if (state.flyTo) {
                const k = Math.min(1, (now - state.flyTo.start) / 900);
                const eased = k * k * (3 - 2 * k);
                const target = new THREE.Vector3().lerpVectors(state.flyTo.from, state.flyTo.to, eased);
                const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
                controls.target.copy(target);
                camera.position.copy(target).add(offset);
                if (k >= 1) state.flyTo = null;
            }
            controls.update();
            renderer.render(scene, camera);
            drawLabels();
        };

        const drawLabels = () => {
            const ctx = labelCanvas.getContext("2d");
            if (!ctx) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = labelCanvas.width / dpr;
            const height = labelCanvas.height / dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);
            ctx.textBaseline = "middle";
            for (const label of state.labels) {
                const p = label.position.clone().project(camera);
                if (p.z > 1 || p.z < -1) continue;
                const x = ((p.x + 1) / 2) * width;
                const y = ((1 - p.y) / 2) * height;
                if (x < -50 || x > width + 50 || y < -20 || y > height + 20) continue;
                if (!label.text || (label.maxDistance && camera.position.distanceTo(label.position) > label.maxDistance)) continue;
                ctx.font = label.important ? "600 12px ui-sans-serif, system-ui" : "10px ui-sans-serif, system-ui";
                ctx.fillStyle = label.color;
                ctx.fillText(label.text, x + 8, y - 8);
            }
        };
        frame = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            renderer.domElement.removeEventListener("pointerdown", onPointerDown);
            renderer.domElement.removeEventListener("pointerup", onPointerUp);
            controls.dispose();
            disposeGroup(staticGroup);
            disposeGroup(dynamicGroup);
            renderer.dispose();
            renderer.domElement.remove();
            stateRef.current = null;
        };
    }, []);

    // Kamera bei Wechsel des Massstabs zuruecksetzen
    useEffect(() => {
        const state = stateRef.current;
        if (!state) return;
        const config = CAMERA[props.scale];
        state.camera.near = config.near;
        state.camera.far = config.far;
        state.camera.updateProjectionMatrix();
        state.controls.minDistance = config.min;
        state.controls.maxDistance = config.max;
        state.controls.target.set(0, 0, 0);
        if (props.scale === "earth") {
            const home = latLonToVector(props.observer.lat, props.observer.lon, 3.4);
            state.camera.position.copy(home.add(new THREE.Vector3(0, 0.8, 0)));
        } else if (props.scale === "galaxy") {
            // Blick schraeg von oben auf Sonne und Zentrum zugleich
            state.controls.target.set(SUN_GALACTIC_KLY[0] / 2, 0, 0);
            state.camera.position.set(SUN_GALACTIC_KLY[0] / 2, 70, 85);
        } else {
            state.camera.position.set(...config.position);
        }
        state.flyTo = null;
        // Nur beim Wechsel des Massstabs; Standort aendert die Kamera nicht.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.scale]);

    // Statischer Inhalt: aendert sich mit Massstab und Daten, nicht mit jeder Sekunde.
    const dayKey = Math.floor(props.date.getTime() / 3_600_000);
    useEffect(() => {
        const state = stateRef.current;
        if (!state) return;
        disposeGroup(state.staticGroup);
        state.scene.children.filter((child) => child.name === "static-light").forEach((light) => state.scene.remove(light));
        const group = state.staticGroup;
        const { scale } = props;

        if (scale === "earth") {
            const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshPhongMaterial({ map: earthTexture(props.earthPhoto, props.earthMap), shininess: 12, specular: new THREE.Color("#1d3550") }));
            earth.name = "earth";
            group.add(earth);
            const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.025, 64, 48), new THREE.MeshBasicMaterial({ color: "#5aa7ff", transparent: true, opacity: 0.08, side: THREE.BackSide }));
            group.add(atmosphere);
            // Sternenhintergrund in Erd-festen Koordinaten (Himmel dreht mit der Sternzeit)
            const gast = SiderealTime(new Date(dayKey * 3_600_000));
            const background = props.stars.filter((star) => star.magnitude < 5.2);
            const positions = new Float32Array(background.length * 3);
            const colors = new Float32Array(background.length * 3);
            const sizes = new Float32Array(background.length);
            background.forEach((star, i) => {
                const p = latLonToVector(star.dec, (star.ra - gast) * 15, 900);
                positions.set([p.x, p.y, p.z], i * 3);
                const c = new THREE.Color(star.color ?? "#ffffff");
                colors.set([c.r, c.g, c.b], i * 3);
                sizes[i] = Math.max(2, (6 - star.magnitude) * 4);
            });
            group.add(pointCloud(positions, colors, sizes));
            state.scene.add(named(new THREE.AmbientLight("#ffffff", 0.06)));
        }

        if (scale === "solar") {
            const sun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 24), new THREE.MeshBasicMaterial({ color: "#ffd27a" }));
            group.add(sun);
            const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.18 }));
            group.add(glow);
            for (const planet of PLANETS) {
                group.add(line(orbitPoints(planet.body, new Date(dayKey * 3_600_000), planet.periodDays).map(vec), planet.color, 0.35));
            }
            for (const radius of [1, 5, 10, 20, 30]) group.add(circle(radius, "#4f6fa8", 0.12));
            for (const path of smallBodyPaths(props.smallBodies, new Date(dayKey * 3_600_000))) {
                group.add(line(path.orbit.map(vec), path.kind === "comet" ? "#9ff3ff" : "#e5c9ff", 0.07));
            }
            state.scene.add(named(new THREE.PointLight("#fff3d6", 3, 0, 0)));
            state.scene.add(named(new THREE.AmbientLight("#ffffff", 0.25)));
        }

        if (scale === "stars") {
            const known = starsWithDistance(props.stars);
            const positions = new Float32Array(known.length * 3);
            const colors = new Float32Array(known.length * 3);
            const sizes = new Float32Array(known.length);
            known.forEach((star, i) => {
                const p = starPosition(star.ra, star.dec, star.distanceLy!);
                positions.set(p, i * 3);
                const c = new THREE.Color(star.color ?? "#ffffff");
                colors.set([c.r, c.g, c.b], i * 3);
                // Groesse nach absoluter Helligkeit: Riesen leuchten weithin.
                sizes[i] = Math.max(0.5, Math.min(7, (7 - absoluteMagnitude(star.magnitude, star.distanceLy!)) * 0.45));
            });
            group.add(pointCloud(positions, colors, sizes, true));
            const sun = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffd27a" }));
            group.add(sun);
            for (const radius of [10, 50, 100, 500, 1000]) group.add(circle(radius, "#4f6fa8", 0.18));
        }

        if (scale === "galaxy") {
            const { positions, colors } = galaxyParticles();
            const sizes = new Float32Array(positions.length / 3).fill(0.9);
            group.add(pointCloud(positions, colors, sizes, true));
            const sun = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffd27a" }));
            sun.position.copy(vec(SUN_GALACTIC_KLY));
            group.add(sun);
            group.add(circle(26.7, "#4f6fa8", 0.15));
            const local = circle(1, "#ffd27a", 0.6, 48);
            local.position.copy(vec(SUN_GALACTIC_KLY));
            group.add(local);
        }
    // Statischer Inhalt pro Stunde und Datenstand
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.scale, props.stars, props.smallBodies, props.earthPhoto, props.earthMap, dayKey]);

    // Dynamischer Inhalt (Planeten, Mond, Satelliten, Auswahl) mit der Zeit
    const minuteKey = props.scale === "earth" ? Math.floor(props.date.getTime() / 2000) : Math.floor(props.date.getTime() / 60_000);
    useEffect(() => {
        const state = stateRef.current;
        if (!state) return;
        disposeGroup(state.dynamicGroup);
        state.scene.children.filter((child) => child.name === "sunlight").forEach((light) => state.scene.remove(light));
        const group = state.dynamicGroup;
        const labels: Label[] = [];
        const { scale, date, selectedId } = props;
        let selectedPosition: THREE.Vector3 | null = null;
        let info = "";

        if (scale === "earth") {
            const gast = SiderealTime(date);
            // Sonne geozentrisch = minus heliozentrische Erde (aequatorial J2000)
            const earthHelio = HelioVector(Body.Earth, date);
            const sunRa = Math.atan2(-earthHelio.y, -earthHelio.x) / RAD / 15;
            const sunDec = Math.asin(-earthHelio.z / Math.hypot(earthHelio.x, earthHelio.y, earthHelio.z)) / RAD;
            const light = new THREE.DirectionalLight("#fff6e8", 2.2);
            light.name = "sunlight";
            light.position.copy(latLonToVector(sunDec, (sunRa - gast) * 15, 50));
            state.scene.add(light);

            // Mond in echtem Abstand (rund 60 Erdradien)
            const moon = GeoMoon(date);
            const moonKm = Math.hypot(moon.x, moon.y, moon.z) * AU_KM;
            const moonRa = Math.atan2(moon.y, moon.x) / RAD / 15;
            const moonDec = Math.asin(moon.z / Math.hypot(moon.x, moon.y, moon.z)) / RAD;
            const moonPos = latLonToVector(moonDec, (moonRa - gast) * 15, moonKm / EARTH_RADIUS_KM);
            const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2727, 48, 32), new THREE.MeshPhongMaterial({ color: "#d9dbe2" }));
            moonMesh.position.copy(moonPos);
            group.add(moonMesh);
            labels.push({ id: "moon", text: `Moon · ${Math.round(moonKm).toLocaleString("de-CH")} km`, position: moonPos, color: "#e8ecf4", pickable: true, important: true });
            if (selectedId === "moon") { selectedPosition = moonPos; info = `Moon · ${Math.round(moonKm).toLocaleString("de-CH")} km from Earth's centre · ${(moonKm / 299_792.458).toFixed(2)} light-seconds`; }

            // Eigener Standort
            const home = latLonToVector(props.observer.lat, props.observer.lon, 1.003);
            const homeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: "#63ffe3" }));
            homeMesh.position.copy(home);
            group.add(homeMesh);
            labels.push({ id: "home", text: `You · ${props.observerLabel}`, position: home, color: "#63ffe3", pickable: false, important: true });

            // Satelliten in echter Hoehe
            for (const sat of props.satellites) {
                const radius = 1 + sat.heightKm / EARTH_RADIUS_KM;
                const position = latLonToVector(sat.lat, sat.lon, radius);
                const isSelected = sat.id === selectedId;
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(isSelected ? 0.014 : 0.008, 8, 6), new THREE.MeshBasicMaterial({ color: sat.sunlit ? "#e9fbff" : "#7d8aa3" }));
                mesh.position.copy(position);
                group.add(mesh);
                const important = [25544, 48274, 20580].includes(sat.norad);
                labels.push({ id: sat.id, text: important || isSelected ? sat.name.replace(/\s*\(.*\)$/, "") : "", position, color: "#e9fbff", pickable: true, important });
                if (isSelected) {
                    selectedPosition = position;
                    group.add(line([home, position], "#f7c768", 0.9));
                    info = `${sat.name.replace(/\s*\(.*\)$/, "")} · ${Math.round(sat.heightKm)} km above Earth · ${Math.round(sat.rangeKm).toLocaleString("de-CH")} km from you · ${Math.round(sat.speedKms * 3600).toLocaleString("de-CH")} km/h`;
                }
            }
            for (const track of props.tracks) {
                const radius = 1 + track.heightKm / EARTH_RADIUS_KM;
                group.add(line(track.points.map((point) => latLonToVector(point.lat, point.lon, radius)), track.color, 0.55));
            }
        }

        if (scale === "solar") {
            const positions = new Map<string, THREE.Vector3>();
            for (const planet of PLANETS) {
                const position = vec(heliocentric(planet.body, date));
                positions.set(planet.id, position);
                // Planeten stark vergroessert, sonst waeren sie unsichtbar klein.
                const size = Math.max(0.015, Math.min(0.06, (planet.radiusKm / AU_KM) * 600));
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), new THREE.MeshPhongMaterial({ color: planet.color, emissive: planet.color, emissiveIntensity: 0.25 }));
                mesh.position.copy(position);
                group.add(mesh);
                if (planet.id === "saturn") {
                    const ring = new THREE.Mesh(new THREE.RingGeometry(size * 1.4, size * 2.3, 48), new THREE.MeshBasicMaterial({ color: "#e8d9a8", side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
                    ring.position.copy(position);
                    ring.rotation.x = Math.PI / 2.4;
                    group.add(ring);
                }
                labels.push({ id: planet.id, text: planet.name, position, color: "#ffecbe", pickable: true, important: true });
            }
            const earth = positions.get("earth")!;
            // Mond: Abstand 50-fach vergroessert, sonst laege er in der Erde.
            const moonOffset = vec(moonFromEarth(date)).multiplyScalar(50);
            const moonPos = earth.clone().add(moonOffset);
            const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), new THREE.MeshPhongMaterial({ color: "#d9dbe2" }));
            moonMesh.position.copy(moonPos);
            group.add(moonMesh);
            labels.push({ id: "moon", text: "Moon (distance ×50)", position: moonPos, color: "#e8ecf4", pickable: true, important: false, maxDistance: 0.6 });
            labels.push({ id: "sun", text: "Sun", position: new THREE.Vector3(), color: "#ffd27a", pickable: true, important: true });
            for (const path of smallBodyPaths(props.smallBodies, date)) {
                const position = vec(path.position);
                positions.set(path.id, position);
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), new THREE.MeshBasicMaterial({ color: path.kind === "comet" ? "#9ff3ff" : "#e5c9ff" }));
                mesh.position.copy(position);
                group.add(mesh);
                labels.push({ id: path.id, text: path.id === selectedId ? path.name : "", position, color: path.kind === "comet" ? "#9ff3ff" : "#e5c9ff", pickable: true, important: false });
                if (path.id === selectedId) group.add(line(path.orbit.map(vec), path.kind === "comet" ? "#9ff3ff" : "#e5c9ff", 0.8));
            }
            // Auswahl: Linie von der Erde mit Entfernung und Lichtlaufzeit
            const target = selectedId === "sun" ? new THREE.Vector3() : selectedId === "moon" ? moonPos : selectedId ? positions.get(selectedId) : undefined;
            if (target && selectedId !== "earth") {
                selectedPosition = target;
                group.add(line([earth, target], "#f7c768", 0.9));
                const au = selectedId === "moon" ? Math.hypot(...moonFromEarth(date)) : distance([earth.x, earth.y, earth.z], [target.x, target.y, target.z]);
                info = `${selectedId === "sun" ? "Sun" : labels.find((label) => label.id === selectedId)?.text || selectedId} · from Earth ${formatAu(au)}`;
            }
        }

        if (scale === "stars") {
            labels.push({ id: "sun", text: "Sun · you are here", position: new THREE.Vector3(), color: "#ffd27a", pickable: false, important: true });
            for (const radius of [10, 50, 100, 500, 1000]) labels.push({ id: `ring-${radius}`, text: `${radius} ly`, position: new THREE.Vector3(radius, 0, 0), color: "rgba(140,170,255,.6)", pickable: false, important: false });
            for (const star of starsWithDistance(props.stars)) {
                const isSelected = star.id === selectedId;
                if (!isSelected && (star.magnitude > 1.6 || star.name.startsWith("HIP "))) {
                    if (star.magnitude <= 4) labels.push({ id: star.id, text: "", position: vec(starPosition(star.ra, star.dec, star.distanceLy!)), color: "#fff", pickable: true, important: false });
                    continue;
                }
                const position = vec(starPosition(star.ra, star.dec, star.distanceLy!));
                labels.push({ id: star.id, text: `${star.name} · ${Math.round(star.distanceLy!).toLocaleString("de-CH")} ly`, position, color: isSelected ? "#ffe3a6" : "rgba(238,244,255,.85)", pickable: true, important: isSelected });
                if (isSelected) {
                    selectedPosition = position;
                    group.add(line([new THREE.Vector3(), position], "#f7c768", 0.9));
                    const year = date.getUTCFullYear() - Math.round(star.distanceLy!);
                    info = `${star.name} · ${Math.round(star.distanceLy!).toLocaleString("de-CH")} light-years · the light you see left it ${year > 0 ? `in ${year}` : `${Math.abs(year)} BC`}`;
                }
            }
        }

        if (scale === "galaxy") {
            labels.push({ id: "sun", text: "Sun", position: vec(SUN_GALACTIC_KLY), color: "#ffd27a", pickable: false, important: true });
            labels.push({ id: "gc", text: "Galactic centre · Sgr A*", position: new THREE.Vector3(0, 0, 0), color: "#ffcf8a", pickable: false, important: true });
            for (const [id, name, ra, dec, ly] of GALAXY_OBJECTS) {
                const position = vec(galacticPosition(ra, dec, ly));
                const mesh = new THREE.Mesh(new THREE.SphereGeometry(id.startsWith("gal-") && ly > 100000 ? 2.5 : 0.35, 12, 8), new THREE.MeshBasicMaterial({ color: ly > 100000 ? "#b9c8ff" : "#9ff3ff" }));
                mesh.position.copy(position);
                group.add(mesh);
                labels.push({ id, text: name, position, color: "#b8e8ff", pickable: true, important: false });
                if (id === selectedId) {
                    selectedPosition = position;
                    group.add(line([vec(SUN_GALACTIC_KLY), position], "#f7c768", 0.9));
                    info = `${name} · ${ly.toLocaleString("de-CH")} light-years from the Sun`;
                }
            }
            labels.push({ id: "andromeda-dir", text: "→ Andromeda (2.5 million ly)", position: vec(galacticPosition(0.712, 41.269, 400_000)), color: "rgba(200,210,255,.7)", pickable: false, important: false });
        }

        state.labels = labels;
        propsRef.current.onInfo(info);
        if (selectedPosition && scale !== "earth") {
            state.flyTo = { from: state.controls.target.clone(), to: selectedPosition.clone(), start: performance.now() };
        }
    // Pro Minute (Erde: alle 2 s) und bei neuer Auswahl
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.scale, minuteKey, props.selectedId, props.satellites, props.tracks, props.observer, props.stars, props.smallBodies]);

    return (
        <div ref={wrapperRef} className="stars-space">
            <canvas ref={labelsRef} className="stars-space-labels" />
        </div>
    );
}
