import React, { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore, type TranslationKey } from "../store/languageStore";
import { useCameraStore } from "../store/cameraStore";
import { useAccessControlStore } from "../store/accessControlStore";
import { useAlarmStore } from "../store/alarmStore";
import { useWorkspaceStore, type TabType } from "../store/workspaceStore";

// Lucide icons
import { 
  Terminal, Cpu, LayoutGrid, ShieldAlert, Map, 
  Camera, DoorOpen, Users, Settings, Video,
  Film, BarChart3, SlidersHorizontal, FileText
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

// Layout components
import { TopBar } from "./layout/TopBar";
import { IconRail } from "./layout/IconRail";
import { ContextPanel } from "./layout/ContextPanel";
import { MainCanvas } from "./layout/MainCanvas";
import { StatusBar } from "./layout/StatusBar";

interface DashboardProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ theme, onToggleTheme }) => {
  const { user, logout } = useAuthStore();
  const { t } = useLanguageStore();
  const { cameras } = useCameraStore();
  const { doors, fetchDoors } = useAccessControlStore();
  const { connectEventStream, disconnectEventStream, activeAlarms } = useAlarmStore();
  
  // Workspace tabs store
  const { tabs, activeTabId, openTab, closeTab, setActiveTabId, reorderTabs } = useWorkspaceStore();
  
  // Local states
  const [time, setTime] = useState(new Date());
  const [sysLogs, setSysLogs] = useState<{ time: string; key: TranslationKey; variables?: any }[]>([]);
  const [latency, setLatency] = useState(12);
  const [adminSubTab, setAdminSubTab] = useState<"cameras" | "users" | "diagnostics">("cameras");

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

  // Sidebar link config
  const sidebarLinks = useMemo(() => {
    return [
      { key: "live", type: "live" as TabType, labelKey: "taskLive" as TranslationKey, icon: Camera, closable: true },
      { key: "alarms", type: "alarms" as TabType, labelKey: "taskAlarms" as TranslationKey, icon: ShieldAlert, closable: true },
      { key: "access", type: "access" as TabType, labelKey: "taskAccess" as TranslationKey, icon: DoorOpen, closable: true },
      { key: "map", type: "map" as TabType, labelKey: "taskMap" as TranslationKey, icon: Map, closable: true },
      { key: "events", type: "events" as TabType, labelKey: "taskEvents" as TranslationKey, icon: Film, closable: true },
      { key: "reports", type: "reports" as TabType, labelKey: "taskReports" as TranslationKey, icon: BarChart3, closable: true },
      { key: "admin-system", type: "admin-system" as TabType, labelKey: "taskAdmin" as TranslationKey, icon: SlidersHorizontal, closable: true }
    ];
  }, []);

  // Keyboard shortcuts Ctrl+1 to Ctrl+7 for instant module switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 7) {
          e.preventDefault();
          const target = sidebarLinks[num - 1];
          if (target) {
            openTab(target.type, target.labelKey, undefined, target.closable);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarLinks, openTab]);

  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  const getTabIcon = (type: TabType) => {
    switch (type) {
      case "status": return LayoutGrid;
      case "live": return Camera;
      case "access": return DoorOpen;
      case "alarms": return ShieldAlert;
      case "events": return Film;
      case "map": return Map;
      case "users": return Users;
      case "settings": return Settings;
      case "camera-config": return Video;
      case "diagnostics": return Cpu;
      case "reports": return BarChart3;
      case "admin-system": return SlidersHorizontal;
    }
  };

  const handleSidebarClick = (link: any) => {
    openTab(link.type, link.labelKey, undefined, link.closable);
  };

  // Generate telemetry for selected stream in status bar
  const selectedTileTelemetry = useMemo(() => {
    const activeCamera = cameras.find(c => c.statut === "active");
    if (activeCamera) {
      return {
        cameraName: activeCamera.nom,
        fps: 30,
        resolution: "1920x1080",
        zoom: 1.0
      };
    }
    return undefined;
  }, [cameras]);

  return (
    <div className="flex flex-col h-screen w-screen bg-control-bg text-control-text select-none overflow-hidden font-sans">
      
      {/* Top Header */}
      <TopBar
        title={t(activeTab?.title as TranslationKey)}
        subtitle={t("headerSubtitle")}
        serverTime={time.toLocaleTimeString()}
        connectionStatus="online"
        activeAlarmsCount={metrics.alerts}
        userName={user?.email || "operator"}
        userRole={user?.role || "OPERATOR"}
        onLogout={logout}
        onOpenSettings={() => openTab("settings", "taskSettings", undefined, true)}
        t={t as any}
      />

      {/* Main Workspace layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Vertical IconRail */}
        <IconRail
          links={sidebarLinks}
          activeType={activeTab?.type}
          onLinkClick={handleSidebarClick}
          onSettingsClick={() => openTab("settings", "taskSettings", undefined, true)}
          onLogoutClick={logout}
          activeAlarmsCount={metrics.alerts}
          t={t as any}
        />

        {/* Dynamic Context Panel */}
        {activeTab?.type === "live" && (
          <ContextPanel title="Camera Directory" defaultWidth={220}>
            <div className="flex flex-col gap-2">
              <div className="text-[10px] text-control-text/60 uppercase tracking-widest font-bold">Sites & Sectors</div>
              <div className="border border-control-border bg-control-panel-light/30 rounded p-2">
                <div className="font-bold text-xs text-control-text-bright flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded bg-control-cyan shrink-0" />
                  HQ Paris
                </div>
                <div className="pl-3 mt-1.5 space-y-1">
                  {cameras.length === 0 ? (
                    <div className="text-[10px] text-control-text/40 italic">No cameras.</div>
                  ) : (
                    cameras.map(cam => (
                      <button 
                        key={cam.id} 
                        onClick={async () => {
                          const { emit } = await import("@tauri-apps/api/event");
                          await emit("camera-selected", { cameraId: cam.id });
                        }}
                        className="w-full flex items-center justify-between text-[10px] text-control-text hover:text-control-text-bright hover:bg-control-panel-light/30 px-1 py-0.5 rounded text-left transition cursor-pointer"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${cam.statut === "active" ? "bg-control-green" : "bg-control-red"}`} />
                          {cam.nom}
                        </span>
                        <span className="text-[8px] text-control-text/40">{cam.ptz_supported ? "PTZ" : ""}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ContextPanel>
        )}

        {activeTab?.type === "access" && (
          <ContextPanel title="Zone & Doors" defaultWidth={220}>
            <div className="flex flex-col gap-2">
              <div className="text-[10px] text-control-text/60 uppercase tracking-widest font-bold">Doors & Gates</div>
              <div className="border border-control-border bg-control-panel-light/30 rounded p-2 space-y-2">
                {doors.length === 0 ? (
                  <div className="text-[10px] text-control-text/40 italic">No doors registered.</div>
                ) : (
                  doors.map(door => (
                    <div key={door.id} className="flex items-center justify-between text-[10px]">
                      <span className="truncate flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${door.status === "open" ? "bg-control-green animate-pulse" : "bg-control-gray"}`} />
                        {door.name}
                      </span>
                      <span className="text-[8px] uppercase font-bold bg-control-panel-light px-1 border border-control-border rounded text-control-text/80">
                        {door.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ContextPanel>
        )}

        {activeTab?.type === "alarms" && (
          <ContextPanel title="Alarm Filters" defaultWidth={220}>
            <div className="flex flex-col gap-2">
              <div className="text-[10px] text-control-text/60 uppercase tracking-widest font-bold">Priority Levels</div>
              <div className="space-y-1.5 text-[10px] uppercase font-bold">
                <div className="flex justify-between items-center p-1.5 border border-control-red/20 bg-control-red/5 rounded text-control-red">
                  <span>Critical Alarms</span>
                  <span className="font-bold bg-control-red/25 px-1.5 rounded text-[9px]">{metrics.alerts}</span>
                </div>
                <div className="flex justify-between items-center p-1.5 border border-control-amber/20 bg-control-amber/5 rounded text-control-amber">
                  <span>Warnings</span>
                  <span className="font-bold bg-control-amber/25 px-1.5 rounded text-[9px]">0</span>
                </div>
                <div className="flex justify-between items-center p-1.5 border border-control-border bg-control-panel-light rounded text-control-text">
                  <span>Resolved Events</span>
                  <span className="font-bold bg-control-panel-light px-1.5 rounded text-[9px]">12</span>
                </div>
              </div>
            </div>
          </ContextPanel>
        )}

        {/* Center Canvas with tab bar and active component */}
        <MainCanvas
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={setActiveTabId}
          onTabClose={closeTab}
          onTabReorder={reorderTabs}
          onAddTabClick={(type, title) => openTab(type, title, undefined, true)}
          addTabLinks={sidebarLinks}
          getTabIcon={getTabIcon}
          t={t as any}
        >
          {activeTab?.type === "status" && <HomePortal />}
          {activeTab?.type === "live" && <LiveView />}
          {activeTab?.type === "access" && <AccessControl />}
          {activeTab?.type === "alarms" && <Alarms />}
          {activeTab?.type === "events" && <Events />}
          {activeTab?.type === "map" && <InteractiveMap />}
          {activeTab?.type === "camera-config" && <CameraConfig />}
          {activeTab?.type === "users" && <UserManagement />}
          {activeTab?.type === "settings" && <UserSettings theme={theme} onToggleTheme={onToggleTheme} />}
          
          {activeTab?.type === "reports" && (
            <div className="flex flex-col gap-6 overflow-y-auto h-full p-1">
              {/* Reports Dashboard Header */}
              <div className="flex items-center justify-between border-b border-control-border/60 pb-3">
                <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">Reports & Analytics Dashboard</h3>
                <span className="text-[10px] text-control-cyan bg-control-cyan/10 border border-control-cyan/20 px-2.5 py-0.5 rounded font-mono uppercase font-bold">
                  System Stats Ready
                </span>
              </div>

              {/* Stats overview cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="wardis-card p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-text">Video Uptime</div>
                  <div className="mt-2 text-2xl font-bold text-control-green">99.98%</div>
                  <div className="mt-1 text-[10px] text-control-text/60">No stream loss in 48h</div>
                </div>
                <div className="wardis-card p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-text">Intrusion Reports</div>
                  <div className="mt-2 text-2xl font-bold text-control-text-bright">{metrics.alerts} active</div>
                  <div className="mt-1 text-[10px] text-control-text/60">Average resolution: 4.2m</div>
                </div>
                <div className="wardis-card p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-text">Access Requests</div>
                  <div className="mt-2 text-2xl font-bold text-control-cyan">1,248</div>
                  <div className="mt-1 text-[10px] text-control-text/60">Last 24 hours stats</div>
                </div>
                <div className="wardis-card p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-text">Export Formats</div>
                  <div className="mt-2 text-2xl font-bold text-control-text-bright">PDF / CSV</div>
                  <div className="mt-1 text-[10px] text-control-text/60">Automated scheduling active</div>
                </div>
              </div>

              {/* Detailed Tables & Mock Charts */}
              <div className="grid gap-6 xl:grid-cols-12">
                {/* Available Export Templates */}
                <div className="xl:col-span-7 wardis-panel p-5">
                  <h4 className="text-xs font-bold text-control-text-bright uppercase tracking-wider border-b border-control-border/60 pb-2 mb-3">
                    Export Templates
                  </h4>
                  <div className="space-y-2 text-xs">
                    {([
                      { name: "Daily Access Logs Summary", desc: "List of all cardholder entries, exits and denials in secure areas.", size: "1.2 MB", format: "PDF" },
                      { name: "Alarm Activity Report", desc: "Chronological list of intrusion sensor activations and operator acknowledgments.", size: "840 KB", format: "CSV" },
                      { name: "Camera System Health Audit", desc: "Network status, packet loss metrics, latency statistics and storage usage per stream.", size: "2.1 MB", format: "PDF" }
                    ]).map((rep, idx) => (
                      <div key={idx} className="flex items-center justify-between border border-control-border bg-control-panel-light/30 rounded p-3 hover:border-control-cyan/40 transition-colors">
                        <div>
                          <div className="font-bold text-control-text-bright">{rep.name}</div>
                          <div className="text-[10px] text-control-text/60 mt-0.5">{rep.desc}</div>
                        </div>
                        <button className="flex items-center gap-1 bg-control-panel border border-control-border text-control-cyan px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md hover:border-control-cyan hover:bg-control-cyan/10 cursor-pointer">
                          <FileText className="h-3 w-3" />
                          <span>Export ({rep.format})</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alarm Frequency Mock Chart */}
                <div className="xl:col-span-5 wardis-panel p-5 flex flex-col justify-between">
                  <h4 className="text-xs font-bold text-control-text-bright uppercase tracking-wider border-b border-control-border/60 pb-2 mb-3">
                    Alert Load (7 days)
                  </h4>
                  <div className="flex-1 flex items-end justify-between h-36 px-4 py-2 border-b border-control-border/40 gap-2 font-mono">
                    {([
                      { day: "Mon", val: "h-12", count: 4 },
                      { day: "Tue", val: "h-20", count: 7 },
                      { day: "Wed", val: "h-8", count: 2 },
                      { day: "Thu", val: "h-28", count: 11 },
                      { day: "Fri", val: "h-16", count: 5 },
                      { day: "Sat", val: "h-32", count: 14 },
                      { day: "Sun", val: "h-10", count: 3 }
                    ]).map((bar, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className="text-[9px] font-bold text-control-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                          {bar.count}
                        </span>
                        <div className={`w-full bg-control-cyan/40 border border-control-cyan/60 rounded-t ${bar.val} group-hover:bg-control-cyan/70 transition-colors duration-200`} />
                        <span className="text-[9px] text-control-text/60">{bar.day}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-control-text/50 mt-3 text-center leading-relaxed">
                    Peak load detected on Saturday (14 alarms). Next automated weekly cleanup scheduled for Sunday at 23:59.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab?.type === "admin-system" && (
            <div className="flex flex-col gap-4 h-full overflow-hidden">
              <div className="flex border-b border-control-border bg-control-panel/40 p-2 gap-2 shrink-0">
                <button
                  onClick={() => setAdminSubTab("cameras")}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    adminSubTab === "cameras"
                      ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30"
                      : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
                  }`}
                >
                  {t("taskCameraConfig" as any)}
                </button>
                <button
                  onClick={() => setAdminSubTab("users")}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    adminSubTab === "users"
                      ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30"
                      : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
                  }`}
                >
                  {t("taskUsers" as any)}
                </button>
                <button
                  onClick={() => setAdminSubTab("diagnostics")}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    adminSubTab === "diagnostics"
                      ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30"
                      : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
                  }`}
                >
                  {t("taskDiagnostics" as any)}
                </button>
              </div>
              <div className="flex-1 overflow-auto p-1">
                {adminSubTab === "cameras" && <CameraConfig />}
                {adminSubTab === "users" && <UserManagement />}
                {adminSubTab === "diagnostics" && (
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
                        <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">{t("activeAlarms" as any)}</div>
                        <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.alerts}</div>
                        <div className="mt-1 text-xs text-control-text">{t("alertsPriority" as any)}</div>
                      </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-12">
                      {/* System Health */}
                      <div className="xl:col-span-6 wardis-panel p-6">
                        <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                           <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">{t("serviceStatus")}</h3>
                           <span className="rounded bg-control-panel-light px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-control-text border border-control-border">
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
            </div>
          )}
          
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
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">{t("activeAlarms" as any)}</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.alerts}</div>
                  <div className="mt-1 text-xs text-control-text">{t("alertsPriority" as any)}</div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-12">
                {/* System Health */}
                <div className="xl:col-span-6 wardis-panel p-6">
                  <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                     <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">{t("serviceStatus")}</h3>
                     <span className="rounded bg-control-panel-light px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-control-text border border-control-border">
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
        </MainCanvas>
      </div>

      {/* Bottom status diagnostics bar */}
      <StatusBar
        serverStatus="stable"
        latency={latency}
        camerasCount={cameras.length}
        camerasOnline={metrics.activeCameras}
        storageUsedPercent={42}
        selectedTileTelemetry={selectedTileTelemetry}
        t={t as any}
      />
    </div>
  );
};
