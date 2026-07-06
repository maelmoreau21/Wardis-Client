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
  Film, BarChart3, SlidersHorizontal, History
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
import { Investigation } from "./Investigation";
import { Reports } from "./Reports";

// Layout components
import { TabBar } from "./layout/TabBar";
import { ContextPanel } from "./layout/ContextPanel";
import { MainCanvas } from "./layout/MainCanvas";
import { SurveillanceTree } from "./layout/SurveillanceTree";

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
    return () => { disconnectEventStream(); };
  }, [connectEventStream, disconnectEventStream]);

  useEffect(() => { fetchDoors().catch(() => {}); }, [fetchDoors]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const events: TranslationKey[] = [
      "accessSystemReady", "videoSyncOk", "intrusionZonesArmed",
      "eventStreamStable", "noCriticalAlerts"
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
    activeCameras: cameras.filter((c) => c.statut === "active").length,
    openDoors: doors.filter((d) => d.status === "open").length,
    closedDoors: doors.filter((d) => d.status === "closed").length,
    alerts: activeAlarms.length,
  }), [cameras, doors, activeAlarms]);

  // Module link config — used by "+" menu & keyboard shortcuts
  const moduleLinks = useMemo(() => [
    { key: "live",          type: "live"         as TabType, labelKey: "taskLive"         as TranslationKey, icon: Camera,          closable: true },
    { key: "investigation", type: "investigation" as TabType, labelKey: "taskInvestigation" as TranslationKey, icon: History,         closable: true },
    { key: "alarms",        type: "alarms"        as TabType, labelKey: "taskAlarms"       as TranslationKey, icon: ShieldAlert,      closable: true },
    { key: "access",        type: "access"        as TabType, labelKey: "taskAccess"       as TranslationKey, icon: DoorOpen,        closable: true },
    { key: "map",           type: "map"           as TabType, labelKey: "taskMap"          as TranslationKey, icon: Map,             closable: true },
    { key: "events",        type: "events"        as TabType, labelKey: "taskEvents"       as TranslationKey, icon: Film,            closable: true },
    { key: "reports",       type: "reports"       as TabType, labelKey: "taskReports"      as TranslationKey, icon: BarChart3,       closable: true },
    { key: "admin-system",  type: "admin-system"  as TabType, labelKey: "taskAdmin"        as TranslationKey, icon: SlidersHorizontal, closable: true },
  ], []);

  // Keyboard shortcuts Ctrl+1 … Ctrl+8
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 8) {
          e.preventDefault();
          const target = moduleLinks[num - 1];
          if (target) openTab(target.type, target.labelKey, undefined, target.closable);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moduleLinks, openTab]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const getTabIcon = (type: TabType) => {
    switch (type) {
      case "status":        return LayoutGrid;
      case "live":          return Camera;
      case "access":        return DoorOpen;
      case "alarms":        return ShieldAlert;
      case "events":        return Film;
      case "map":           return Map;
      case "users":         return Users;
      case "settings":      return Settings;
      case "camera-config": return Video;
      case "diagnostics":   return Cpu;
      case "reports":       return BarChart3;
      case "admin-system":  return SlidersHorizontal;
      case "investigation": return History;
      default:              return undefined;
    }
  };

  return (
    <div className={`flex flex-col h-screen w-screen bg-control-bg text-control-text select-none overflow-hidden font-sans ${theme === "dark" ? "theme-dark" : "theme-light"}`}>

      {/* ── Single top-of-window navigation bar ── */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={closeTab}
        onTabReorder={reorderTabs}
        onAddTab={(type, label) => openTab(type, label, undefined, true)}
        moduleLinks={moduleLinks}
        getTabIcon={getTabIcon as any}
        serverTime={time.toLocaleTimeString()}
        connectionStatus="online"
        activeAlarmsCount={metrics.alerts}
        userName={user?.email || "operator"}
        userRole={user?.role || "OPERATOR"}
        onLogout={logout}
        onOpenSettings={() => openTab("settings", "taskSettings", undefined, true)}
        t={t as any}
      />

      {/* ── Workspace body: optional context panel + main canvas ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Context panel — only shown for relevant modules */}
        {activeTab?.type === "live" && (
          <ContextPanel title="Répertoire des caméras" defaultWidth={230}>
            <SurveillanceTree />
          </ContextPanel>
        )}

        {activeTab?.type === "access" && (
          <ContextPanel title="Zones et portes" defaultWidth={220}>
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-control-text/60">Portes et portails</div>
              <div className="border border-control-border bg-control-panel-light/30 rounded p-2 space-y-2">
                {doors.length === 0 ? (
                  <div className="text-xs text-control-text/50 italic">Aucune porte enregistrée.</div>
                ) : (
                  doors.map((door) => (
                    <div key={door.id} className="flex items-center justify-between text-[10px]">
                      <span className="truncate flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${door.status === "open" ? "bg-control-green animate-pulse" : "bg-control-gray"}`} />
                        {door.name}
                      </span>
                      <span className="text-xs font-medium bg-control-panel-light px-2 py-0.5 border border-control-border rounded-full text-control-text/80">
                        {door.status === "open" ? "Ouverte" : "Fermée"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ContextPanel>
        )}

        {activeTab?.type === "alarms" && (
          <ContextPanel title="Filtres alarmes" defaultWidth={220}>
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-control-text/60">Niveaux de priorité</div>
              <div className="space-y-1.5 text-xs font-medium">
                <div className="flex justify-between items-center p-1.5 border border-control-red/20 bg-control-red/5 rounded text-control-red">
                  <span>Alarmes critiques</span>
                  <span className="font-bold bg-control-red/25 px-1.5 rounded text-[9px]">{metrics.alerts}</span>
                </div>
                <div className="flex justify-between items-center p-1.5 border border-control-amber/20 bg-control-amber/5 rounded text-control-amber">
                  <span>Avertissements</span>
                  <span className="font-bold bg-control-amber/25 px-1.5 rounded text-[9px]">0</span>
                </div>
                <div className="flex justify-between items-center p-1.5 border border-control-border bg-control-panel-light rounded text-control-text">
                  <span>Événements résolus</span>
                  <span className="font-bold bg-control-panel-light px-1.5 rounded text-[9px]">12</span>
                </div>
              </div>
            </div>
          </ContextPanel>
        )}

        {/* ── Main content area ── */}
        <MainCanvas>
          {activeTab?.type === "status"       && <HomePortal />}
          {activeTab?.type === "live"         && <LiveView />}
          {activeTab?.type === "access"       && <AccessControl />}
          {activeTab?.type === "alarms"       && <Alarms />}
          {activeTab?.type === "events"       && <Events />}
          {activeTab?.type === "map"          && <InteractiveMap />}
          {activeTab?.type === "camera-config" && <CameraConfig />}
          {activeTab?.type === "users"        && <UserManagement />}
          {activeTab?.type === "settings"     && <UserSettings theme={theme} onToggleTheme={onToggleTheme} />}
          {activeTab?.type === "investigation" && <Investigation />}
          {activeTab?.type === "reports"      && <Reports />}

          {activeTab?.type === "admin-system" && (
            <div className="flex flex-col gap-4 h-full overflow-hidden">
              {/* Sub-tab bar */}
              <div className="flex border-b border-control-border bg-control-panel/40 p-2 gap-2 shrink-0">
                {(["cameras", "users", "diagnostics"] as const).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setAdminSubTab(sub)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                      adminSubTab === sub
                        ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30"
                        : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
                    }`}
                  >
                    {sub === "cameras" ? t("taskCameraConfig" as any) : sub === "users" ? t("taskUsers" as any) : t("taskDiagnostics" as any)}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto p-1">
                {adminSubTab === "cameras" && <CameraConfig />}
                {adminSubTab === "users"   && <UserManagement />}
                {adminSubTab === "diagnostics" && (
                  <div className="flex flex-col gap-6">
                    <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <div className="wardis-card p-6">
                        <div className="text-xs font-medium text-control-cyan mb-1">{t("activeCameras")}</div>
                        <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.activeCameras}</div>
                        <div className="mt-1 text-xs text-control-text">{t("camerasSynced")}</div>
                      </div>
                      <div className="wardis-card p-6">
                        <div className="text-xs font-medium text-control-cyan mb-1">{t("doors")}</div>
                        <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.openDoors}/{doors.length}</div>
                        <div className="mt-1 text-xs text-control-text">{t("doorsStatusDesc")}</div>
                      </div>
                      <div className="wardis-card p-6">
                        <div className="text-xs font-medium text-control-cyan mb-1">{t("activeAlarms" as any)}</div>
                        <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.alerts}</div>
                        <div className="mt-1 text-xs text-control-text">{t("alertsPriority" as any)}</div>
                      </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-12">
                      <div className="xl:col-span-6 wardis-panel p-6">
                        <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                          <h3 className="text-sm font-semibold text-control-text-bright">{t("serviceStatus")}</h3>
                          <span className="rounded bg-control-panel-light px-2 py-0.5 text-xs font-semibold text-control-text border border-control-border">
                            {t("latency", { latency })}
                          </span>
                        </div>
                        <div className="space-y-3.5 text-sm text-control-text">
                          {[["generalStatus", "statusStable"], ["natsServer", "natsConnected"], ["accessGateway", "gatewayOnline"], ["videoServer", "serverActive"]].map(([label, status]) => (
                            <div key={label} className="flex items-center justify-between">
                              <span>{t(label as any)}</span>
                              <span className="font-semibold text-control-green text-xs bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">{t(status as any)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="xl:col-span-6 wardis-panel p-6">
                        <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                          <h3 className="text-sm font-semibold text-control-text-bright">{t("systemJournal")}</h3>
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
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">{t("activeCameras")}</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.activeCameras}</div>
                  <div className="mt-1 text-xs text-control-text">{t("camerasSynced")}</div>
                </div>
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">{t("doors")}</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.openDoors}/{doors.length}</div>
                  <div className="mt-1 text-xs text-control-text">{t("doorsStatusDesc")}</div>
                </div>
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">{t("activeAlarms" as any)}</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.alerts}</div>
                  <div className="mt-1 text-xs text-control-text">{t("alertsPriority" as any)}</div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-12">
                <div className="xl:col-span-6 wardis-panel p-6">
                  <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                    <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">{t("serviceStatus")}</h3>
                    <span className="rounded bg-control-panel-light px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-control-text border border-control-border">
                      {t("latency", { latency })}
                    </span>
                  </div>
                  <div className="space-y-3.5 text-xs text-control-text">
                    {[["generalStatus", "statusStable"], ["natsServer", "natsConnected"], ["accessGateway", "gatewayOnline"], ["videoServer", "serverActive"]].map(([label, status]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span>{t(label as any)}</span>
                        <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">{t(status as any)}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
    </div>
  );
};
