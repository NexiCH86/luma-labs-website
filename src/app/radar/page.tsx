import RadarMapBridge from "./RadarMapBridge";
import RadarClient from "./RadarClient";
import DynamicAirportLayer from "./DynamicAirportLayer";
import AircraftCard from "./AircraftCard";
import LiveFlightIntelligence from "./LiveFlightIntelligence";
import AirportExplorer from "./AirportExplorer";
import AirportRunwayLayer from "./AirportRunwayLayer";
import AirportLiveOperations from "./AirportLiveOperations";
import AirFilters from "./AirFilters";
import SquawkAlerts from "./SquawkAlerts";
import TrailControls from "./TrailControls";
import TrafficDensity from "./TrafficDensity";
import AirspaceLayers from "./AirspaceLayers";
import RadarToolsPanel from "./RadarToolsPanel";
import RadarPanelWindowManager from "./RadarPanelWindowManager";
import "./radar.css";
import "./airport-markers.css";

export default function RadarPage() {
    return (
        <>
            <RadarMapBridge />
            <RadarPanelWindowManager />
            <RadarClient />
            <DynamicAirportLayer />
            <AirportRunwayLayer />
            <AirportLiveOperations />
            <LiveFlightIntelligence />
            <AircraftCard />
            <AirportExplorer />
            <AirFilters />
            <TrailControls />
            <TrafficDensity />
            <AirspaceLayers />
            <RadarToolsPanel />
            <SquawkAlerts />
        </>
    );
}
