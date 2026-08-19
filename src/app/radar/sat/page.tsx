import RadarModeSwitch from "../RadarModeSwitch";
import SatClientV2 from "./SatClientV2";
import SatPhase3Panel from "./SatPhase3Panel";
import SatWorkspaceEnhancements from "./SatWorkspaceEnhancements";
import SatTrackedPanel from "./SatTrackedPanel";
import SatWorkspaceBar from "./SatWorkspaceBar";
import "../radar.css";
import "../radar-mode-switch.css";
import "./sat.css";
import "./sat-phase2.css";
import "./sat-phase3.css";
import "./sat-workspace.css";
import "./sat-phase4.css";

export default function SatRadarPage() {
    return (
        <>
            <SatClientV2 />
            <SatPhase3Panel />
            <SatWorkspaceEnhancements />
            <SatTrackedPanel />
            <SatWorkspaceBar />
            <RadarModeSwitch />
        </>
    );
}
