import RadarModeSwitch from "../RadarModeSwitch";
import SatClientV2 from "./SatClientV2";
import "../radar.css";
import "../radar-mode-switch.css";
import "./sat.css";
import "./sat-phase2.css";

export default function SatRadarPage() {
    return (
        <>
            <SatClientV2 />
            <RadarModeSwitch />
        </>
    );
}
