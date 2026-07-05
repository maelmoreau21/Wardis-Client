import React, { useEffect, useMemo, useState, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore, type TranslationKey } from "../store/languageStore";
import { useWorkspaceStore, type TabType } from "../store/workspaceStore";
import { useCameraStore } from "../store/cameraStore";
import { useAccessControlStore } from "../store/accessControlStore";
import { useEventStore } from "../store/eventStore";
import { useAlarmStore } from "../store/alarmStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { 
  Camera, DoorOpen, ShieldAlert, Map, Radio, Users, Settings, 
  Video, ExternalLink, Search, Sparkles, Cpu, HardDrive, 
  Sliders, X, Play, Lock, Unlock, CheckCircle2, AlertTriangle, Eye, RefreshCw,
  BarChart3, HelpCircle
} from "lucide-react";

interface TaskTile {
  key: string;
  type: TabType;
  titleKey: TranslationKey;
  descKey: string;
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
  closable: boolean;
  category: "Operation" | "Investigation" | "Maintenance";
}

export const HomePortal: React.FC = () => {
  const { user, token } = useAuthStore();
  const { t } = useLanguageStore();
  const { openTab } = useWorkspaceStore();
  const { cameras, fetchCameras, configureWHEPStream } = useCameraStore();
  const { doors, fetchDoors, openDoor } = useAccessControlStore();
  const { events, fetchEvents } = useEventStore();
  const { fetchActiveAlarms } = useAlarmStore();
  
  // Local States
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [previewCamera, setPreviewCamera] = useState<{ id: string; nom: string } | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [doorUnlockingId, setDoorUnlockingId] = useState<string | null>(null);

  // Widget Configuration State
  const [dbConfig, setDbConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("wardis-dashboard-config");
      return saved ? JSON.parse(saved) : {
        showHealth: true,
        showFavorites: true,
        showActivity: true,
        showShortcuts: true,
        columns: 2
      };
    } catch {
      return {
        showHealth: true,
        showFavorites: true,
        showActivity: true,
        showShortcuts: true,
        columns: 2
      };
    }
  });

  // Load state and options on mount
  useEffect(() => {
    fetchCameras().catch(() => {});
    fetchDoors().catch(() => {});
    fetchEvents().catch(() => {});
    fetchActiveAlarms().catch(() => {});
    
    // Load favorites
    const loadFavs = () => {
      try {
        const favs = JSON.parse(localStorage.getItem("wardis-favs") || "[]");
        setFavorites(favs);
      } catch {
        setFavorites([]);
      }
    };
    loadFavs();
    
    // Periodically poll for updates (e.g. storage metric and today's alarms)
    const interval = setInterval(() => {
      fetchEvents().catch(() => {});
      fetchActiveAlarms().catch(() => {});
      loadFavs();
    }, 6000);

    return () => clearInterval(interval);
  }, [fetchCameras, fetchDoors, fetchEvents, fetchActiveAlarms]);

  // Save layout settings
  const toggleWidget = (key: string) => {
    const nextConfig = { ...dbConfig, [key]: !dbConfig[key] };
    setDbConfig(nextConfig);
    localStorage.setItem("wardis-dashboard-config", JSON.stringify(nextConfig));
  };

  const changeColumns = (cols: number) => {
    const nextConfig = { ...dbConfig, columns: cols };
    setDbConfig(nextConfig);
    localStorage.setItem("wardis-dashboard-config", JSON.stringify(nextConfig));
  };

  // Task Tile Config
  const tasks: TaskTile[] = useMemo(() => [
    {
      key: "live",
      type: "live",
      titleKey: "taskLive",
      descKey: "Visualisation des flux caméras en direct et grilles de surveillance.",
      icon: Camera,
      closable: true,
      category: "Operation"
    },
    {
      key: "access",
      type: "access",
      titleKey: "taskAccess",
      descKey: "Contrôle d'accès physique, déverrouillage de portes et journal de passage.",
      icon: DoorOpen,
      closable: true,
      category: "Operation"
    },
    {
      key: "alarms",
      type: "alarms",
      titleKey: "taskAlarms",
      descKey: "Console d'acquittement des alarmes et alertes d'intrusion en temps réel.",
      icon: ShieldAlert,
      closable: true,
      category: "Operation"
    },
    {
      key: "map",
      type: "map",
      titleKey: "taskMap",
      descKey: "Cartographie interactive des équipements de sécurité et de contrôle.",
      icon: Map,
      closable: true,
      category: "Operation"
    },
    {
      key: "events",
      type: "events",
      titleKey: "taskEvents",
      descKey: "Journal d'audit système complet et flux d'événements en direct.",
      icon: Radio,
      closable: true,
      category: "Investigation"
    },
    {
      key: "reports",
      type: "reports",
      titleKey: "taskReports",
      descKey: "Génération de rapports d'activité, d'audit admin et de disponibilité caméras.",
      icon: BarChart3,
      closable: true,
      category: "Investigation"
    },
    {
      key: "diagnostics",
      type: "diagnostics",
      titleKey: "taskDiagnostics",
      descKey: "Diagnostics de l'état général des serveurs, services NATS et logs système.",
      icon: Cpu,
      closable: true,
      category: "Maintenance"
    },
    {
      key: "camera-config",
      type: "camera-config",
      titleKey: "taskCameraConfig",
      descKey: "Configuration des caméras de sécurité et scan ONVIF automatique.",
      icon: Video,
      adminOnly: true,
      closable: true,
      category: "Maintenance"
    },
    {
      key: "users",
      type: "users",
      titleKey: "taskUsers",
      descKey: "Gestion administrative des utilisateurs, des rôles et de la matrice de droits.",
      icon: Users,
      adminOnly: true,
      closable: true,
      category: "Maintenance"
    },
    {
      key: "settings",
      type: "settings",
      titleKey: "taskSettings",
      descKey: "Gestion du profil opérateur, mot de passe, préférences de thème et de langue.",
      icon: Settings,
      closable: true,
      category: "Maintenance"
    }
  ], []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.adminOnly && user?.role !== "admin") return false;
      if (!searchQuery) return true;
      const title = t(task.titleKey).toLowerCase();
      const desc = task.descKey.toLowerCase();
      return title.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
    });
  }, [tasks, searchQuery, user, t]);

  const handleLaunchTab = (task: TaskTile) => {
    openTab(task.type, task.titleKey, undefined, task.closable);
  };

  const handleDetachTab = async (task: TaskTile) => {
    const label = `detached-task-${task.key}-${Date.now()}`;
    try {
      const webview = new WebviewWindow(label, {
        url: `index.html?detached=true&tabType=${task.type}&token=${encodeURIComponent(token || "")}`,
        title: `Wardis Task - ${t(task.titleKey)}`,
        width: 1024,
        height: 768,
      });

      webview.once("tauri://created", () => {
        console.log(`Detached task window created: ${task.key}`);
      });
    } catch (e) {
      console.warn("Tauri detached window failed, falling back to browser window:", e);
      window.open(`?detached=true&tabType=${task.type}&token=${encodeURIComponent(token || "")}`, "_blank");
    }
  };

  // Door Unlock Favorite Action
  const handleQuickUnlock = async (doorId: string) => {
    setDoorUnlockingId(doorId);
    try {
      await openDoor(doorId);
      // Brief visual feedback interval
      setTimeout(() => setDoorUnlockingId(null), 2500);
    } catch (e) {
      console.error(e);
      setDoorUnlockingId(null);
    }
  };

  // Find camera/door entities matching favorites IDs
  const favoriteCameras = useMemo(() => {
    return cameras.filter(c => favorites.includes(c.id));
  }, [cameras, favorites]);

  const favoriteDoors = useMemo(() => {
    return doors.filter(d => favorites.includes(d.id));
  }, [doors, favorites]);

  // Alarms Triggered Today Count
  const alarmsTodayCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return events.filter(e => 
      e.event_type === "alarm.triggered" && 
      new Date(e.timestamp).toDateString() === todayStr
    ).length;
  }, [events]);

  const categories = ["Operation", "Investigation", "Maintenance"] as const;

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full py-4 px-2">
      {/* Banner */}
      <div className="wardis-panel p-6 relative overflow-hidden bg-gradient-to-r from-control-panel via-control-panel-light/30 to-control-panel border border-control-border/60 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-control-cyan/15 text-control-cyan border border-control-cyan/25 animate-pulse-slow">
            <Sparkles className="h-6 w-6 text-control-cyan" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-control-text-bright tracking-tight flex items-center gap-2">
              Wardis Security Desk
              <span className="rounded-full border border-control-cyan/25 bg-control-cyan/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-control-cyan font-mono">
                Accueil
              </span>
            </h2>
            <p className="text-xs text-control-text/75 mt-0.5">
              Plateforme industrielle unifiée de supervision vidéo et de contrôle d'accès.
            </p>
          </div>
        </div>
        
        {/* Welcome indicator */}
        <div className="flex items-center gap-3 bg-control-bg/60 border border-control-border rounded-xl px-4 py-2.5 relative z-10">
          <div className="h-8 w-8 rounded-full bg-control-cyan/10 flex items-center justify-center font-bold text-control-cyan text-xs border border-control-cyan/25">
            {(user?.email || "OP").substring(0, 2).toUpperCase()}
          </div>
          <div className="text-xs">
            <p className="font-bold text-control-text-bright">{user?.email || "operator@wardis.com"}</p>
            <p className="text-[9px] text-control-text/60 uppercase tracking-wider font-semibold">
              Rôle: {user?.role || "OPERATOR"}
            </p>
          </div>
        </div>
      </div>

      {/* Control bar: Search + Config Button */}
      <div className="flex items-center justify-between gap-4 relative">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-control-text/50">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une tâche (Surveillance, Cartographie...)..."
            className="w-full bg-control-panel border border-control-border rounded-xl pl-9 pr-4 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60 transition shadow-sm"
          />
        </div>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 border px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
            showConfig 
              ? "bg-control-cyan border-control-cyan text-black" 
              : "bg-control-panel border-control-border text-control-text hover:text-control-text-bright hover:border-control-border/80"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Configure Dashboard</span>
        </button>

        {/* Configuration Overlay Panel */}
        {showConfig && (
          <div className="absolute right-0 top-12 z-[100] w-64 p-4 rounded-xl border border-control-border bg-control-panel/95 shadow-[0_15px_30px_rgba(0,0,0,0.3)] backdrop-blur-md flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-control-border pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-control-text-bright">Widget Settings</span>
              <button onClick={() => setShowConfig(false)} className="text-control-text/50 hover:text-control-text-bright cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex flex-col gap-3 text-[10px] uppercase font-bold tracking-wider text-control-text">
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span>{t("widgetSystemHealth")}</span>
                <input
                  type="checkbox"
                  checked={dbConfig.showHealth}
                  onChange={() => toggleWidget("showHealth")}
                  className="accent-control-cyan h-4 w-4"
                />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span>{t("widgetFavorites")}</span>
                <input
                  type="checkbox"
                  checked={dbConfig.showFavorites}
                  onChange={() => toggleWidget("showFavorites")}
                  className="accent-control-cyan h-4 w-4"
                />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span>{t("widgetRecentActivity")}</span>
                <input
                  type="checkbox"
                  checked={dbConfig.showActivity}
                  onChange={() => toggleWidget("showActivity")}
                  className="accent-control-cyan h-4 w-4"
                />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span>Raccourcis de Tâches</span>
                <input
                  type="checkbox"
                  checked={dbConfig.showShortcuts}
                  onChange={() => toggleWidget("showShortcuts")}
                  className="accent-control-cyan h-4 w-4"
                />
              </label>
            </div>

            <div className="border-t border-control-border pt-3">
              <div className="text-[9px] uppercase tracking-wider text-control-text/60 mb-2 font-bold">Colonnes Layout</div>
              <div className="flex bg-control-panel-light p-0.5 rounded border border-control-border gap-1 font-mono text-[9px] font-bold">
                {[1, 2, 3].map(c => (
                  <button
                    key={c}
                    onClick={() => changeColumns(c)}
                    className={`flex-1 py-1 rounded transition text-center cursor-pointer ${
                      dbConfig.columns === c ? "bg-control-cyan text-black" : "text-control-text hover:text-control-text-bright"
                    }`}
                  >
                    {c} Col
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customizable Dashboard Grid */}
      {(dbConfig.showHealth || dbConfig.showFavorites || dbConfig.showActivity) && (
        <div className={`grid grid-cols-1 ${
          dbConfig.columns === 3 ? "lg:grid-cols-3" : dbConfig.columns === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1"
        } gap-6`}>
          
          {/* Widget 1: System Health */}
          {dbConfig.showHealth && (
            <div className="wardis-panel p-5 flex flex-col justify-between h-96">
              <div className="flex items-center justify-between border-b border-control-border/60 pb-2 mb-3">
                <span className="text-xs font-bold text-control-text-bright uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-control-cyan" />
                  {t("widgetSystemHealth")}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-control-green animate-pulse" />
              </div>

              <div className="flex-1 flex flex-col justify-around gap-4 py-2">
                {/* Storage Health */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-control-text/80">
                      <HardDrive className="h-3.5 w-3.5" />
                      {t("storageUsed")}
                    </span>
                    <span className="text-control-cyan">42%</span>
                  </div>
                  <div className="w-full h-2.5 bg-control-panel-light border border-control-border rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-control-cyan to-indigo-500 rounded-full" style={{ width: "42%" }} />
                  </div>
                </div>

                {/* Cameras Status breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-control-panel-light border border-control-border/50 rounded-xl p-3 flex flex-col items-center">
                    <span className="text-[9px] uppercase tracking-wider text-control-text/70">{t("camerasOnline")}</span>
                    <span className="text-xl font-bold text-control-green mt-1">
                      {cameras.filter(c => c.statut === "active").length}
                    </span>
                  </div>
                  <div className="bg-control-panel-light border border-control-border/50 rounded-xl p-3 flex flex-col items-center">
                    <span className="text-[9px] uppercase tracking-wider text-control-text/70">{t("camerasOffline")}</span>
                    <span className="text-xl font-bold text-control-text-bright mt-1">
                      {cameras.filter(c => c.statut === "inactive").length}
                    </span>
                  </div>
                </div>

                {/* Today's Alarms */}
                <div className="flex items-center justify-between p-3.5 border border-control-red/20 bg-control-red/5 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="h-5 w-5 text-control-red animate-pulse" />
                    <div className="text-left">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-control-text-bright">{t("alarmsToday")}</div>
                      <div className="text-[8px] uppercase tracking-widest text-control-text/60 font-mono">Dernières 24h</div>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-control-red font-mono px-3 bg-control-red/10 border border-control-red/20 rounded-lg">
                    {alarmsTodayCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Widget 2: Favorites Widget */}
          {dbConfig.showFavorites && (
            <div className="wardis-panel p-5 flex flex-col justify-between h-96">
              <div className="flex items-center justify-between border-b border-control-border/60 pb-2 mb-3">
                <span className="text-xs font-bold text-control-text-bright uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-control-cyan" />
                  {t("widgetFavorites")}
                </span>
                <span className="text-[9px] font-mono font-bold text-control-cyan bg-control-cyan/10 border border-control-cyan/20 px-2 rounded-full">
                  {favorites.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                {favoriteCameras.length === 0 && favoriteDoors.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-control-text/50">
                    <HelpCircle className="h-8 w-8 mb-2 opacity-55" />
                    <span className="text-[10px] italic leading-relaxed">{t("noFavoritesYet")}</span>
                  </div>
                ) : (
                  <>
                    {/* Cameras list */}
                    {favoriteCameras.map(cam => (
                      <div key={cam.id} className="flex items-center justify-between border border-control-border bg-control-panel-light/35 rounded-xl p-2.5 hover:border-control-cyan/35 transition">
                        <div className="flex items-center gap-2 font-semibold">
                          <span className={`h-2 w-2 rounded-full ${cam.statut === "active" ? "bg-control-green" : "bg-control-gray"}`} />
                          <div className="text-left leading-tight">
                            <div className="text-[11px] font-bold text-control-text-bright uppercase truncate max-w-[150px]">{cam.nom}</div>
                            <div className="text-[8px] font-mono text-control-text/60 truncate max-w-[150px]">{cam.url_rtsp}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setPreviewCamera({ id: cam.id, nom: cam.nom })}
                            className="bg-control-cyan/15 hover:bg-control-cyan/35 text-control-cyan border border-control-cyan/20 rounded p-1.5 cursor-pointer text-[9px] font-bold uppercase transition flex items-center gap-1"
                            title="Aperçu Direct"
                          >
                            <Eye className="h-3 w-3" />
                            <span className="hidden sm:inline">Aperçu</span>
                          </button>
                          <button
                            onClick={() => openTab("live", "taskLive", { focusCameraId: cam.id }, true)}
                            className="bg-control-panel border border-control-border hover:border-control-cyan/60 rounded p-1.5 cursor-pointer text-[9px] text-control-text-bright hover:text-control-cyan transition"
                            title="Ouvrir dans la grille"
                          >
                            <Play className="h-3 w-3 fill-current" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Doors list */}
                    {favoriteDoors.map(door => (
                      <div key={door.id} className="flex items-center justify-between border border-control-border bg-control-panel-light/35 rounded-xl p-2.5 hover:border-control-cyan/35 transition">
                        <div className="flex items-center gap-2 font-semibold">
                          <span className={`h-2 w-2 rounded-full ${door.status === "open" ? "bg-control-green animate-pulse" : "bg-control-gray"}`} />
                          <div className="text-left leading-tight">
                            <div className="text-[11px] font-bold text-control-text-bright uppercase truncate max-w-[150px]">{door.name}</div>
                            <div className="text-[8px] font-mono text-control-text/60 uppercase">{door.status}</div>
                          </div>
                        </div>

                        <button
                          disabled={doorUnlockingId === door.id}
                          onClick={() => handleQuickUnlock(door.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border rounded transition cursor-pointer disabled:opacity-50 ${
                            doorUnlockingId === door.id
                              ? "bg-control-green border-control-green text-black font-extrabold"
                              : door.status === "open"
                                ? "bg-control-green/10 border-control-green/20 text-control-green"
                                : "bg-control-panel border-control-border hover:border-control-cyan hover:text-control-cyan text-control-text-bright"
                          }`}
                        >
                          {doorUnlockingId === door.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>En cours</span>
                            </>
                          ) : door.status === "open" ? (
                            <>
                              <Unlock className="h-3 w-3" />
                              <span>{t("quickUnlock")}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              <span>{t("quickUnlock")}</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Widget 3: Recent Activity Widget */}
          {dbConfig.showActivity && (
            <div className="wardis-panel p-5 flex flex-col justify-between h-96 lg:col-span-1">
              <div className="flex items-center justify-between border-b border-control-border/60 pb-2 mb-3">
                <span className="text-xs font-bold text-control-text-bright uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="h-4 w-4 text-control-cyan" />
                  {t("widgetRecentActivity")}
                </span>
                <span className="text-[8px] font-mono uppercase bg-control-panel-light text-control-text px-2 py-0.5 rounded border border-control-border">
                  Live Feed
                </span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-72">
                {events.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-control-text/40">
                    <Radio className="h-8 w-8 mb-2 animate-pulse" />
                    <span className="text-[10px] italic">{t("noRecentActivity")}</span>
                  </div>
                ) : (
                  events.slice(0, 15).map(evt => {
                    let Icon = Radio;
                    let colorClass = "text-control-text bg-control-panel-light border-control-border/60";

                    if (evt.event_type === "alarm.triggered") {
                      Icon = ShieldAlert;
                      colorClass = "text-control-red bg-control-red/10 border-control-red/20";
                    } else if (evt.event_type.startsWith("access.granted")) {
                      Icon = CheckCircle2;
                      colorClass = "text-control-green bg-control-green/10 border-control-green/20";
                    } else if (evt.event_type.startsWith("access.denied")) {
                      Icon = AlertTriangle;
                      colorClass = "text-control-amber bg-control-amber/10 border-control-amber/20";
                    } else if (evt.event_type.startsWith("video.motion")) {
                      Icon = Video;
                      colorClass = "text-control-cyan bg-control-cyan/10 border-control-cyan/20";
                    }

                    return (
                      <div key={evt.id} className="flex gap-2.5 items-start border border-control-border bg-control-panel-light/20 p-2.5 rounded-xl text-[10px] leading-relaxed">
                        <div className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-bold text-control-text-bright leading-tight">{evt.message}</p>
                          <div className="flex items-center gap-2 mt-1 text-[8px] font-mono text-control-text/50 uppercase">
                            <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                            <span>•</span>
                            <span>{evt.event_type}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Task categories and Launch shortcuts (Collapsible if widgets are visible) */}
      {dbConfig.showShortcuts && (
        <div className="flex flex-col gap-8 mt-4">
          {categories.map((cat) => {
            const catTasks = filteredTasks.filter(t => t.category === cat);
            if (catTasks.length === 0) return null;

            return (
              <div key={cat} className="flex flex-col animate-fade-in">
                <div className="flex items-center gap-2 border-b border-control-border/40 pb-1.5 mb-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-control-cyan shrink-0" />
                  <h3 className="text-xs font-bold text-control-text-bright uppercase tracking-wider">
                    {cat === "Operation" ? "Opérations" : cat === "Investigation" ? "Recherche" : "Administration & Maintenance"}
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {catTasks.map((task) => {
                    const Icon = task.icon;
                    return (
                      <div
                        key={task.key}
                        onClick={() => handleLaunchTab(task)}
                        className="wardis-panel p-4 group flex flex-col justify-between h-40 border-control-border/60 hover:border-control-cyan/40 hover:bg-control-panel-light/20 transition duration-150 cursor-pointer relative"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="h-9 w-9 rounded-lg bg-control-bg flex items-center justify-center text-control-cyan border border-control-border/70 group-hover:border-control-cyan/40 transition">
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            
                            {/* Detach Action */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDetachTab(task);
                              }}
                              className="p-1 rounded bg-control-bg border border-control-border text-control-text/75 hover:text-control-cyan hover:border-control-cyan transition cursor-pointer"
                              title="Détacher vers un écran externe"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </div>

                          <h4 className="text-xs font-bold text-control-text-bright mt-3 uppercase tracking-wider truncate">
                            {t(task.titleKey)}
                          </h4>
                          <p className="text-[10px] text-control-text/70 mt-1 leading-relaxed line-clamp-2">
                            {task.descKey}
                          </p>
                        </div>

                        <div className="text-[9px] uppercase tracking-wider font-bold text-control-cyan/0 group-hover:text-control-cyan/100 transition duration-150 flex items-center gap-1">
                          Lancer &rarr;
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating WebRTC Camera stream preview modal */}
      {previewCamera && (
        <CameraPreviewModal 
          cameraId={previewCamera.id} 
          cameraNom={previewCamera.nom} 
          configureWHEPStream={configureWHEPStream} 
          onClose={() => setPreviewCamera(null)}
        />
      )}
      
    </div>
  );
};

// Subcomponent: Live WebRTC stream preview modal
interface PreviewModalProps {
  cameraId: string;
  cameraNom: string;
  configureWHEPStream: (cameraId: string) => Promise<string>;
  onClose: () => void;
}

const CameraPreviewModal: React.FC<PreviewModalProps> = ({ cameraId, cameraNom, configureWHEPStream, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  
  const [status, setStatus] = useState<"connecting" | "playing" | "failed">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let pc: RTCPeerConnection | null = null;
    let timeoutId: number | null = null;

    const startStream = async () => {
      try {
        // Request WebRTC WHEP connection url
        const whepUrl = await configureWHEPStream(cameraId);
        if (!active) return;

        pc = new RTCPeerConnection({ iceServers: [] });
        pcRef.current = pc;
        pc.addTransceiver("video", { direction: "recvonly" });

        pc.ontrack = (event) => {
          if (!active) return;
          if (videoRef.current && event.streams && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setStatus("playing");
          }
        };

        pc.onconnectionstatechange = () => {
          if (!active) return;
          if (pc?.connectionState === "connected") {
            setStatus("playing");
          } else if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") {
            setStatus("failed");
            setErrorMsg("Échec de connexion au serveur WebRTC.");
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const response = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        });

        if (!response.ok) {
          throw new Error("Handshake WHEP refusé par la passerelle video.");
        }

        const answerSdp = await response.text();
        if (!active) return;

        await pc.setRemoteDescription(new RTCSessionDescription({
          type: "answer",
          sdp: answerSdp,
        }));

        // Timeout fallback
        timeoutId = window.setTimeout(() => {
          if (active && videoRef.current && !videoRef.current.srcObject) {
            setStatus("failed");
            setErrorMsg("Délai de connexion expiré.");
          }
        }, 6000);

      } catch (err: any) {
        console.error(err);
        if (active) {
          setStatus("failed");
          setErrorMsg(err.message || "Impossible d'initier le flux direct.");
        }
      }
    };

    startStream();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [cameraId, configureWHEPStream]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-control-panel border border-control-border rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-control-border/60 bg-control-panel-light/30">
          <span className="text-xs font-bold text-control-text-bright uppercase tracking-wider flex items-center gap-1.5">
            <Video className="h-4.5 w-4.5 text-control-cyan" />
            Flux Direct : {cameraNom}
          </span>
          <button 
            onClick={onClose} 
            className="text-control-text/60 hover:text-control-text-bright cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video stream container */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          {status === "connecting" && (
            <div className="flex flex-col items-center gap-2 z-10 text-control-text">
              <RefreshCw className="h-8 w-8 text-control-cyan animate-spin" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Négociation WebRTC...</span>
            </div>
          )}
          
          {status === "failed" && (
            <div className="flex flex-col items-center gap-2.5 z-10 text-control-red max-w-sm text-center px-4">
              <AlertTriangle className="h-8 w-8 text-control-red animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{errorMsg}</span>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${status === "playing" ? "block" : "hidden"}`}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-control-border bg-control-panel-light/20 flex items-center justify-between text-[10px] text-control-text/70 uppercase font-bold tracking-wider font-mono">
          <span>Format: WebRTC WHEP</span>
          <span className="rounded bg-control-green/15 text-control-green border border-control-green/20 px-2 py-0.5 animate-pulse">
            Flux Actif
          </span>
        </div>
      </div>
    </div>
  );
};
