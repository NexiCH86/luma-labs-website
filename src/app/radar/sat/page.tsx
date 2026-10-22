import RadarModeSwitch from "../RadarModeSwitch";
import SatClientOnly from "./SatClientOnly";
import "../radar.css";
import "../radar-mode-switch.css";
import "./sat.css";

export default function SatRadarPage() {
    return (
        <>
            <SatClientOnly />
            <RadarModeSwitch />
        </>
    );
}
