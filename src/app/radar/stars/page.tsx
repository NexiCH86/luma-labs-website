import RadarModeSwitch from "../RadarModeSwitch";
import StarsClient from "./StarsClient";
import "../radar.css";
import "../radar-mode-switch.css";
import "./stars.css";

export default function StarsRadarPage() {
    return (
        <>
            <StarsClient />
            <RadarModeSwitch />
        </>
    );
}
