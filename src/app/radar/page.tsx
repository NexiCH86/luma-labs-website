import RadarClient from "./RadarClient";
import AircraftCard from "./AircraftCard";
import "./radar.css";

export default function RadarPage() {
    return (
        <>
            <RadarClient />
            <AircraftCard />
        </>
    );
}
