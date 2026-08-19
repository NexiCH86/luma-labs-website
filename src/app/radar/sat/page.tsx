import RadarModeSwitch from "../RadarModeSwitch";
import SatClientV2 from "./SatClientV2";
import SatPhase3ClientOnly from "./SatPhase3ClientOnly";
import SatWorkspaceEnhancements from "./SatWorkspaceEnhancements";
import SatTrackedPanel from "./SatTrackedPanel";
import SatWorkspaceBar from "./SatWorkspaceBar";
import SatV1CompleteClientOnly from "./SatV1CompleteClientOnly";
import "../radar.css";
import "../radar-mode-switch.css";
import "./sat.css";
import "./sat-phase2.css";
import "./sat-phase3.css";
import "./sat-workspace.css";
import "./sat-phase4.css";
import "./sat-v1-complete.css";

export default function SatRadarPage() {
    return (
        <>
            <SatClientV2 />
            <SatPhase3ClientOnly />
            <SatWorkspaceEnhancements />
            <SatTrackedPanel />
            <SatWorkspaceBar />
            <SatV1CompleteClientOnly />
            <RadarModeSwitch />
        </>
    );
}
