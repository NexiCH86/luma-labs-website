"use client";

import dynamic from "next/dynamic";

const SatPhase3Panel = dynamic(() => import("./SatPhase3Panel"), {
    ssr: false,
    loading: () => null,
});

export default function SatPhase3ClientOnly() {
    return <SatPhase3Panel />;
}
