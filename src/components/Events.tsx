import React, { useEffect, useState, useMemo } from "react";
import { useEventStore } from "../store/eventStore";
import { useCameraStore } from "../store/cameraStore";
import { useAccessControlStore } from "../store/accessControlStore";
import { useWorkspaceStore } from "../store/workspaceStore";
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
  Building,
  Play
} from "lucide-react";

// Standard Site Name Mapping
const SITE_NAMES: Record<string, string> = {
  "a0000000-0000-0000-0000-000000000001": "HQ Paris"
};

const getSiteName = (siteId?: string) => {
  if (!siteId) return "Site non assigné";
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
  const { openTab } = useWorkspaceStore();

  const getCameraForEvent = (event: any) => {
    if (event.camera_id) {
      return cameras.find(c => c.id === event.camera_id);
    }
    if (event.zone_id) {
      return cameras.find(c => c.zone_id === event.zone_id);
    }
    return null;
  };

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
    <div className="flex-1 flex flex-col min-h-0 bg-control-panel/30 border border-control-border relative overflow-hidden">
      
      {/* Module Title Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-control-border bg-control-panel/40 px-4 py-3 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-control-cyan/10 border border-control-cyan/20">
            <Workflow className="h-5 w-5 text-control-cyan" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-control-text-bright leading-tight">
              Journal d'événements
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                sseConnected
                  ? "bg-control-green/10 text-control-green"
                  : "bg-control-red/10 text-control-red"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-control-green" : "bg-control-red"}`} />
                {sseConnected ? "Temps réel connecté" : "Déconnecté"}
              </span>
            </div>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-2 text-sm text-control-red px-3 py-2 rounded-lg border border-control-red/20 bg-control-red/5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
              <button 
                onClick={clearError} 
                className="ml-1 text-control-text hover:text-control-text-bright cursor-pointer p-0.5 rounded"
              >
                ×
              </button>
            </div>
          )}

          <button
            onClick={clearEvents}
            className="flex items-center gap-2 border border-control-border bg-control-panel-light hover:bg-control-panel text-control-text hover:text-control-text-bright py-2 px-4 rounded-lg cursor-pointer font-medium text-sm transition-all min-h-[40px]"
          >
            <Trash2 className="h-4 w-4" />
            <span>Vider le journal</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 border border-control-border bg-control-panel-light hover:bg-control-panel text-control-cyan py-2 px-4 rounded-lg cursor-pointer font-medium text-sm transition-all min-h-[40px] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Filters Sidebar + Events feed */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* Filters Sidebar */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-control-border bg-control-panel/20 p-4 shrink-0 flex flex-col gap-5 overflow-y-auto">
          
          {/* Search Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-control-text flex items-center gap-1.5">
              <Search className="h-4 w-4 text-control-cyan" />
              <span>Rechercher</span>
            </label>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Badge, caméra, statut..."
              className="wardis-input w-full px-3 py-2 text-sm focus:border-control-cyan outline-none"
            />
          </div>

          {/* Site Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-control-text flex items-center gap-1.5">
              <Building className="h-4 w-4 text-control-cyan" />
              <span>Filtrer par site</span>
            </label>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSelectedSiteId("all")}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  selectedSiteId === "all"
                    ? "bg-control-cyan/10 text-control-cyan border border-control-cyan/30"
                    : "text-control-text/70 hover:text-control-text hover:bg-control-panel-light/50 border border-transparent"
                }`}
              >
                Tous les sites
              </button>
              {uniqueSites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer truncate ${
                    selectedSiteId === site.id
                      ? "bg-control-cyan/10 text-control-cyan border border-control-cyan/30"
                      : "text-control-text/70 hover:text-control-text hover:bg-control-panel-light/50 border border-transparent"
                  }`}
                  title={site.name}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>

          {/* Event Category Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-control-text flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 text-control-cyan" />
              <span>Catégorie</span>
            </label>
            <div className="flex flex-col gap-1">
              {([
                { id: "all", label: "Tous les événements" },
                { id: "access", label: "Contrôle d'accès" },
                { id: "alarm", label: "Alarmes intrusion" },
                { id: "video", label: "Vidéosurveillance" },
                { id: "correlation", label: "Événements corrélés" }
              ] as const).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedType(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    selectedType === cat.id
                      ? "bg-control-cyan/10 text-control-cyan border border-control-cyan/30"
                      : "text-control-text/70 hover:text-control-text hover:bg-control-panel-light/50 border border-transparent"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info footer */}
          <div className="mt-auto hidden md:block p-3 rounded-lg border border-control-border bg-control-panel-light/10 text-xs text-control-text/60 leading-relaxed">
            <div className="font-semibold text-control-text/80 mb-1">Moteur de corrélation</div>
            Les événements sont reçus en temps réel via NATS et corrélés avec les zones et les opérateurs actifs.
          </div>
        </div>

        {/* Live Event Stream View */}
        <div className="flex-1 flex flex-col min-h-0 bg-control-panel/10 overflow-y-auto p-4 gap-3">
          
          <div className="flex items-center justify-between text-sm text-control-text/60 border-b border-control-border/30 pb-3">
            <span>{filteredEvents.length} événement{filteredEvents.length !== 1 ? "s" : ""} affiché{filteredEvents.length !== 1 ? "s" : ""} sur {events.length}</span>
            <div className="flex items-center gap-1.5">
              <Database className="h-4 w-4 text-control-cyan/50" />
              <span>Flux en direct</span>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-control-border rounded-xl p-8 text-center select-none bg-control-panel/20">
              <Radio className="h-10 w-10 text-control-text/20 mb-3 animate-pulse" />
              <p className="font-semibold text-control-text-bright text-base">Aucun événement trouvé</p>
              <p className="text-sm text-control-text/60 max-w-[280px] mt-2 leading-relaxed">
                En attente d'événements système. Vérifiez que les microservices sont actifs.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredEvents.map((event) => {
                const isExpanded = expandedEventId === event.id;
                
                // Color and Icon coding
                let categoryColor = "border-control-border bg-control-panel-light/20";
                let eventIcon = <Database className="h-5 w-5 text-control-text/50" />;
                let categoryLabel = "Système";
                let categoryBadgeColor = "bg-control-panel-light text-control-text/70 border-control-border/60";

                if (event.event_type === "alarm.correlated") {
                  categoryColor = "border-control-red/50 bg-control-red/5";
                  eventIcon = <Workflow className="h-5 w-5 text-control-red" />;
                  categoryLabel = "Corrélé";
                  categoryBadgeColor = "bg-control-red/10 text-control-red border-control-red/30";
                } else if (event.event_type.startsWith("access.")) {
                  const isGranted = event.event_type === "access.granted";
                  categoryColor = isGranted 
                    ? "border-control-cyan/30 bg-control-cyan/5" 
                    : "border-control-amber/30 bg-control-amber/5";
                  eventIcon = isGranted 
                    ? <CheckCircle2 className="h-5 w-5 text-control-green" /> 
                    : <XCircle className="h-5 w-5 text-control-red" />;
                  categoryLabel = isGranted ? "Accès accordé" : "Accès refusé";
                  categoryBadgeColor = isGranted
                    ? "bg-control-green/10 text-control-green border-control-green/30"
                    : "bg-control-red/10 text-control-red border-control-red/30";
                } else if (event.event_type === "alarm.triggered") {
                  categoryColor = "border-control-red/50 bg-control-red/5 animate-pulse";
                  eventIcon = <AlertTriangle className="h-5 w-5 text-control-red" />;
                  categoryLabel = "Alarme intrusion";
                  categoryBadgeColor = "bg-control-red/10 text-control-red border-control-red/30";
                } else if (event.event_type.startsWith("video.") || event.event_type.startsWith("camera.")) {
                  categoryColor = "border-control-green/20 bg-control-green/5";
                  eventIcon = <Eye className="h-5 w-5 text-control-green" />;
                  categoryLabel = "Vidéo";
                  categoryBadgeColor = "bg-control-green/10 text-control-green border-control-green/30";
                }

                return (
                  <div 
                    key={event.id}
                    className={`border rounded-xl transition-all flex flex-col ${categoryColor}`}
                  >
                    
                    {/* Item Row Header */}
                    <div 
                      onClick={() => handleToggleExpand(event.id)}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-control-panel-light/10 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">{eventIcon}</div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-control-text-bright font-semibold text-sm">
                              {event.message}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${categoryBadgeColor}`}>
                              {categoryLabel}
                            </span>
                          </div>
                          
                          {/* Metadata tags */}
                          <div className="flex items-center gap-3 text-xs text-control-text/60 mt-1 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{new Date(event.timestamp).toLocaleString()}</span>
                            </div>
                            {event.site_id && (
                              <div>
                                <span className="text-control-cyan">Site :</span> {getSiteName(event.site_id)}
                              </div>
                            )}
                            {event.badge_number && (
                              <div>
                                <span className="text-control-cyan font-medium">Badge :</span> #{event.badge_number}
                              </div>
                            )}
                            {event.camera_id && (
                              <div>
                                <span className="text-control-cyan">Caméra :</span> {event.camera_id.substring(0, 8)}…
                              </div>
                            )}
                            {event.zone_id && (
                              <div>
                                <span className="text-control-cyan">Zone :</span> {event.zone_id.substring(0, 8)}…
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Jump to Timeline button & Expand Chevron */}
                      <div className="self-end sm:self-auto flex items-center gap-3">
                        {getCameraForEvent(event) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const cam = getCameraForEvent(event);
                              if (cam) {
                                openTab("investigation", "Playback/Investigation", {
                                  cameraId: cam.id,
                                  timestamp: event.timestamp
                                });
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-control-cyan/10 hover:bg-control-cyan border border-control-cyan/30 hover:border-control-cyan text-control-cyan hover:text-white rounded-lg text-sm font-medium transition-all cursor-pointer min-h-[36px]"
                            title={`Voir l'enregistrement de ${getCameraForEvent(event)?.nom}`}
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>Voir vidéo</span>
                          </button>
                        )}
                        
                        <div className="text-control-cyan flex items-center gap-1 text-sm cursor-pointer">
                          <span>{isExpanded ? "Réduire" : "Détails"}</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Detail Drawer */}
                    {isExpanded && (
                      <div className="border-t border-control-border/40 bg-control-bg rounded-b-xl p-4">
                        <div className="flex items-center justify-between text-xs text-control-text/60 border-b border-control-border/30 pb-2 mb-3">
                          <span className="font-medium">Détails de l'événement</span>
                          <span className="flex items-center gap-1">
                            <Cpu className="h-3.5 w-3.5 text-control-cyan/50" />
                            ID : {event.id}
                          </span>
                        </div>
                        {/* JSON display: monospace is acceptable here for raw technical payload */}
                        <pre className="bg-control-panel-light/20 p-3 text-xs leading-relaxed text-control-cyan overflow-auto max-h-60 rounded-lg font-mono">
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
