import RadarClient from "./RadarClient";
import AircraftCard from "./AircraftCard";
import OpenSkyAirframeDetails from "./OpenSkyAirframeDetails";
import "./radar.css";

export default function RadarPage() {
    return (
        <>
            <RadarClient />
            <AircraftCard />
            <OpenSkyAirframeDetails />
        </>
    );
}
