import React, { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore, type TranslationKey } from "../store/languageStore";
import { useCameraStore } from "../store/cameraStore";
import { useAccessControlStore } from "../store/accessControlStore";
import { useAlarmStore } from "../store/alarmStore";
import { useWorkspaceStore, type TabType } from "../store/workspaceStore";

// Lucide icons
import { 
  LogOut, Radio, Terminal, Cpu, Clock, LayoutGrid, ShieldAlert, Map, 
  Camera, DoorOpen, Sparkles, Moon, Sun, Globe, Users, Plus, X, Settings, Video,
  ChevronLeft, ChevronRight, Menu
} from "lucide-react";

// Workspace Tab Views
import { LiveView } from "./LiveView";
import { AccessControl } from "./AccessControl";
import { Alarms } from "./Alarms";
import { Events } from "./Events";
import { InteractiveMap } from "./InteractiveMap";
import { UserSettings } from "./UserSettings";
import { UserManagement } from "./UserManagement";
import { CameraConfig } from "./CameraConfig";
import { HomePortal } from "./HomePortal";

interface DashboardProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ theme, onToggleTheme }) => {
  const { user, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  const { cameras } = useCameraStore();
  const { doors, fetchDoors } = useAccessControlStore();
  const { connectEventStream, disconnectEventStream, activeAlarms } = useAlarmStore();
  
  // Workspace tabs store
  const { tabs, activeTabId, openTab, closeTab, setActiveTabId, reorderTabs } = useWorkspaceStore();
  
  // Local states
  const [time, setTime] = useState(new Date());
  const [sysLogs, setSysLogs] = useState<{ time: string; key: TranslationKey; variables?: any }[]>([]);
  const [latency, setLatency] = useState(12);
  const [showTabMenu, setShowTabMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Drag and Drop Tab Reordering State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    connectEventStream();
    return () => {
      disconnectEventStream();
    };
  }, [connectEventStream, disconnectEventStream]);

  useEffect(() => {
    fetchDoors().catch(() => {});
  }, [fetchDoors]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const events: TranslationKey[] = [
      "accessSystemReady",
      "videoSyncOk",
      "intrusionZonesArmed",
      "eventStreamStable",
      "noCriticalAlerts"
    ];

    setSysLogs([{ time: new Date().toLocaleTimeString(), key: "dashboardReady" }]);

    const interval = setInterval(() => {
      const randomEventKey = events[Math.floor(Math.random() * events.length)];
      setSysLogs((prev) => {
        const next = [...prev, { time: new Date().toLocaleTimeString(), key: randomEventKey }];
        return next.slice(-4);
      });
      setLatency(Math.floor(Math.random() * 8) + 8);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const metrics = useMemo(() => ({
    activeCameras: cameras.filter((camera) => camera.statut === "active").length,
    openDoors: doors.filter((door) => door.status === "open").length,
    closedDoors: doors.filter((door) => door.status === "closed").length,
    alerts: activeAlarms.length
  }), [cameras, doors, activeAlarms]);

  // Quick navigation link templates
  const sidebarLinks = useMemo(() => {
    const base = [
      { key: "status", type: "status" as TabType, labelKey: "taskOverview" as TranslationKey, icon: LayoutGrid, closable: false },
      { key: "live", type: "live" as TabType, labelKey: "taskLive" as TranslationKey, icon: Camera, closable: true },
      { key: "access", type: "access" as TabType, labelKey: "taskAccess" as TranslationKey, icon: DoorOpen, closable: true },
      { key: "alarms", type: "alarms" as TabType, labelKey: "taskAlarms" as TranslationKey, icon: ShieldAlert, closable: true },
      { key: "map", type: "map" as TabType, labelKey: "taskMap" as TranslationKey, icon: Map, closable: true },
      { key: "events", type: "events" as TabType, labelKey: "taskEvents" as TranslationKey, icon: Radio, closable: true }
    ];

    if (user?.role === "admin") {
      base.push({ key: "camera-config", type: "camera-config" as TabType, labelKey: "taskCameraConfig" as any, icon: Video, closable: true });
      base.push({ key: "users", type: "users" as TabType, labelKey: "taskUsers" as TranslationKey, icon: Users, closable: true });
    }

    base.push({ key: "diagnostics", type: "diagnostics" as TabType, labelKey: "taskDiagnostics" as any, icon: Cpu, closable: true });
    base.push({ key: "settings", type: "settings" as TabType, labelKey: "taskSettings" as TranslationKey, icon: Settings, closable: true });

    return base;
  }, [user]);

  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  const getTabIcon = (type: TabType) => {
    switch (type) {
      case "status": return LayoutGrid;
      case "live": return Camera;
      case "access": return DoorOpen;
      case "alarms": return ShieldAlert;
      case "events": return Radio;
      case "map": return Map;
      case "users": return Users;
      case "settings": return Settings;
      case "camera-config": return Video;
      case "diagnostics": return Cpu;
    }
  };

  const handleSidebarClick = (link: typeof sidebarLinks[0]) => {
    openTab(link.type, link.labelKey, undefined, link.closable);
  };

  // Drag and drop tab reordering handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== index) {
      reorderTabs(draggedIdx, index);
      setDraggedIdx(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  return (
    <div className="flex h-screen w-screen bg-control-bg overflow-hidden text-control-text select-none">
      
      {/* Sidebar navigation (with collapsible transition) */}
      <aside className={`bg-control-panel border-r border-control-border flex flex-col justify-between shrink-0 transition-all duration-300 ${
        sidebarCollapsed ? "w-16" : "w-64"
      }`}>
        <div className="flex flex-col gap-6 p-4">
          {/* Logo, Brand, and Collapse Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-control-cyan text-white shadow-md shadow-control-cyan/20">
                <Sparkles className="h-4 w-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-control-text-bright tracking-tight">Wardis</span>
                    <span className="rounded-full border border-control-cyan/20 bg-control-cyan/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-control-cyan">
                      v0.0.1
                    </span>
                  </div>
                  <p className="text-[10px] text-control-text/75 uppercase tracking-wider font-semibold">{t("dashboardTitle")}</p>
                </div>
              )}
            </div>
            
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded hover:bg-control-panel-light text-control-text/80 hover:text-control-text-bright transition cursor-pointer"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 mt-4">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab?.type === link.type;
              return (
                <button
                  key={link.key}
                  onClick={() => handleSidebarClick(link)}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-control-cyan text-white shadow-sm shadow-control-cyan/20"
                      : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright"
                  } ${sidebarCollapsed ? "justify-center gap-0" : "gap-3"}`}
                  title={sidebarCollapsed ? t(link.labelKey) : undefined}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{t(link.labelKey)}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Panel */}
        <div className="p-4 border-t border-control-border flex flex-col gap-4">
          {/* User Profile */}
          <div 
            onClick={() => openTab("settings", "taskSettings", undefined, true)}
            className={`flex items-center bg-control-panel-light/40 border border-control-border/60 hover:bg-control-panel-light/70 rounded-xl p-3 cursor-pointer transition ${
              sidebarCollapsed ? "justify-center" : "gap-3"
            }`}
          >
            <div className="h-8 w-8 shrink-0 rounded-full bg-control-cyan/15 flex items-center justify-center font-bold text-control-cyan text-xs">
              {(user?.email || "OP").substring(0, 2).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-control-text-bright truncate">{user?.email || "operator@wardis.com"}</p>
                <span className="text-[9px] uppercase tracking-wider text-control-text font-bold bg-control-panel-light px-1.5 py-0.5 border border-control-border rounded-md">
                  {user?.role || "ADMIN"}
                </span>
              </div>
            )}
          </div>

          {/* Language Selector, Theme Switcher & Logout */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
              className={`w-full flex items-center justify-between rounded-lg border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 px-3 py-2 text-xs font-bold uppercase tracking-wider text-control-text cursor-pointer transition ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              title={t("languageLabel")}
            >
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-control-cyan" />
                {!sidebarCollapsed && <span>{language === "fr" ? "Langue: FR" : "Language: EN"}</span>}
              </span>
              {!sidebarCollapsed && <span className="text-[10px] text-control-text/60 font-semibold uppercase">{language}</span>}
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className={`w-full flex items-center justify-between rounded-lg border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 px-3 py-2 text-xs font-bold uppercase tracking-wider text-control-text cursor-pointer transition ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              title={theme === "dark" ? t("themeToggleLightLabel") : t("themeToggleDarkLabel")}
            >
              <span className="flex items-center gap-2">
                {theme === "dark" ? <Sun className="h-4 w-4 text-control-amber" /> : <Moon className="h-4 w-4 text-control-cyan" />}
                {!sidebarCollapsed && <span>{theme === "dark" ? t("themeToggleLightLabel") : t("themeToggleDarkLabel")}</span>}
              </span>
            </button>
            <button
              onClick={() => logout()}
              className={`w-full flex items-center justify-center rounded-lg border border-control-red/20 bg-control-red/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-control-red transition hover:bg-control-red/15 cursor-pointer ${
                sidebarCollapsed ? "" : "gap-2"
              }`}
              title={t("logoutButton")}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{t("logoutButton")}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Right Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-control-bg">
        
        {/* Browser-like top tabs bar (with Drag and Drop) */}
        <div className="flex items-center bg-control-panel border-b border-control-border px-4 py-1.5 gap-1 shrink-0 h-11 select-none overflow-x-auto relative z-20">
          
          {/* Quick sidebar trigger in header in case it is fully closed or for utility */}
          {sidebarCollapsed && (
            <button 
              onClick={() => setSidebarCollapsed(false)}
              className="mr-2 p-1.5 rounded bg-control-panel-light border border-control-border/60 text-control-text-bright hover:text-control-cyan transition cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
            {tabs.map((tab, idx) => {
              const TabIcon = getTabIcon(tab.type);
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider cursor-grab active:cursor-grabbing transition border duration-150 shrink-0 ${
                    isActive
                      ? "bg-control-cyan border-control-cyan text-white shadow-sm shadow-control-cyan/15"
                      : "bg-control-panel-light border-control-border text-control-text hover:text-control-text-bright hover:bg-control-panel-light/80"
                  }`}
                >
                  {TabIcon && <TabIcon className="h-3.5 w-3.5 shrink-0 pointer-events-none" />}
                  <span className="pointer-events-none">{t(tab.title as TranslationKey)}</span>
                  {tab.closable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="hover:bg-black/20 rounded p-0.5 ml-1 transition cursor-pointer text-white/80 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* "+" tab addition button */}
            <div className="relative">
              <button
                onClick={() => setShowTabMenu(!showTabMenu)}
                className="hover:bg-control-panel-light border border-control-border/60 rounded-lg p-1.5 text-control-text-bright cursor-pointer transition flex items-center justify-center bg-control-panel-light/40"
              >
                <Plus className="h-4 w-4" />
              </button>

              {/* Task launch dropdown */}
              {showTabMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowTabMenu(false)} />
                  <div className="absolute left-0 mt-2 w-56 rounded-xl bg-control-panel border border-control-border shadow-xl p-2 z-40 flex flex-col gap-0.5">
                    <p className="text-[9px] uppercase tracking-wider font-bold text-control-text/60 px-2 py-1 border-b border-control-border/50 mb-1">
                      {t("taskMenuTitle")}
                    </p>
                    {sidebarLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <button
                          key={link.key}
                          onClick={() => {
                            handleSidebarClick(link);
                            setShowTabMenu(false);
                          }}
                          className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-xs text-left font-bold uppercase tracking-wider hover:bg-control-panel-light hover:text-control-text-bright text-control-text transition cursor-pointer"
                        >
                          <Icon className="h-4 w-4 text-control-cyan shrink-0" />
                          {t(link.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Bar */}
        <header className="border-b border-control-border bg-control-panel px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div>
            <h2 className="text-base font-bold text-control-text-bright tracking-tight">
              {t(activeTab?.title as TranslationKey)}
            </h2>
            <p className="text-[10px] text-control-text/80 uppercase tracking-wider">
              {t("headerSubtitle")}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-control-border bg-control-panel-light px-3 py-1.5 text-xs text-control-text font-bold">
              <Clock className="h-3.5 w-3.5 text-control-cyan" />
              {time.toLocaleTimeString()}
            </div>
            
            <div className="flex items-center gap-2 rounded-full border border-control-border bg-control-panel-light px-3 py-1.5 text-xs text-control-text font-bold">
              <span className={`h-2 w-2 rounded-full ${metrics.alerts > 0 ? "bg-control-red animate-pulse" : "bg-control-green"}`} />
              <span>{metrics.alerts > 0 ? t("activeAlertsCount", { count: metrics.alerts }) : t("systemStable")}</span>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
          {activeTab?.type === "status" && <HomePortal />}

          {activeTab?.type === "live" && <LiveView />}
          {activeTab?.type === "access" && <AccessControl />}
          {activeTab?.type === "alarms" && <Alarms />}
          {activeTab?.type === "events" && <Events />}
          {activeTab?.type === "map" && <InteractiveMap />}
          {activeTab?.type === "camera-config" && <CameraConfig />}
          {activeTab?.type === "users" && <UserManagement />}
          {activeTab?.type === "settings" && <UserSettings theme={theme} onToggleTheme={onToggleTheme} />}
          
          {activeTab?.type === "diagnostics" && (
            <div className="flex flex-col gap-6">
              <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Stats Card 1 */}
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">{t("activeCameras")}</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.activeCameras}</div>
                  <div className="mt-1 text-xs text-control-text">{t("camerasSynced")}</div>
                </div>
                {/* Stats Card 2 */}
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">{t("doors")}</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.openDoors}/{doors.length}</div>
                  <div className="mt-1 text-xs text-control-text">{t("doorsStatusDesc")}</div>
                </div>
                {/* Stats Card 3 */}
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">{t("activeAlerts")}</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.alerts}</div>
                  <div className="mt-1 text-xs text-control-text">{t("alertsPriority")}</div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-12">
                {/* System Health */}
                <div className="xl:col-span-6 wardis-panel p-6">
                  <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                     <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">{t("serviceStatus")}</h3>
                     <span className="rounded-full border border-control-border bg-control-panel-light px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-control-text">
                       {t("latency", { latency })}
                     </span>
                  </div>
                  <div className="space-y-3.5 text-xs text-control-text">
                    <div className="flex items-center justify-between">
                      <span>{t("generalStatus")}</span>
                      <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">{t("statusStable")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("natsServer")}</span>
                      <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">{t("natsConnected")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("accessGateway")}</span>
                      <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">{t("gatewayOnline")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("videoServer")}</span>
                      <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">{t("serverActive")}</span>
                    </div>
                  </div>
                </div>

                {/* Console logs */}
                <div className="xl:col-span-6 wardis-panel p-6">
                  <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                     <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">{t("systemJournal")}</h3>
                     <Terminal className="h-4 w-4 text-control-cyan" />
                  </div>
                  <div className="space-y-2.5 font-mono text-[10px] text-control-text leading-relaxed">
                    {sysLogs.map((log, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-control-cyan shrink-0" />
                        <span>{log.time} • {t(log.key, log.variables)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
