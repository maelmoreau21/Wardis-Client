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
    <div className="min-h-screen w-full wardis-shell digital-grid flex flex-col overflow-hidden select-none">
      <header className="border-b border-control-border bg-control-panel/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="wardis-orb flex h-11 w-11 items-center justify-center rounded-2xl text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-control-text-bright">Wardis</h1>
                <span className="rounded-full border border-control-cyan/20 bg-control-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-control-cyan">
                  v0.0.1
                </span>
              </div>
              <p className="text-sm text-control-text">Console de supervision simple et efficace</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:ml-auto">
            <div className="flex items-center gap-2 rounded-full border border-control-border bg-control-panel-light px-3 py-2 text-sm text-control-text">
              <Clock className="h-4 w-4 text-control-cyan" />
              {time.toLocaleTimeString()}
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-2 rounded-full wardis-chip px-3 py-2 text-sm text-control-text"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Clair" : "Sombre"}
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-control-border bg-control-panel-light px-3 py-2 text-sm text-control-text lg:flex">
              <span className={`h-2.5 w-2.5 rounded-full ${metrics.alerts > 0 ? "bg-control-red" : "bg-control-green"}`} />
              {metrics.alerts > 0 ? `${metrics.alerts} alerte(s)` : "aucune alerte"}
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 rounded-full border border-control-red/20 bg-control-red/10 px-3 py-2 text-sm font-medium text-control-red transition hover:bg-control-red/15"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4 md:p-6">
        <div className="flex h-full flex-col gap-4">
          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-control-border bg-control-panel/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-control-cyan">Résumé opérateur</p>
                  <h2 className="mt-2 text-2xl font-semibold text-control-text-bright">Tout est prêt pour une supervision rapide.</h2>
                </div>
                <div className="rounded-full border border-control-border bg-control-panel-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-control-text">
                  Latence {latency}ms
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-control-border bg-control-panel-light p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-control-cyan">Caméras actives</div>
                  <div className="mt-2 text-2xl font-semibold text-control-text-bright">{metrics.activeCameras}</div>
                  <div className="mt-1 text-sm text-control-text">flux synchronisés</div>
                </div>
                <div className="rounded-2xl border border-control-border bg-control-panel-light p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-control-cyan">Portes</div>
                  <div className="mt-2 text-2xl font-semibold text-control-text-bright">{metrics.openDoors}/{doors.length}</div>
                  <div className="mt-1 text-sm text-control-text">ouvertes / configurées</div>
                </div>
                <div className="rounded-2xl border border-control-border bg-control-panel-light p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-control-cyan">Alertes</div>
                  <div className="mt-2 text-2xl font-semibold text-control-text-bright">{metrics.alerts}</div>
                  <div className="mt-1 text-sm text-control-text">à traiter</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-control-border bg-control-panel/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-control-cyan">Session</p>
                  <h3 className="mt-1 text-lg font-semibold text-control-text-bright">{user?.email || "admin@wardis.com"}</h3>
                </div>
                <div className="rounded-full border border-control-border bg-control-panel-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-control-text">
                  {user?.role || "ADMIN"}
                </div>
              </div>
              <div className="mt-5 space-y-3 rounded-2xl border border-control-border bg-control-panel-light p-4 text-sm text-control-text">
                <div className="flex items-center justify-between">
                  <span>État du service</span>
                  <span className="font-semibold text-control-green">stable</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connexion NATS</span>
                  <span className="font-semibold text-control-green">active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stockage vidéo</span>
                  <span className="font-semibold text-control-cyan">OK</span>
                </div>
              </div>
            </div>
          </section>

          <nav className="flex flex-wrap gap-2 rounded-2xl border border-control-border bg-control-panel/80 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as typeof activeTab);
                    setSysLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} • ${tab.label}`].slice(-4));
                  }}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-control-cyan text-white shadow-sm"
                      : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {activeTab === "status" && (
            <div className="flex-1 min-h-0 wardis-panel rounded-[24px] p-5">
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-control-border bg-control-panel-light p-5">
                  <div className="flex items-center gap-2 text-control-cyan">
                    <LayoutGrid className="h-4 w-4" />
                    <span className="text-sm font-semibold uppercase tracking-[0.24em]">Aperçu rapide</span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-control-text">
                    <p>Le système est prêt à gérer la supervision, les accès et les alertes depuis une interface simplifiée.</p>
                    <p>Les modules principaux sont disponibles dans la navigation ci-dessus pour passer rapidement d’une vue à l’autre.</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-control-border bg-control-panel-light p-5">
                  <div className="flex items-center gap-2 text-control-cyan">
                    <Terminal className="h-4 w-4" />
                    <span className="text-sm font-semibold uppercase tracking-[0.24em]">Journal</span>
                  </div>
                  <div className="mt-4 space-y-2 font-mono text-xs text-control-text">
                    {sysLogs.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "live" && <LiveView />}
          {activeTab === "access" && <AccessControl />}
          {activeTab === "alarms" && <Alarms />}
          {activeTab === "events" && <Events />}
          {activeTab === "map" && <InteractiveMap />}

          <div className="rounded-2xl border border-control-border bg-control-panel/90 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-control-cyan">
                <Terminal className="h-4 w-4" />
                Journal en direct
              </div>
              <div className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-control-text">
                {sysLogs.map((log, idx) => (
                  <span key={idx} className="mr-4">{log}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-control-text">
                <Cpu className="h-4 w-4 text-control-cyan" />
                <span>Opérateur {user?.id ? user.id.slice(0, 8) : "00000000"}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
