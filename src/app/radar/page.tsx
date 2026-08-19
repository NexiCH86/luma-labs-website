import RadarMapBridge from "./RadarMapBridge";
import RadarClient from "./RadarClient";
import DynamicAirportLayer from "./DynamicAirportLayer";
import AircraftCard from "./AircraftCard";
import LiveFlightIntelligence from "./LiveFlightIntelligence";
import AirportExplorer from "./AirportExplorer";
import AirportRunwayLayer from "./AirportRunwayLayer";
import AirportLiveOperations from "./AirportLiveOperations";
import AirportWeather from "./AirportWeather";
import AircraftSelectionBridge from "./AircraftSelectionBridge";
import AirFilters from "./AirFilters";
import SquawkAlerts from "./SquawkAlerts";
import TrailControls from "./TrailControls";
import TrafficDensity from "./TrafficDensity";
import AirspaceLayers from "./AirspaceLayers";
import RadarToolsPanel from "./RadarToolsPanel";
import RadarPanelWindowManager from "./RadarPanelWindowManager";
import AirModeStatus from "./AirModeStatus";
import "./radar.css";
import "./airport-markers.css";

export default function RadarPage() {
    return (
        <>
            <RadarMapBridge />
            <RadarPanelWindowManager />
            <RadarClient />
            <AircraftSelectionBridge />
            <DynamicAirportLayer />
            <AirportRunwayLayer />
            <AirportLiveOperations />
            <AirportWeather />
            <LiveFlightIntelligence />
            <AircraftCard />
            <AirportExplorer />
            <AirFilters />
            <TrailControls />
            <TrafficDensity />
            <AirspaceLayers />
            <RadarToolsPanel />
            <SquawkAlerts />
            <AirModeStatus />
        </>
    );
}
