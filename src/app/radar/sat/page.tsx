import RadarModeSwitch from "../RadarModeSwitch";
import SatOrbitAdapter from "./SatOrbitAdapter";
import SatClientV2 from "./SatClientV2";
import SatPhase3ClientOnly from "./SatPhase3ClientOnly";
import SatWorkspaceEnhancements from "./SatWorkspaceEnhancements";
import SatTrackedPanel from "./SatTrackedPanel";
import SatWorkspaceBar from "./SatWorkspaceBar";
import SatWorkspacePolish from "./SatWorkspacePolish";
import SatRealisticOrbitGlobe from "./SatRealisticOrbitGlobe";
import SatPhotorealisticOrbitGlobe from "./SatPhotorealisticOrbitGlobe";
import SatFinalCenter from "./SatFinalCenter";
import "../radar.css";
import "../radar-mode-switch.css";
import "./sat.css";
import "./sat-phase2.css";
import "./sat-phase3.css";
import "./sat-workspace.css";
import "./sat-phase4.css";
import "./sat-v1-complete.css";
import "./sat-realistic-orbit.css";
import "./sat-photorealistic-orbit.css";
import "./sat-final.css";

export default function SatRadarPage() {
    return (
        <>
            <SatOrbitAdapter />
            <SatClientV2 />
            <SatPhase3ClientOnly />
            <SatWorkspaceEnhancements />
            <SatTrackedPanel />
            <SatWorkspaceBar />
            <SatWorkspacePolish />
            <SatRealisticOrbitGlobe />
            <SatPhotorealisticOrbitGlobe />
            <SatFinalCenter />
            <RadarModeSwitch />
        </>
    );
}
