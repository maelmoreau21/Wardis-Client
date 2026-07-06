import React, { useEffect, useState, useMemo } from "react";
import { useAccessControlStore, Door, Cardholder } from "../store/accessControlStore";
import { useAuthStore } from "../store/authStore";
import { useCameraStore } from "../store/cameraStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import { 
  Lock, 
  Unlock, 
  Search, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertCircle,
  Building,
  Key,
  Shield,
  Clock,
  User,
  UserPlus,
  Edit,
  Trash2,
  AlertTriangle,
  Play,
  FileText,
  Mail,
  Briefcase
} from "lucide-react";

// Standard Site Name Mapping
const SITE_NAMES: Record<string, string> = {
  "a0000000-0000-0000-0000-000000000001": "HQ Paris"
};

const getSiteName = (siteId?: string) => {
  if (!siteId) return "Unassigned Site";
  return SITE_NAMES[siteId] || `Site ${siteId.substring(0, 8)}`;
};

// Helper for premium photo resolution
const getAvatarUrl = (photoName: string) => {
  if (photoName === "jean_dupont") {
    return "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80";
  }
  if (photoName === "marie_martin") {
    return "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80";
  }
  if (photoName && photoName.startsWith("http")) {
    return photoName;
  }
  if (photoName && photoName.startsWith("data:image")) {
    return photoName;
  }
  // Silhouette fallback
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280" width="80" height="80"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
};

export const AccessControl: React.FC = () => {
  const { user } = useAuthStore();
  const { cameras } = useCameraStore();
  const { openTab } = useWorkspaceStore();

  const { 
    doors, 
    logs, 
    cardholders,
    loading, 
    error, 
    fetchDoors, 
    openDoor, 
    closeDoor, 
    fetchAccessLogs,
    fetchCardholders,
    createCardholder,
    updateCardholder,
    deleteCardholder,
    swipeBadgeSimulated,
    setDoorStatusSimulated,
    clearError 
  } = useAccessControlStore();

  const [activeSubTab, setActiveSubTab] = useState<"doors" | "history" | "cardholders">("doors");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  
  // History Filters
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterDoorId, setFilterDoorId] = useState<string>("all");
  const [filterBadge, setFilterBadge] = useState<string>("");

  // Cardholders search/editing
  const [cardholderSearch, setCardholderSearch] = useState<string>("");
  const [selectedChId, setSelectedChId] = useState<string | null>(null);
  const [isEditingCh, setIsEditingCh] = useState<boolean>(false);
  const [isCreatingCh, setIsCreatingCh] = useState<boolean>(false);

  // Form states
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhoto, setFormPhoto] = useState("default");
  const [formAccessGroup, setFormAccessGroup] = useState("Standard");
  const [formSchedule, setFormSchedule] = useState("24h/24");
  const [formBadgeNumber, setFormBadgeNumber] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    fetchDoors();
    if (isAdmin) {
      fetchAccessLogs();
      fetchCardholders();
    }
  }, [fetchDoors, fetchAccessLogs, fetchCardholders, isAdmin]);

  const handleRefresh = async () => {
    await fetchDoors();
    if (isAdmin) {
      await fetchAccessLogs();
      await fetchCardholders();
    }
  };

  const handleToggleDoor = async (door: Door) => {
    if (!isAdmin) return;
    try {
      if (door.status === "open") {
        await closeDoor(door.id);
      } else {
        await openDoor(door.id);
      }
    } catch (e) {
      console.error("Failed to toggle door status", e);
    }
  };

  // Get unique sites from doors list
  const sitesList = useMemo(() => {
    const ids = new Set<string>();
    doors.forEach(d => {
      if (d.site_id) ids.add(d.site_id);
    });
    return Array.from(ids).map(id => ({
      id,
      name: getSiteName(id)
    }));
  }, [doors]);

  // Filter doors
  const filteredDoors = useMemo(() => {
    if (selectedSiteId === "all") return doors;
    return doors.filter(d => d.site_id === selectedSiteId);
  }, [doors, selectedSiteId]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterDate) {
        const logDateStr = new Date(log.created_at).toISOString().split("T")[0];
        if (logDateStr !== filterDate) return false;
      }
      if (filterDoorId !== "all" && log.door_id !== filterDoorId) {
        return false;
      }
      if (filterBadge && !log.badge_number.toLowerCase().includes(filterBadge.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, filterDate, filterDoorId, filterBadge]);

  // Helper to map door ID to name
  const doorNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    doors.forEach(d => {
      map[d.id] = d.name;
    });
    return map;
  }, [doors]);

  // Selected Cardholder object
  const selectedCh = useMemo(() => {
    return cardholders.find(c => c.id === selectedChId) || null;
  }, [cardholders, selectedChId]);

  // Filtered cardholders
  const filteredCardholders = useMemo(() => {
    return cardholders.filter(c => {
      const q = cardholderSearch.toLowerCase();
      return (
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.badge_number && c.badge_number.toLowerCase().includes(q))
      );
    });
  }, [cardholders, cardholderSearch]);

  // Handle opening video timeline for nearest camera at matching timestamp
  const handleJumpToCamera = (doorId?: string, timestamp?: string) => {
    if (!doorId || !timestamp) return;
    const door = doors.find(d => d.id === doorId);
    if (!door) return;

    // Find the camera that shares the same zone_id, or fallback to first camera
    const assocCam = cameras.find(c => c.zone_id === door.zone_id) || cameras[0];
    if (assocCam) {
      openTab("investigation", "Playback/Investigation", {
        cameraId: assocCam.id,
        timestamp: timestamp
      });
    }
  };

  const handleEditClick = (ch: Cardholder) => {
    setSelectedChId(ch.id);
    setFormFirstName(ch.first_name);
    setFormLastName(ch.last_name);
    setFormCompany(ch.company || "");
    setFormEmail(ch.email || "");
    setFormPhoto(ch.photo || "default");
    setFormAccessGroup(ch.access_group || "Standard");
    setFormSchedule(ch.schedule || "24h/24");
    setFormBadgeNumber(ch.badge_number || "");
    setIsEditingCh(true);
    setIsCreatingCh(false);
  };

  const handleAddNewClick = () => {
    setFormFirstName("");
    setFormLastName("");
    setFormCompany("");
    setFormEmail("");
    setFormPhoto("default");
    setFormAccessGroup("Standard");
    setFormSchedule("24h/24");
    setFormBadgeNumber("");
    setIsEditingCh(false);
    setIsCreatingCh(true);
  };

  const handleSaveCardholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName || !formLastName) return;

    const payload = {
      first_name: formFirstName,
      last_name: formLastName,
      company: formCompany,
      email: formEmail,
      photo: formPhoto,
      access_group: formAccessGroup,
      schedule: formSchedule,
      badge_number: formBadgeNumber
    };

    try {
      if (isCreatingCh) {
        await createCardholder(payload);
      } else if (isEditingCh && selectedChId) {
        await updateCardholder(selectedChId, payload);
      }
      setIsEditingCh(false);
      setIsCreatingCh(false);
      await fetchCardholders();
      await fetchAccessLogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCardholder = async (id: string) => {
    if (confirm("Confirmer la suppression de ce titulaire ?")) {
      try {
        await deleteCardholder(id);
        setSelectedChId(null);
        setIsEditingCh(false);
        setIsCreatingCh(false);
        await fetchCardholders();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-control-panel/30 border border-control-border relative overflow-hidden">
      
      {/* Control bar / Sub-Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-control-border bg-control-panel/40 p-3 gap-3 shrink-0">
        
        {/* Sub tabs */}
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setActiveSubTab("doors")}
            className={`px-4 py-2 rounded-lg transition-all font-medium cursor-pointer min-h-[40px] ${
              activeSubTab === "doors"
                ? "bg-control-cyan/10 border border-control-cyan/30 text-control-cyan"
                : "border border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35"
            }`}
          >
            Points d'accès
          </button>
          
          <button
            onClick={() => {
              if (!isAdmin) return;
              setActiveSubTab("history");
            }}
            disabled={!isAdmin}
            className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-1.5 min-h-[40px] ${
              !isAdmin ? "opacity-40 cursor-not-allowed border border-transparent text-control-text/40" :
              activeSubTab === "history"
                ? "bg-control-cyan/10 border border-control-cyan/30 text-control-cyan"
                : "border border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35 cursor-pointer"
            }`}
          >
            Historique des accès
            {!isAdmin && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-control-red/10 border border-control-red/30 text-control-red">
                Restreint
              </span>
            )}
          </button>

          <button
            onClick={() => {
              if (!isAdmin) return;
              setActiveSubTab("cardholders");
            }}
            disabled={!isAdmin}
            className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-1.5 min-h-[40px] ${
              !isAdmin ? "opacity-40 cursor-not-allowed border border-transparent text-control-text/40" :
              activeSubTab === "cardholders"
                ? "bg-control-cyan/10 border border-control-cyan/30 text-control-cyan"
                : "border border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35 cursor-pointer"
            }`}
          >
            Titulaires de badges
            {!isAdmin && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-control-red/10 border border-control-red/30 text-control-red">
                Restreint
              </span>
            )}
          </button>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-2 text-sm text-control-red px-3 py-2 rounded-lg border border-control-red/20 bg-control-red/5">
              <AlertCircle className="h-4 w-4 shrink-0" />
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
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 border border-control-border bg-control-panel-light hover:bg-control-panel text-control-cyan text-sm py-2 px-4 cursor-pointer font-medium transition-all rounded-lg disabled:opacity-50 min-h-[40px]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* 1. Doors View */}
      {activeSubTab === "doors" && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* Site Selector Sidebar */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-control-border bg-control-panel/20 p-4 shrink-0">
            <div className="flex items-center gap-1.5 text-control-text-bright font-semibold mb-4 border-b border-control-border/40 pb-2">
              <Building className="h-4 w-4 text-control-cyan" />
              <span>Sites</span>
            </div>
            
            <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
              <button
                onClick={() => setSelectedSiteId("all")}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap md:whitespace-normal cursor-pointer ${
                  selectedSiteId === "all"
                    ? "bg-control-cyan/10 border border-control-cyan/30 text-control-cyan"
                    : "border border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/30"
                }`}
              >
                Tous les sites ({doors.length})
              </button>
              
              {sitesList.map((site) => {
                const count = doors.filter(d => d.site_id === site.id).length;
                return (
                  <button
                    key={site.id}
                    onClick={() => setSelectedSiteId(site.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap md:whitespace-normal cursor-pointer ${
                      selectedSiteId === site.id
                        ? "bg-control-cyan/10 border border-control-cyan/30 text-control-cyan"
                        : "border border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/30"
                    }`}
                  >
                    {site.name} ({count})
                  </button>
                );
              })}
            </div>

            <div className="hidden md:block mt-6 p-3 rounded-lg border border-control-border bg-control-panel-light/10 text-xs text-control-text/60 leading-relaxed">
              <div className="font-semibold text-control-text/80 mb-1">Simulateur d'accès</div>
              Utilisez les contrôles rapides sur chaque porte pour simuler des passages de badges, des ouvertures forcées ou des alarmes de porte restée ouverte trop longtemps.
            </div>
          </div>

          {/* Doors Grid View */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0">
            {filteredDoors.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-control-border rounded-xl bg-control-panel/20">
                <AlertCircle className="h-10 w-10 text-control-text/30 mb-3" />
                <div className="text-base font-semibold text-control-text-bright">Aucune porte trouvée</div>
                <div className="text-sm text-control-text/60 mt-1.5 max-w-xs leading-relaxed">
                  Vérifiez que le service de contrôle d'accès est actif et synchronisé.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredDoors.map((door) => {
                  const isOpen = door.status === "open";
                  const isForced = door.status === "forced";
                  const isHeld = door.status === "held_open";

                  // Resolve 3 recent logs for this door
                  const doorRecentLogs = logs
                    .filter(log => log.door_id === door.id)
                    .slice(0, 3);

                  // Colors for statuses
                  let statusText = "Fermée (Verrouillée)";
                  let statusColor = "bg-control-red/10 border-control-red text-control-red";
                  let borderLineColor = "bg-control-red";
                  let IconComponent = Lock;

                  if (isOpen) {
                    statusText = "Déverrouillée (Ouverte)";
                    statusColor = "bg-control-green/10 border-control-green text-control-green";
                    borderLineColor = "bg-control-green";
                    IconComponent = Unlock;
                  } else if (isForced) {
                    statusText = "OUVERTURE FORCÉE (ALARME)";
                    statusColor = "bg-control-red bg-red-600/30 border-red-500 text-red-200 animate-pulse";
                    borderLineColor = "bg-red-600 animate-pulse";
                    IconComponent = AlertTriangle;
                  } else if (isHeld) {
                    statusText = "Maintien alarme";
                    statusColor = "bg-control-amber/10 border-control-amber text-control-amber animate-pulse";
                    borderLineColor = "bg-control-amber";
                    IconComponent = Clock;
                  }

                  return (
                    <div 
                      key={door.id}
                      className="bg-control-panel border border-control-border rounded-xl overflow-hidden p-4 flex flex-col justify-between min-h-[300px] relative group shadow-sm hover:border-control-cyan/45 transition-all duration-200"
                    >
                      {/* Top status indicator line */}
                      <div className={`absolute top-0 left-0 right-0 h-[3px] ${borderLineColor}`} />

                      <div>
                        {/* Door Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-control-text-bright">
                              {door.name}
                            </h3>
                            <span className="text-xs text-control-text/50">
                              {getSiteName(door.site_id)}
                            </span>
                          </div>
                          
                          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 border font-medium rounded-full ${statusColor}`}>
                            <IconComponent className="h-3.5 w-3.5" />
                            <span>{statusText}</span>
                          </div>
                        </div>

                        {door.description && (
                          <p className="text-control-text/60 text-[10px] mt-2 italic">
                            "{door.description}"
                          </p>
                        )}

                        {/* Recent logs inside card */}
                        <div className="mt-4">
                          <h4 className="text-xs font-medium text-control-text-bright mb-2 border-b border-control-border/40 pb-1">
                            Historique récent
                          </h4>
                          {doorRecentLogs.length === 0 ? (
                            <div className="text-[10px] text-control-text/40 italic py-1">
                              Aucune activité récente.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {doorRecentLogs.map((log) => {
                                const isLogGranted = log.access_type === "granted";
                                return (
                                  <div 
                                    key={log.id} 
                                    className="flex items-center justify-between bg-control-bg/40 border border-control-border/50 rounded p-1.5 text-[10px] hover:border-control-cyan/30"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <img 
                                        src={getAvatarUrl(log.cardholder_photo || "")}
                                        alt={log.cardholder_name || "Silhouette"}
                                        className="h-6 w-6 rounded-full border border-control-border object-cover bg-control-panel-light"
                                      />
                                      <div className="truncate">
                                        <div className="font-semibold text-control-text-bright truncate">
                                          {log.cardholder_name || `Badge #${log.badge_number}`}
                                        </div>
                                        <div className="text-[8px] text-control-text/50">
                                          {new Date(log.created_at).toLocaleTimeString()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                                        isLogGranted 
                                          ? "bg-control-green/5 border-control-green/30 text-control-green" 
                                          : "bg-control-red/5 border-control-red/30 text-control-red"
                                      }`}>
                                        {isLogGranted ? "Accordé" : "Refusé"}
                                      </span>
                                      
                                      {/* Video timeline link */}
                                      <button
                                        onClick={() => handleJumpToCamera(door.id, log.created_at)}
                                        className="p-1 hover:bg-control-panel-light border border-control-border rounded text-control-cyan hover:text-control-cyan-light transition cursor-pointer"
                                        title="Voir l'enregistrement vidéo lié"
                                      >
                                        <Play className="h-2.5 w-2.5 fill-control-cyan" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Commands and Simulation controls */}
                      <div className="mt-4 pt-3 border-t border-control-border/40 space-y-3">
                        {/* Operator Actions */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-control-text/60">
                            Contrôles opérateur
                          </span>
                          
                          <button
                            onClick={() => handleToggleDoor(door)}
                            disabled={!isAdmin || loading}
                            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 border transition-all rounded-lg min-h-[40px] ${
                              !isAdmin
                                ? "bg-control-panel-light/30 border-control-border text-control-text/40 cursor-not-allowed opacity-55"
                                : door.status === "open"
                                  ? "bg-control-amber/5 border-control-amber/60 hover:border-control-amber hover:bg-control-amber/15 text-control-amber cursor-pointer"
                                  : "bg-control-green/5 border-control-green/60 hover:border-control-green hover:bg-control-green/15 text-control-green cursor-pointer"
                            }`}
                          >
                            {door.status === "open" ? (
                              <>
                                <Lock className="h-4 w-4" />
                                <span>Verrouiller</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="h-4 w-4" />
                                <span>Déverrouiller</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Simulation controls (Admin only) */}
                        {isAdmin && (
                          <div className="grid grid-cols-2 gap-2 bg-control-bg/60 p-2 border border-control-border rounded-lg">
                            <div className="col-span-2 flex items-center justify-between text-[8px] text-control-text/40 font-bold uppercase tracking-wider border-b border-control-border/20 pb-1 mb-1">
                              <span>Simulateur Matériel</span>
                            </div>

                            {/* Simulated Swipes */}
                            <div className="col-span-2 flex gap-1.5 items-center">
                              <select 
                                id={`badge-sim-${door.id}`}
                                className="flex-1 bg-control-panel-light border border-control-border text-control-text-bright rounded p-1 text-[9px] focus:outline-none"
                              >
                                {cardholders.map(c => (
                                  <option key={c.id} value={c.badge_number}>
                                    {c.first_name} {c.last_name} ({c.badge_number || "No badge"})
                                  </option>
                                ))}
                                <option value="BADGE_INVALID">Badge inconnu / erroné</option>
                              </select>
                              <button
                                onClick={() => {
                                  const selectEl = document.getElementById(`badge-sim-${door.id}`) as HTMLSelectElement;
                                  if (selectEl) {
                                    swipeBadgeSimulated(door.id, selectEl.value);
                                  }
                                }}
                                className="bg-control-cyan hover:bg-control-cyan-light text-black font-bold uppercase px-2 py-1 rounded text-[9px] cursor-pointer"
                              >
                                Swipe
                              </button>
                            </div>

                            {/* Trigger Alarms */}
                            <button
                              onClick={() => {
                                if (isForced) {
                                  setDoorStatusSimulated(door.id, "closed");
                                } else {
                                  setDoorStatusSimulated(door.id, "forced");
                                }
                              }}
                              className={`py-1 text-[9px] border font-bold uppercase rounded ${
                                isForced
                                  ? "bg-control-red text-white border-transparent"
                                  : "border-control-border hover:bg-control-red/10 text-control-red"
                              }`}
                            >
                              {isForced ? "Acquitter Forçage" : "Simuler Forçage"}
                            </button>

                            <button
                              onClick={() => {
                                if (isHeld) {
                                  setDoorStatusSimulated(door.id, "closed");
                                } else {
                                  setDoorStatusSimulated(door.id, "held_open");
                                }
                              }}
                              className={`py-1 text-[9px] border font-bold uppercase rounded ${
                                isHeld
                                  ? "bg-control-amber text-white border-transparent"
                                  : "border-control-border hover:bg-control-amber/10 text-control-amber"
                              }`}
                            >
                              {isHeld ? "Fermer Porte" : "Simuler Maintenue"}
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Access History Logs view (Admin only) */}
      {activeSubTab === "history" && (
        <div className="flex-1 flex flex-col min-h-0 p-4 text-sm">
          
          {/* Table Filters Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-control-panel/20 border border-control-border p-3 mb-4 rounded-lg">
            
            {/* Date Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-control-text flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-control-cyan" />
                <span>Filtrer par date</span>
              </label>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-control-bg border border-control-border text-control-text-bright p-2 text-xs focus:border-control-cyan focus:outline-none rounded"
              />
            </div>

            {/* Door Selector Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-control-text flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-control-cyan" />
                <span>Filtrer par porte</span>
              </label>
              <select
                value={filterDoorId}
                onChange={(e) => setFilterDoorId(e.target.value)}
                className="bg-control-bg border border-control-border text-control-text-bright p-2 text-sm focus:border-control-cyan focus:outline-none rounded-lg"
              >
                <option value="all">Toutes les portes</option>
                {doors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({getSiteName(d.site_id)})
                  </option>
                ))}
              </select>
            </div>

            {/* Badge Search Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-control-text flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-control-cyan" />
                <span>Rechercher par badge</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={filterBadge}
                  onChange={(e) => setFilterBadge(e.target.value)}
                  placeholder="Numéro de badge..."
                  className="w-full bg-control-bg border border-control-border text-control-text-bright p-2 pr-8 text-sm focus:border-control-cyan focus:outline-none rounded-lg placeholder-control-text/30"
                />
                <Filter className="absolute right-2.5 top-2.5 h-4 w-4 text-control-text/40" />
              </div>
            </div>

          </div>

          {/* Logs Table Area */}
          <div className="flex-1 border border-control-border bg-control-panel/10 overflow-auto min-h-0 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-control-panel-light z-10 border-b border-control-border">
                <tr className="text-xs text-control-text/70 font-medium">
                  <th className="p-3 text-left">Horodatage</th>
                  <th className="p-3 text-left">Titulaire</th>
                  <th className="p-3 text-left">Porte</th>
                  <th className="p-3 text-left">Site</th>
                  <th className="p-3 text-left">N° Badge</th>
                  <th className="p-3 text-center">Vidéo</th>
                  <th className="p-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control-border/30">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-control-text/50 text-sm">
                      Aucun enregistrement ne correspond aux filtres actifs.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isGranted = log.access_type === "granted";
                    const formattedTime = new Date(log.created_at).toLocaleString();
                    const doorName = log.door_id ? (doorNameMap[log.door_id] || `Porte ${log.door_id.substring(0, 8)}`) : "N/A";
                    const siteName = getSiteName(log.site_id || undefined);

                    return (
                      <tr 
                        key={log.id} 
                        className="hover:bg-control-panel-light/20 transition-colors"
                      >
                        <td className="p-3 text-control-text-bright whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-control-text/40" />
                            <span>{formattedTime}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <img 
                              src={getAvatarUrl(log.cardholder_photo || "")}
                              alt={log.cardholder_name || "Silhouette"}
                              className="h-6 w-6 rounded-full border border-control-border object-cover bg-control-panel-light"
                            />
                            <span className="font-semibold text-control-text-bright">
                              {log.cardholder_name || "Inconnu / Non enregistré"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 font-medium text-control-text-bright">
                          {doorName}
                        </td>
                        <td className="p-3 text-control-text/80">
                          {siteName}
                        </td>
                        <td className="p-3 text-control-cyan">
                          {log.badge_number}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleJumpToCamera(log.door_id || undefined, log.created_at)}
                            className="p-1.5 bg-control-panel-light border border-control-border rounded-lg text-control-cyan hover:text-control-cyan-light transition cursor-pointer inline-flex items-center justify-center"
                            title="JUMP TO VIDEO PLAYBACK TIMELINE"
                          >
                            <Play className="h-3 w-3 fill-control-cyan" />
                          </button>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full ${
                            isGranted 
                              ? "bg-control-green/10 border-control-green/30 text-control-green" 
                              : "bg-control-red/10 border-control-red/30 text-control-red"
                          }`}>
                            {isGranted ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Accordé</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Refusé {log.denied_reason ? `— ${log.denied_reason}` : ""}</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-3 text-xs text-control-text/50">
            <div>
              {filteredLogs.length} enregistrement{filteredLogs.length !== 1 ? "s" : ""} sur {logs.length} au total
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-control-cyan/40" />
              <span>Journal d'audit sécurisé</span>
            </div>
          </div>

        </div>
      )}

      {/* 3. Cardholders CRUD View (Admin only) */}
      {activeSubTab === "cardholders" && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden text-sm">
          
          {/* Cardholders list sidebar */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-control-border bg-control-panel/20 p-4 shrink-0 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 border-b border-control-border/40 pb-2">
              <span className="text-control-text-bright font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-control-cyan" />
                <span>Titulaires de badges</span>
              </span>
              <button
                onClick={handleAddNewClick}
                className="flex items-center gap-1.5 border border-control-cyan/60 hover:border-control-cyan bg-control-cyan/10 text-control-cyan text-sm py-1.5 px-3 rounded-lg font-medium cursor-pointer transition min-h-[36px]"
              >
                <UserPlus className="h-4 w-4" />
                <span>Nouveau</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-control-text/40" />
              <input
                type="text"
                value={cardholderSearch}
                onChange={(e) => setCardholderSearch(e.target.value)}
                placeholder="Rechercher titulaire..."
                className="w-full bg-control-bg border border-control-border text-control-text-bright p-2 pl-9 pr-3 text-xs focus:border-control-cyan focus:outline-none rounded placeholder-control-text/30"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredCardholders.length === 0 ? (
                <div className="text-center text-control-text/50 py-8 text-sm border border-control-border rounded-xl bg-control-panel/20">
                  Aucun titulaire enregistré
                </div>
              ) : (
                filteredCardholders.map((ch) => {
                  const isSelected = selectedChId === ch.id;
                  return (
                    <div
                      key={ch.id}
                      onClick={() => {
                        setSelectedChId(ch.id);
                        setIsEditingCh(false);
                        setIsCreatingCh(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition ${
                        isSelected
                          ? "border-control-cyan bg-control-cyan/5 text-control-cyan"
                          : "border-control-border hover:bg-control-panel-light/30 text-control-text hover:text-control-text-bright"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img 
                          src={getAvatarUrl(ch.photo || "")}
                          alt={`${ch.first_name} ${ch.last_name}`}
                          className="h-8 w-8 rounded-full border border-control-border object-cover bg-control-panel-light shrink-0"
                        />
                        <div className="truncate">
                          <div className="font-bold text-[11px] truncate">
                            {ch.first_name} {ch.last_name}
                          </div>
                          <div className="text-[9px] text-control-text/40 truncate">
                            {ch.company || "No Company"} | #{ch.badge_number || "Pas de badge"}
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick action edit */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(ch);
                        }}
                        className="p-1 hover:bg-control-panel-light border border-control-border/60 hover:border-control-cyan rounded text-control-text hover:text-control-cyan transition shrink-0 cursor-pointer"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Details / Editor Canvas */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isEditingCh || isCreatingCh ? (
              <form onSubmit={handleSaveCardholder} className="max-w-xl bg-control-panel/50 border border-control-border rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-control-cyan uppercase tracking-widest border-b border-control-border/40 pb-2 mb-4 flex items-center gap-1.5">
                  <UserPlus className="h-4.5 w-4.5" />
                  <span>{isCreatingCh ? "Créer une fiche titulaire" : "Éditer la fiche titulaire"}</span>
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-control-text/60 uppercase font-bold">Prénom</label>
                    <input
                      type="text"
                      required
                      value={formFirstName}
                      onChange={(e) => setFormFirstName(e.target.value)}
                      placeholder="Jean"
                      className="bg-control-bg border border-control-border text-control-text-bright p-2 rounded focus:border-control-cyan outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-control-text/60 uppercase font-bold">Nom de famille</label>
                    <input
                      type="text"
                      required
                      value={formLastName}
                      onChange={(e) => setFormLastName(e.target.value)}
                      placeholder="Dupont"
                      className="bg-control-bg border border-control-border text-control-text-bright p-2 rounded focus:border-control-cyan outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-control-text/60 uppercase font-bold">Entreprise / Société</label>
                    <input
                      type="text"
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      placeholder="Wardis"
                      className="bg-control-bg border border-control-border text-control-text-bright p-2 rounded focus:border-control-cyan outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-control-text/60 uppercase font-bold">Adresse Email</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="jean.dupont@wardis.local"
                      className="bg-control-bg border border-control-border text-control-text-bright p-2 rounded focus:border-control-cyan outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-control-text/60 uppercase font-bold">Identifiant / N° de Badge</label>
                    <input
                      type="text"
                      required
                      value={formBadgeNumber}
                      onChange={(e) => setFormBadgeNumber(e.target.value)}
                      placeholder="Ex: BADGE123"
                      className="bg-control-bg border border-control-border text-control-text-bright p-2 rounded focus:border-control-cyan outline-none font-mono uppercase"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-control-text/60 uppercase font-bold">Photo de Profil</label>
                    <select
                      value={formPhoto}
                      onChange={(e) => setFormPhoto(e.target.value)}
                      className="bg-control-bg border border-control-border text-control-text-bright p-2 rounded focus:border-control-cyan outline-none"
                    >
                      <option value="default">Silhouette Standard</option>
                      <option value="jean_dupont">Avatar Homme (Jean)</option>
                      <option value="marie_martin">Avatar Femme (Marie)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-control-text/60 uppercase font-bold">Groupe d'accès autorisé</label>
                    <select
                      value={formAccessGroup}
                      onChange={(e) => setFormAccessGroup(e.target.value)}
                      className="bg-control-bg border border-control-border text-control-text-bright p-2 rounded focus:border-control-cyan outline-none"
                    >
                      <option value="Tous les accès">Tous les accès (Total)</option>
                      <option value="IT Staff">IT Staff / Salles serveurs</option>
                      <option value="Visiteurs">Visiteurs temporaires</option>
                      <option value="Standard">Standard / Entrées principales</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-control-text/60 uppercase font-bold">Plage horaire autorisée</label>
                    <select
                      value={formSchedule}
                      onChange={(e) => setFormSchedule(e.target.value)}
                      className="bg-control-bg border border-control-border text-control-text-bright p-2 rounded focus:border-control-cyan outline-none"
                    >
                      <option value="24h/24">24h/24 (Permanent)</option>
                      <option value="Heures de bureau 08h-18h">Heures de bureau (08h-18h)</option>
                      <option value="Weekends">Weekends uniquement</option>
                      <option value="Heures creuses 18h-08h">Heures creuses / De nuit</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-control-border/40">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingCh(false);
                      setIsCreatingCh(false);
                    }}
                    className="px-4 py-2 border border-control-border hover:bg-control-panel-light text-control-text hover:text-control-text-bright rounded font-bold uppercase transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-control-cyan hover:bg-control-cyan-light text-black rounded font-bold uppercase transition cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            ) : selectedCh ? (
              /* Detail Fiche */
              <div className="max-w-xl bg-control-panel border border-control-border rounded-xl p-6 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-control-cyan" />
                
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Photo Profile */}
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <img 
                      src={getAvatarUrl(selectedCh.photo || "")}
                      alt={`${selectedCh.first_name} ${selectedCh.last_name}`}
                      className="h-28 w-28 rounded-xl border border-control-border object-cover bg-control-bg shadow-inner shadow-black/40"
                    />
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-control-cyan/10 border-control-cyan/30 text-control-cyan">
                      {selectedCh.access_group || "Standard"}
                    </span>
                  </div>

                  {/* Informational file */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-control-text-bright">
                        {selectedCh.first_name} {selectedCh.last_name}
                      </h2>
                      <p className="text-xs text-control-text/40 mt-0.5">
                        Réf. {selectedCh.id.substring(0, 12)}...
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-b border-control-border/40 py-3 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-control-text/70">
                          <Briefcase className="h-4 w-4 text-control-cyan/70 shrink-0" />
                          <span>Société :</span>
                          <span className="text-control-text-bright font-medium">{selectedCh.company || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-control-text/70">
                          <Mail className="h-4 w-4 text-control-cyan/70 shrink-0" />
                          <span>Contact :</span>
                          <span className="text-control-text-bright font-medium truncate">{selectedCh.email || "N/A"}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-control-text/70">
                          <Key className="h-4 w-4 text-control-cyan/70 shrink-0" />
                          <span>N° Badge :</span>
                          <span className="text-control-cyan font-medium">{selectedCh.badge_number || "Aucun"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-control-text/70">
                          <Clock className="h-4 w-4 text-control-cyan/70 shrink-0" />
                          <span>Plage horaire :</span>
                          <span className="text-control-amber font-medium">{selectedCh.schedule || "24h/24"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 gap-3">
                      <button
                        onClick={() => handleDeleteCardholder(selectedCh.id)}
                        className="flex items-center gap-2 border border-control-red/30 bg-control-red/5 hover:bg-control-red/10 text-control-red py-2 px-4 rounded-lg font-medium transition cursor-pointer min-h-[40px]"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Supprimer</span>
                      </button>

                      <button
                        onClick={() => handleEditClick(selectedCh)}
                        className="flex items-center gap-2 border border-control-border bg-control-panel-light hover:bg-control-panel text-control-cyan py-2 px-4 rounded-lg font-medium transition cursor-pointer hover:border-control-cyan/50 min-h-[40px]"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Modifier</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Placeholder details */
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-control-border rounded-xl bg-control-panel/5 select-none">
                <FileText className="h-12 w-12 text-control-text/20 mb-4" />
                <h3 className="text-base font-semibold text-control-text-bright">Fiche titulaire</h3>
                <p className="text-sm text-control-text/50 max-w-xs mt-2 leading-relaxed">
                  Sélectionnez un titulaire de badge dans la liste ou cliquez sur « Nouveau » pour créer un profil d'accès.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
