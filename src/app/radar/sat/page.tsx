import RadarModeSwitch from "../RadarModeSwitch";
import SatClient from "./SatClient";
import "../radar.css";
import "../radar-mode-switch.css";
import "./sat.css";

export default function SatRadarPage() {
    return (
        <>
            <SatClient />
            <RadarModeSwitch />
        </>
    );
}
