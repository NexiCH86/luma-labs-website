"use client";

import { usePathname } from "next/navigation";

export default function RadarModeSwitch() {
    const pathname = usePathname();
    const satActive = pathname.startsWith("/radar/sat");

    return (
        <nav className="radar-mode-switch" aria-label="Radar mode">
            <a
                href="/radar"
                className={!satActive ? "is-active" : ""}
            >
                AIR
            </a>
            <a
                href="/radar/sat"
                className={satActive ? "is-active sat-active" : ""}
            >
                SAT
            </a>
        </nav>
    );
}
