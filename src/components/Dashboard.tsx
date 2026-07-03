import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { LogOut, Radio, Terminal, Cpu, Clock, LayoutGrid, ShieldAlert } from "lucide-react";
import { LiveView } from "./LiveView";
import { useCameraStore } from "../store/cameraStore";
import { AccessControl } from "./AccessControl";
import { useAccessControlStore } from "../store/accessControlStore";
import { Alarms } from "./Alarms";
import { useAlarmStore } from "../store/alarmStore";
import { Events } from "./Events";

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { cameras } = useCameraStore();
  const { doors, fetchDoors } = useAccessControlStore();
  const { connectEventStream, disconnectEventStream, activeAlarms } = useAlarmStore();
  const [time, setTime] = useState(new Date());
  const [sysLogs, setSysLogs] = useState<string[]>([]);
  const [latency, setLatency] = useState(12);
  const [activeTab, setActiveTab] = useState<"status" | "live" | "access" | "alarms" | "events">("status");

  // Connect real-time alarms SSE stream
  useEffect(() => {
    connectEventStream();
    return () => {
      disconnectEventStream();
    };
  }, [connectEventStream, disconnectEventStream]);

  // Fetch access control doors on mount
  useEffect(() => {
    fetchDoors().catch(() => {});
  }, [fetchDoors]);

  // Time tick
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulated telemetry ticker
  useEffect(() => {
    const events = [
      "Access Control subsystem standby - listening on NATS...",
      "Video module sync successful. Stream ingestion idle.",
      "Intrusion alarm network armed: ALL ZONES SECURED.",
      "Events correlation engine listening on NATs topics...",
      "No security alerts detected. System integrity: 100%",
    ];

    setSysLogs([`[${new Date().toLocaleTimeString()}] System boot complete. All modules loaded.`]);

    const interval = setInterval(() => {
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      setSysLogs((prev) => {
        const next = [...prev, `[${new Date().toLocaleTimeString()}] ${randomEvent}`];
        // Keep last 4 logs
        return next.slice(-4);
      });
      // Vary latency slightly
      setLatency(Math.floor(Math.random() * 8) + 8);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full bg-control-bg text-control-text digital-grid flex flex-col crt-overlay overflow-hidden select-none">
      
      {/* Header telemetry panel */}
      <header className="bg-control-panel border-b border-control-border flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
        
        {/* Title Group */}
        <div className="flex items-center gap-3">
          <div className="p-2 border border-control-cyan bg-control-cyan/5 text-control-cyan animate-pulse">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-control-text-bright font-bold tracking-widest text-sm uppercase">
                Wardis Telemetry Gateway
              </h1>
              <span className="text-[9px] px-1.5 py-0.5 bg-control-cyan/10 border border-control-cyan/30 text-control-cyan font-mono">
                SECURE BRIDGE
              </span>
            </div>
            <p className="text-[10px] text-control-text/60 font-mono tracking-wider">
              IP: localhost:8080 • CONNECTION LATENCY: {latency}ms
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6 font-mono text-[10px]">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${activeAlarms.length > 0 ? "bg-control-red" : "bg-control-green"}`} />
            <span>ALARM: {activeAlarms.length > 0 ? "CRITICAL ALERT" : "ACTIVE"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-control-green animate-pulse" />
            <span>VIDEO: SYNCED</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-control-green animate-pulse" />
            <span>NATS: ONLINE</span>
          </div>
        </div>

        {/* User / Session Info */}
        <div className="flex items-center gap-4 ml-0 md:ml-auto">
          <div className="text-right font-mono text-xs hidden sm:block">
            <div className="text-control-text-bright font-semibold">
              {user?.email || "admin@wardis.com"}
            </div>
            <div className="text-[10px] text-control-cyan uppercase tracking-wider font-semibold">
              OPERATOR ROLE: {user?.role || "ADMIN"}
            </div>
          </div>

          <div className="p-2 border border-control-border bg-control-panel-light text-control-cyan font-mono text-xs flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-control-cyan" />
            <span>{time.toLocaleTimeString()}</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 border border-control-red/60 bg-control-red/5 hover:bg-control-red/10 text-control-red text-xs py-2 px-3 tracking-wider cursor-pointer font-bold transition-all hover:border-control-red rounded-none"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">DISCONNECT</span>
          </button>
        </div>
      </header>

      {/* Main dashboard content area */}
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        
        {/* Top metrics bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-control-panel border border-control-border p-3 brackets">
            <div className="text-[10px] uppercase text-control-cyan tracking-wider font-semibold">Uptime Status</div>
            <div className="text-lg font-bold text-control-text-bright mt-1 font-mono">99.98%</div>
            <div className="text-[9px] text-control-green font-mono mt-0.5">▲ RUNNING OPTIMAL</div>
          </div>
          <div className="bg-control-panel border border-control-border p-3 brackets">
            <div className="text-[10px] uppercase text-control-cyan tracking-wider font-semibold">Access Doors</div>
            <div className="text-lg font-bold text-control-text-bright mt-1 font-mono">{doors.length} Terminals</div>
            <div className="text-[9px] text-control-green font-mono mt-0.5">
              {doors.filter(d => d.status === "open").length} OPENED • {doors.filter(d => d.status === "closed").length} LOCKED
            </div>
          </div>
          <div className="bg-control-panel border border-control-border p-3 brackets">
            <div className="text-[10px] uppercase text-control-cyan tracking-wider font-semibold">Cameras Ingest</div>
            <div className="text-lg font-bold text-control-text-bright mt-1 font-mono">
              {cameras.filter(c => c.statut === "active").length} Streams
            </div>
            <div className="text-[9px] text-control-text/40 font-mono mt-0.5">MEDIAMTX SYNCED</div>
          </div>
          <div className="bg-control-panel border border-control-border p-3 brackets">
            <div className="text-[10px] uppercase text-control-cyan tracking-wider font-semibold">System Memory</div>
            <div className="text-lg font-bold text-control-text-bright mt-1 font-mono">14.2 MB</div>
            <div className="text-[9px] text-control-cyan font-mono mt-0.5">TAURI CORE RUNTIME</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-control-border gap-2 pb-0.5 shrink-0 font-mono text-xs">
          <button
            onClick={() => {
              setActiveTab("status");
              setSysLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Navigated to: System Telemetry Overview`].slice(-4));
            }}
            className={`px-4 py-2 border-t border-x transition-all uppercase tracking-wider font-bold cursor-pointer ${
              activeTab === "status"
                ? "border-control-cyan text-control-cyan bg-control-panel/20"
                : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35"
            }`}
          >
            System Status
          </button>
          <button
            onClick={() => {
              setActiveTab("live");
              setSysLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Navigated to: Live Camera Surveillance`].slice(-4));
            }}
            className={`px-4 py-2 border-t border-x transition-all uppercase tracking-wider font-bold cursor-pointer flex items-center gap-2 ${
              activeTab === "live"
                ? "border-control-cyan text-control-cyan bg-control-panel/20"
                : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-control-red animate-pulse" />
            Live Surveillance
          </button>
          <button
            onClick={() => {
              setActiveTab("access");
              setSysLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Navigated to: Access Control Panel`].slice(-4));
            }}
            className={`px-4 py-2 border-t border-x transition-all uppercase tracking-wider font-bold cursor-pointer flex items-center gap-2 ${
              activeTab === "access"
                ? "border-control-cyan text-control-cyan bg-control-panel/20"
                : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-control-cyan animate-pulse" />
            Access Control
          </button>
          <button
            onClick={() => {
              setActiveTab("alarms");
              setSysLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Navigated to: Intrusion & Alarms Control Panel`].slice(-4));
            }}
            className={`px-4 py-2 border-t border-x transition-all uppercase tracking-wider font-bold cursor-pointer flex items-center gap-2 ${
              activeTab === "alarms"
                ? "border-control-cyan text-control-cyan bg-control-panel/20"
                : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35"
            }`}
          >
            <ShieldAlert className={`h-3.5 w-3.5 ${activeAlarms.length > 0 ? "text-control-red animate-bounce" : "text-control-cyan"}`} />
            <span>Intrusion & Alarms</span>
            {activeAlarms.length > 0 && (
              <span className="ml-1 px-1.5 bg-control-red text-control-text-bright text-[8px] font-bold font-mono">
                {activeAlarms.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("events");
              setSysLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Navigated to: Events Correlation Feed`].slice(-4));
            }}
            className={`px-4 py-2 border-t border-x transition-all uppercase tracking-wider font-bold cursor-pointer flex items-center gap-2 ${
              activeTab === "events"
                ? "border-control-cyan text-control-cyan bg-control-panel/20"
                : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35"
            }`}
          >
            <Radio className="h-3.5 w-3.5 text-control-cyan" />
            <span>Events Correlation</span>
          </button>
        </div>

        {/* Central Workspace (Tab rendering) */}
        {activeTab === "status" && (
          <div className="flex-1 min-h-0 bg-control-panel/30 border border-control-border flex flex-col items-center justify-center p-6 relative">
            {/* Subtle grid pattern background inside the main container */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-control-bg/60 opacity-30 pointer-events-none" />

            {/* Central Diagnostic Box */}
            <div className="z-10 max-w-md text-center p-6 border border-control-border bg-control-panel/80 shadow-xl flex flex-col items-center gap-4">
              <div className="p-3 border border-control-border bg-control-bg text-control-text/40 rounded-none">
                <LayoutGrid className="h-8 w-8 text-control-cyan/40" />
              </div>
              <div>
                <h2 className="text-control-text-bright font-bold tracking-widest text-sm uppercase">
                  No Modules Configured
                </h2>
                <p className="text-xs text-control-text/60 mt-2 font-mono leading-relaxed">
                  The terminal session is established successfully. However, no diagnostic or surveillance screens have been loaded. Configure widgets or modules to begin monitoring.
                </p>
              </div>
              <div className="inline-block px-3 py-1 bg-control-amber/10 border border-control-amber/30 text-control-amber text-[10px] font-mono tracking-widest">
                SYSTEM STANDBY • WAITING OPERATOR INPUT
              </div>
            </div>
          </div>
        )}
        {activeTab === "live" && <LiveView />}
        {activeTab === "access" && <AccessControl />}
        {activeTab === "alarms" && <Alarms />}
        {activeTab === "events" && <Events />}

        {/* Bottom system logs terminal bar */}
        <div className="bg-control-panel border border-control-border p-3 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 text-control-cyan text-xs font-bold uppercase tracking-wider border-r border-control-border pr-3 shrink-0">
            <Terminal className="h-4 w-4" />
            <span>Live Node Logs</span>
          </div>
          <div className="flex-1 font-mono text-[10px] text-control-cyan/70 space-y-1 overflow-x-auto whitespace-nowrap">
            {sysLogs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
          </div>
          <div className="text-[10px] font-mono text-control-text/40 flex items-center gap-1.5 shrink-0 uppercase">
            <Cpu className="h-3.5 w-3.5" />
            <span>Operator: {user?.id ? user.id.slice(0, 8) : "00000000"}</span>
          </div>
        </div>
      </main>
    </div>
  );
};
