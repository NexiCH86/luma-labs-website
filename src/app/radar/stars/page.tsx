import RadarModeSwitch from "../RadarModeSwitch";
import StarsClientOnly from "./StarsClientOnly";
import "../radar.css";
import "../radar-mode-switch.css";
import "./stars.css";

export default function StarsRadarPage() {
    return (
        <>
            <StarsClientOnly />
            <RadarModeSwitch />
        </>
    );
}
