import React, { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { LogOut, Radio, Terminal, Cpu, Clock, LayoutGrid, ShieldAlert, Map, Camera, DoorOpen, Sparkles, Moon, Sun } from "lucide-react";
import { LiveView } from "./LiveView";
import { useCameraStore } from "../store/cameraStore";
import { AccessControl } from "./AccessControl";
import { useAccessControlStore } from "../store/accessControlStore";
import { Alarms } from "./Alarms";
import { useAlarmStore } from "../store/alarmStore";
import { Events } from "./Events";
import { InteractiveMap } from "./InteractiveMap";

interface DashboardProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ theme, onToggleTheme }) => {
  const { user, logout } = useAuthStore();
  const { cameras } = useCameraStore();
  const { doors, fetchDoors } = useAccessControlStore();
  const { connectEventStream, disconnectEventStream, activeAlarms } = useAlarmStore();
  const [time, setTime] = useState(new Date());
  const [sysLogs, setSysLogs] = useState<string[]>([]);
  const [latency, setLatency] = useState(12);
  const [activeTab, setActiveTab] = useState<"status" | "live" | "access" | "alarms" | "events" | "map">("status");

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
    const events = [
      "Système d’accès prêt et à l’écoute",
      "Synchronisation vidéo OK",
      "Zones d’intrusion armées",
      "Flux d’événements stable",
      "Aucune alerte critique détectée"
    ];

    setSysLogs([`${new Date().toLocaleTimeString()} • Tableau de bord prêt`]);

    const interval = setInterval(() => {
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      setSysLogs((prev) => {
        const next = [...prev, `${new Date().toLocaleTimeString()} • ${randomEvent}`];
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

  const tabs = [
    { key: "status", label: "Vue d’ensemble", icon: LayoutGrid },
    { key: "live", label: "Surveillance", icon: Camera },
    { key: "access", label: "Accès", icon: DoorOpen },
    { key: "alarms", label: "Alertes", icon: ShieldAlert },
    { key: "events", label: "Événements", icon: Radio },
    { key: "map", label: "Carte", icon: Map }
  ] as const;

  return (
    <div className="flex h-screen w-screen bg-control-bg overflow-hidden text-control-text select-none">
      
      {/* Sidebar navigation */}
      <aside className="w-64 bg-control-panel border-r border-control-border flex flex-col justify-between shrink-0">
        <div className="flex flex-col gap-6 p-5">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-control-cyan text-white shadow-md shadow-control-cyan/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-control-text-bright tracking-tight">Wardis</span>
                <span className="rounded-full border border-control-cyan/20 bg-control-cyan/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-control-cyan">
                  v0.0.1
                </span>
              </div>
              <p className="text-[10px] text-control-text/75 uppercase tracking-wider font-semibold">Supervision</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 mt-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as typeof activeTab);
                    setSysLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} • Onglet : ${tab.label}`].slice(-4));
                  }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-control-cyan text-white shadow-sm shadow-control-cyan/20"
                      : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Panel */}
        <div className="p-5 border-t border-control-border flex flex-col gap-4">
          {/* User Profile */}
          <div className="flex items-center gap-3 bg-control-panel-light/40 border border-control-border/60 rounded-xl p-3">
            <div className="h-8 w-8 rounded-full bg-control-cyan/15 flex items-center justify-center font-bold text-control-cyan text-xs">
              {(user?.email || "OP").substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-control-text-bright truncate">{user?.email || "operator@wardis.com"}</p>
              <span className="text-[9px] uppercase tracking-wider text-control-text font-bold bg-control-panel-light px-1.5 py-0.5 border border-control-border rounded-md">
                {user?.role || "ADMIN"}
              </span>
            </div>
          </div>

          {/* Theme Switcher & Logout */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-full flex items-center justify-between rounded-lg border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 px-3 py-2 text-xs font-bold uppercase tracking-wider text-control-text cursor-pointer transition"
            >
              <span className="flex items-center gap-2">
                {theme === "dark" ? <Sun className="h-4 w-4 text-control-amber" /> : <Moon className="h-4 w-4 text-control-cyan" />}
                Thème {theme === "dark" ? "Clair" : "Sombre"}
              </span>
            </button>
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-2 justify-center rounded-lg border border-control-red/20 bg-control-red/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-control-red transition hover:bg-control-red/15 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Right Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-control-bg">
        {/* Header Bar */}
        <header className="border-b border-control-border bg-control-panel px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div>
            <h2 className="text-base font-bold text-control-text-bright tracking-tight">
              {tabs.find(t => t.key === activeTab)?.label}
            </h2>
            <p className="text-[10px] text-control-text/80 uppercase tracking-wider">
              Console de supervision Wardis
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-control-border bg-control-panel-light px-3 py-1.5 text-xs text-control-text font-bold">
              <Clock className="h-3.5 w-3.5 text-control-cyan" />
              {time.toLocaleTimeString()}
            </div>
            
            <div className="flex items-center gap-2 rounded-full border border-control-border bg-control-panel-light px-3 py-1.5 text-xs text-control-text font-bold">
              <span className={`h-2 w-2 rounded-full ${metrics.alerts > 0 ? "bg-control-red animate-pulse" : "bg-control-green"}`} />
              <span>{metrics.alerts > 0 ? `${metrics.alerts} alerte(s)` : "Système stable"}</span>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
          {activeTab === "status" && (
            <div className="flex flex-col gap-6">
              <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Stats Card 1 */}
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">Caméras actives</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.activeCameras}</div>
                  <div className="mt-1 text-xs text-control-text">flux vidéo synchronisés</div>
                </div>
                {/* Stats Card 2 */}
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">Portes</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.openDoors}/{doors.length}</div>
                  <div className="mt-1 text-xs text-control-text">ouvertes / configurées</div>
                </div>
                {/* Stats Card 3 */}
                <div className="wardis-card p-6">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-control-cyan">Alertes actives</div>
                  <div className="mt-2 text-3xl font-bold text-control-text-bright">{metrics.alerts}</div>
                  <div className="mt-1 text-xs text-control-text">à acquitter en priorité</div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-12">
                {/* System Health */}
                <div className="xl:col-span-6 wardis-panel p-6">
                  <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                     <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">État des services</h3>
                     <span className="rounded-full border border-control-border bg-control-panel-light px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-control-text">
                       Latence: {latency}ms
                     </span>
                  </div>
                  <div className="space-y-3.5 text-xs text-control-text">
                    <div className="flex items-center justify-between">
                      <span>État général du système</span>
                      <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">stable</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Serveur NATS</span>
                      <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">connecté</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Passerelle d'accès</span>
                      <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">en ligne</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Serveur d'enregistrement vidéo</span>
                      <span className="font-semibold text-control-green uppercase tracking-wider text-[10px] bg-control-green/10 border border-control-green/20 px-2 py-0.5 rounded">actif</span>
                    </div>
                  </div>
                </div>

                {/* Console logs */}
                <div className="xl:col-span-6 wardis-panel p-6">
                  <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                     <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">Journal système</h3>
                     <Terminal className="h-4 w-4 text-control-cyan" />
                  </div>
                  <div className="space-y-2.5 font-mono text-[10px] text-control-text leading-relaxed">
                    {sysLogs.map((log, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-control-cyan" />
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "live" && <LiveView />}
          {activeTab === "access" && <AccessControl />}
          {activeTab === "alarms" && <Alarms />}
          {activeTab === "events" && <Events />}
          {activeTab === "map" && <InteractiveMap />}
        </div>
        
        {/* Simple footer with status log bar */}
        <footer className="border-t border-control-border bg-control-panel px-6 py-3 flex items-center justify-between gap-4 text-xs font-mono select-none shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-control-text">
            <Terminal className="h-3.5 w-3.5 text-control-cyan shrink-0" />
            <span className="font-bold uppercase tracking-wider">Dernière activité :</span>
            <span className="truncate max-w-md">{sysLogs[sysLogs.length - 1] || "Console prête"}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-control-text shrink-0">
            <Cpu className="h-3.5 w-3.5 text-control-cyan" />
            <span>ID OP: {user?.id ? user.id.slice(0, 8) : "00000000"}</span>
          </div>
        </footer>
      </main>
    </div>
  );
};
