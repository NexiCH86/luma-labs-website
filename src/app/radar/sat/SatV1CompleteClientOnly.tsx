"use client";

import dynamic from "next/dynamic";

const SatV1CompletePanel = dynamic(() => import("./SatV1CompletePanel"), {
    ssr: false,
});

export default function SatV1CompleteClientOnly() {
    return <SatV1CompletePanel />;
}
