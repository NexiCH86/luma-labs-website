import RadarMapBridge from "./RadarMapBridge";
import RadarClient from "./RadarClient";
import DynamicAirportLayer from "./DynamicAirportLayer";
import AircraftCard from "./AircraftCard";
import LiveFlightIntelligence from "./LiveFlightIntelligence";
import AirportExplorer from "./AirportExplorer";
import "./radar.css";
import "./airport-markers.css";

export default function RadarPage() {
    return (
        <>
            <RadarMapBridge />
            <RadarClient />
            <DynamicAirportLayer />
            <LiveFlightIntelligence />
            <AircraftCard />
            <AirportExplorer />
        </>
    );
}
