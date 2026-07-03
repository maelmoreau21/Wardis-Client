import React, { useEffect, useState, useMemo } from "react";
import { useEventStore } from "../store/eventStore";
import { useCameraStore } from "../store/cameraStore";
import { useAccessControlStore } from "../store/accessControlStore";
import {
  Radio,
  RefreshCw,
  AlertTriangle,
  Clock,
  Eye,
  Search,
  Trash2,
  Database,
  CheckCircle2,
  XCircle,
  Cpu,
  Workflow,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Building
} from "lucide-react";

// Standard Site Name Mapping
const SITE_NAMES: Record<string, string> = {
  "a0000000-0000-0000-0000-000000000001": "HQ Paris"
};

const getSiteName = (siteId?: string) => {
  if (!siteId) return "Unassigned Site";
  return SITE_NAMES[siteId] || `Site ${siteId.substring(0, 8)}`;
};

export const Events: React.FC = () => {
  const {
    events,
    sseConnected,
    loading,
    error,
    fetchEvents,
    connectEventStream,
    disconnectEventStream,
    clearEvents,
    clearError
  } = useEventStore();

  const { cameras, fetchCameras } = useCameraStore();
  const { doors, fetchDoors } = useAccessControlStore();

  // Filters State
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<"all" | "access" | "alarm" | "video" | "correlation">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Initialize stores and streams
  useEffect(() => {
    fetchEvents();
    fetchCameras().catch(() => {});
    fetchDoors().catch(() => {});
    connectEventStream();

    return () => {
      disconnectEventStream();
    };
  }, [fetchEvents, fetchCameras, fetchDoors, connectEventStream, disconnectEventStream]);

  // Extract unique site IDs dynamically
  const uniqueSites = useMemo(() => {
    const ids = new Set<string>();
    doors.forEach(d => { if (d.site_id) ids.add(d.site_id); });
    cameras.forEach(c => { if (c.site_id) ids.add(c.site_id); });
    events.forEach(e => { if (e.site_id) ids.add(e.site_id); });
    return Array.from(ids).map(id => ({
      id,
      name: getSiteName(id)
    }));
  }, [doors, cameras, events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // 1. Site Filter
      if (selectedSiteId !== "all" && event.site_id !== selectedSiteId) {
        return false;
      }

      // 2. Type Filter
      if (selectedType !== "all") {
        if (selectedType === "access" && !event.event_type.startsWith("access.")) return false;
        if (selectedType === "alarm" && event.event_type !== "alarm.triggered" && event.event_type !== "alarm.acquitted") return false;
        if (selectedType === "video" && !event.event_type.startsWith("video.") && !event.event_type.startsWith("camera.")) return false;
        if (selectedType === "correlation" && event.event_type !== "alarm.correlated") return false;
      }

      // 3. Search Query Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const msgMatch = event.message.toLowerCase().includes(query);
        const typeMatch = event.event_type.toLowerCase().includes(query);
        const badgeMatch = event.badge_number?.toLowerCase().includes(query) || false;
        const camMatch = event.camera_id?.toLowerCase().includes(query) || false;
        const zoneMatch = event.zone_id?.toLowerCase().includes(query) || false;

        if (!msgMatch && !typeMatch && !badgeMatch && !camMatch && !zoneMatch) {
          return false;
        }
      }

      return true;
    });
  }, [events, selectedSiteId, selectedType, searchQuery]);

  const handleToggleExpand = (id: string) => {
    setExpandedEventId(prev => (prev === id ? null : id));
  };

  const handleRefresh = async () => {
    await Promise.all([
      fetchEvents(),
      fetchCameras().catch(() => {}),
      fetchDoors().catch(() => {})
    ]);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-control-panel/30 border border-control-border relative overflow-hidden font-mono text-xs">
      
      {/* Module Title Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-control-border bg-control-panel/40 p-3 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Workflow className="h-4.5 w-4.5 text-control-cyan" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-control-text-bright">
            Events Correlation Feed
          </h2>
          <span className={`text-[9px] px-1.5 py-0.5 font-mono ml-2 ${
            sseConnected 
              ? "bg-control-green/10 border border-control-green/30 text-control-green" 
              : "bg-control-red/10 border border-control-red/30 text-control-red"
          }`}>
            SOCKET GATEWAY: {sseConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1.5 text-[10px] text-control-red px-3 py-1 border border-control-red/20 bg-control-red/5">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{error}</span>
              <button 
                onClick={clearError} 
                className="ml-1 text-control-text hover:text-control-text-bright cursor-pointer"
              >
                [X]
              </button>
            </div>
          )}

          <button
            onClick={clearEvents}
            className="flex items-center gap-1.5 border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 text-control-cyan hover:text-control-cyan-bright py-1.5 px-3 tracking-wider cursor-pointer font-bold transition-all hover:border-control-cyan/60 rounded-none"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>CLEAR FEED</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 text-control-cyan hover:text-control-cyan-bright py-1.5 px-3 tracking-wider cursor-pointer font-bold transition-all hover:border-control-cyan/60 rounded-none disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>SYNC GATEWAY</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Filters Sidebar + Events feed */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* Filters Sidebar */}
        <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-control-border bg-control-panel/20 p-4 shrink-0 flex flex-col gap-4 overflow-y-auto">
          
          {/* Search Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1">
              <Search className="h-3.5 w-3.5" />
              <span>Search Telemetry</span>
            </label>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Query badge, camera, status..."
              className="bg-control-bg border border-control-border text-control-text-bright p-2 text-xs focus:border-control-cyan focus:outline-none placeholder-control-text/30 rounded-none w-full"
            />
          </div>

          {/* Site Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1">
              <Building className="h-3.5 w-3.5" />
              <span>Filter By Site</span>
            </label>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSelectedSiteId("all")}
                className={`w-full text-left px-2.5 py-1.5 border transition-all uppercase tracking-wider font-semibold cursor-pointer ${
                  selectedSiteId === "all"
                    ? "border-control-cyan/40 bg-control-cyan/10 text-control-cyan"
                    : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/30"
                }`}
              >
                [+] All Sites
              </button>
              {uniqueSites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`w-full text-left px-2.5 py-1.5 border transition-all uppercase tracking-wider font-semibold cursor-pointer truncate ${
                    selectedSiteId === site.id
                      ? "border-control-cyan/40 bg-control-cyan/10 text-control-cyan"
                      : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/30"
                  }`}
                  title={site.name}
                >
                  // {site.name}
                </button>
              ))}
            </div>
          </div>

          {/* Event Category Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Event Category</span>
            </label>
            <div className="flex flex-col gap-1">
              {([
                { id: "all", label: "All Telemetry" },
                { id: "access", label: "Access Control" },
                { id: "alarm", label: "Intrusion Alarms" },
                { id: "video", label: "Video Surveillance" },
                { id: "correlation", label: "Correlated Events" }
              ] as const).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedType(cat.id)}
                  className={`w-full text-left px-2.5 py-1.5 border transition-all uppercase tracking-wider font-semibold cursor-pointer ${
                    selectedType === cat.id
                      ? "border-control-cyan/40 bg-control-cyan/10 text-control-cyan"
                      : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/30"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subsystem description footer */}
          <div className="mt-auto hidden md:block p-3 border border-control-border bg-control-panel-light/10 text-[10px] text-control-text/50 leading-relaxed">
            <div className="font-bold text-control-cyan/60 uppercase mb-1">Correlation Engine</div>
            Direct streaming event pipeline receives real-time microservice message triggers via NATS. Alarms are correlated with the closest camera coordinates and active operator authentication logs in matching zones.
          </div>
        </div>

        {/* Live Event Stream View */}
        <div className="flex-1 flex flex-col min-h-0 bg-control-panel/10 overflow-y-auto p-4 gap-3">
          
          <div className="flex items-center justify-between text-[10px] text-control-text/50 border-b border-control-border/30 pb-2">
            <span>SHOWING {filteredEvents.length} OF {events.length} CORRELATED EVENTS</span>
            <div className="flex items-center gap-1.5">
              <Database className="h-3 w-3 text-control-cyan/40" />
              <span>REAL-TIME PIPELINE STREAM</span>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-control-border p-6 text-center select-none">
              <Radio className="h-10 w-10 text-control-text/30 mb-2 animate-pulse" />
              <p className="font-bold text-control-text-bright uppercase">No Events Detected</p>
              <p className="text-[10px] text-control-text/60 max-w-[240px] mt-1 leading-relaxed">
                Waiting for incoming system events on NATS streams. Ensure microservices are active.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => {
                const isExpanded = expandedEventId === event.id;
                
                // Color and Icon coding
                let categoryColor = "border-control-border bg-control-panel-light/20";
                let eventIcon = <Database className="h-4 w-4 text-control-text/50" />;
                let categoryLabel = "SYSTEM INFO";

                if (event.event_type === "alarm.correlated") {
                  categoryColor = "border-control-red bg-control-red/10 animate-glow";
                  eventIcon = <Workflow className="h-4 w-4 text-control-red" />;
                  categoryLabel = "CORRELATED SYSTEM EVENT";
                } else if (event.event_type.startsWith("access.")) {
                  const isGranted = event.event_type === "access.granted";
                  categoryColor = isGranted 
                    ? "border-control-cyan bg-control-cyan/5" 
                    : "border-control-amber bg-control-amber/5";
                  eventIcon = isGranted 
                    ? <CheckCircle2 className="h-4 w-4 text-control-green" /> 
                    : <XCircle className="h-4 w-4 text-control-red" />;
                  categoryLabel = isGranted ? "ACCESS GRANTED" : "ACCESS DENIED";
                } else if (event.event_type === "alarm.triggered") {
                  categoryColor = "border-control-red bg-control-red/10 animate-pulse";
                  eventIcon = <AlertTriangle className="h-4 w-4 text-control-red animate-bounce" />;
                  categoryLabel = "ALARM INTRUSION";
                } else if (event.event_type.startsWith("video.") || event.event_type.startsWith("camera.")) {
                  categoryColor = "border-control-green/30 bg-control-green/5";
                  eventIcon = <Eye className="h-4 w-4 text-control-green" />;
                  categoryLabel = "VIDEO LOG";
                }

                return (
                  <div 
                    key={event.id}
                    className={`border transition-all flex flex-col ${categoryColor}`}
                  >
                    
                    {/* Item Row Header */}
                    <div 
                      onClick={() => handleToggleExpand(event.id)}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-control-panel-light/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">{eventIcon}</div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-control-text-bright font-bold uppercase tracking-wider">
                              {event.message}
                            </span>
                            <span className="text-[8px] font-semibold px-1.5 py-0.5 bg-control-bg/60 border border-control-border/40 text-control-text/70 uppercase">
                              {categoryLabel}
                            </span>
                          </div>
                          
                          {/* Telemetry metadata tags */}
                          <div className="flex items-center gap-4 text-[9px] text-control-text/60 mt-1 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(event.timestamp).toLocaleString()}</span>
                            </div>
                            {event.site_id && (
                              <div>
                                <span className="text-control-cyan">SITE:</span> {getSiteName(event.site_id)}
                              </div>
                            )}
                            {event.badge_number && (
                              <div>
                                <span className="text-control-cyan font-bold">BADGE:</span> #{event.badge_number}
                              </div>
                            )}
                            {event.camera_id && (
                              <div>
                                <span className="text-control-cyan">CAMERA ID:</span> {event.camera_id.substring(0, 8)}...
                              </div>
                            )}
                            {event.zone_id && (
                              <div>
                                <span className="text-control-cyan font-semibold">ZONE:</span> {event.zone_id.substring(0, 8)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expand Chevron */}
                      <div className="self-end sm:self-auto text-control-cyan flex items-center gap-1.5 text-[10px]">
                        <span>DETAILS</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* Expandable JSON Detail Drawer */}
                    {isExpanded && (
                      <div className="border-t border-control-border/40 bg-control-bg p-3 animate-fade-in">
                        <div className="flex items-center justify-between text-[10px] text-control-cyan/60 uppercase font-bold border-b border-control-border/30 pb-1.5 mb-2 font-mono">
                          <span>NATS Transaction Payload Details</span>
                          <span className="flex items-center gap-1">
                            <Cpu className="h-3 w-3 text-control-cyan/50" />
                            ID: {event.id}
                          </span>
                        </div>
                        <pre className="bg-control-panel-light/20 p-3 text-[10px] leading-relaxed text-control-cyan overflow-auto max-h-60 rounded-none font-mono">
                          {JSON.stringify(event.details || event, null, 2)}
                        </pre>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
