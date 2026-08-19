import RadarClient from "./RadarClient";
import AircraftCard from "./AircraftCard";
import LiveFlightIntelligence from "./LiveFlightIntelligence";
import AirportExplorer from "./AirportExplorer";
import "./radar.css";

export default function RadarPage() {
    return (
        <>
            <RadarClient />
            <LiveFlightIntelligence />
            <AircraftCard />
            <AirportExplorer />
        </>
    );
}
