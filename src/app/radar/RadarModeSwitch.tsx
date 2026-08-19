"use client";

import { usePathname } from "next/navigation";

export default function RadarModeSwitch() {
    const pathname = usePathname();
    const satActive = pathname.startsWith("/radar/sat");
    const starsActive = pathname.startsWith("/radar/stars");
    const airActive = !satActive && !starsActive;

    return (
        <nav className="radar-mode-switch" aria-label="Radar mode">
            <a
                href="/radar"
                className={airActive ? "is-active" : ""}
            >
                AIR
            </a>
            <a
                href="/radar/sat"
                className={satActive ? "is-active sat-active" : ""}
            >
                SAT
            </a>
            <a
                href="/radar/stars"
                className={starsActive ? "is-active stars-active" : ""}
            >
                STARS
            </a>
        </nav>
    );
}
