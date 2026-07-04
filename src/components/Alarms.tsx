import React, { useEffect, useState, useMemo, useRef } from "react";
import { useAlarmStore, Zone, Capteur } from "../store/alarmStore";
import { useAuthStore } from "../store/authStore";
import { useCameraStore } from "../store/cameraStore";
import { useEventStore } from "../store/eventStore";
import { CameraPlayer } from "./LiveView";
import { 
  Shield, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Activity, 
  Terminal, 
  Radio, 
  Eye, 
  BellRing,
  AlertCircle,
  Clock,
  ArrowRight,
  Check,
  Sliders
} from "lucide-react";

export const Alarms: React.FC = () => {
  const { user } = useAuthStore();
  const {
    zones,
    sensors,
    activeAlarms,
    loading,
    sseConnected,
    notification,
    muted,
    requireAckReason,
    escalationDelay,
    snoozedAlarms,
    setRequireAckReason,
    setEscalationDelay,
    fetchZones,
    fetchSensors,
    fetchActiveAlarms,
    triggerSensor,
    setNotification,
    setMuted,
    acknowledgeAlarm,
    transferAlarm,
    snoozeAlarm
  } = useAlarmStore();

  const { cameras, fetchCameras } = useCameraStore();
  const { events, fetchEvents } = useEventStore();

  // Redesign States
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);
  const [ackReasonText, setAckReasonText] = useState("");
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [snoozeMinutes, setSnoozeMinutes] = useState(5);
  const [snoozeReason, setSnoozeReason] = useState("");
  const [actionTab, setActionTab] = useState<"ack" | "transfer" | "snooze">("ack");

  // Timeline filters
  const [filterType, setFilterType] = useState<"all" | "alarm" | "access" | "video">("all");
  const [filterSite, setFilterSite] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<"all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("all");
  const [autoscroll, setAutoscroll] = useState(true);

  // Simulated system elapsed clock trigger for escalation visual updates
  const [tick, setTick] = useState(0);

  const timelineEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin";

  // Initial loads
  useEffect(() => {
    fetchZones();
    fetchSensors();
    fetchActiveAlarms();
    fetchCameras();
    fetchEvents();
  }, [fetchZones, fetchSensors, fetchActiveAlarms, fetchCameras, fetchEvents]);

  // Clock tick to refresh escalation countdowns every second
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Autoscroll logic
  useEffect(() => {
    if (autoscroll && timelineEndRef.current) {
      timelineEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoscroll]);

  // Action actions
  const handleAcknowledge = async (alarmId: string) => {
    if (requireAckReason && !ackReasonText.trim()) {
      alert("Le motif d'acquittement est obligatoire.");
      return;
    }
    try {
      await acknowledgeAlarm(alarmId, ackReasonText.trim() || "Acquittement standard");
      setAckReasonText("");
      setSelectedAlarmId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransfer = async (alarmId: string) => {
    if (!transferRecipient.trim()) {
      alert("Le destinataire est requis pour le transfert.");
      return;
    }
    try {
      await transferAlarm(alarmId, transferRecipient.trim(), transferReason.trim() || "Transféré pour investigation");
      setTransferRecipient("");
      setTransferReason("");
      setSelectedAlarmId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSnooze = async (alarmId: string) => {
    try {
      await snoozeAlarm(alarmId, snoozeMinutes, snoozeReason.trim() || `Reporté de ${snoozeMinutes} mins`);
      setSnoozeReason("");
      setSelectedAlarmId(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper mappings
  const zoneMap = useMemo(() => {
    const map: Record<string, Zone> = {};
    zones.forEach(z => { map[z.id] = z; });
    return map;
  }, [zones]);

  const sensorMap = useMemo(() => {
    const map: Record<string, Capteur> = {};
    sensors.forEach(s => { map[s.id] = s; });
    return map;
  }, [sensors]);

  // Enrich and sort alarms by priority
  const enrichedAlarms = useMemo(() => {
    const now = Date.now();
    return activeAlarms
      .map((alarm) => {
        const zoneObj = zoneMap[alarm.zone_id];
        const sensorObj = sensorMap[alarm.capteur_id];

        const zoneName = zoneObj ? zoneObj.nom : "Zone Inconnue";
        const sensorName = sensorObj ? sensorObj.nom : "Capteur Inconnu";
        const sensorType = sensorObj ? sensorObj.type : "ouverture";

        // Assign severity & priority scores
        let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
        let priorityScore = 1;
        if (sensorType === "mouvement") {
          severity = "HIGH";
          priorityScore = 3;
        } else if (sensorType === "ouverture") {
          severity = "MEDIUM";
          priorityScore = 2;
        }

        // Escalation check
        const triggerTime = new Date(alarm.declenchee_a).getTime();
        const elapsedSec = Math.max(0, Math.floor((now - triggerTime) / 1000));
        const isEscalated = elapsedSec > escalationDelay;

        // Find associated camera
        const camera = cameras.find(c => c.zone_id === alarm.zone_id);

        return {
          ...alarm,
          zoneName,
          sensorName,
          sensorType,
          severity,
          priorityScore: isEscalated ? priorityScore + 10 : priorityScore,
          isEscalated,
          elapsedSec,
          camera
        };
      })
      // Filter out client-side active snoozed alarms
      .filter((alarm) => {
        const snoozeUntil = snoozedAlarms[alarm.id];
        return !snoozeUntil || now > snoozeUntil;
      })
      // Sort: Highest priority score first
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [activeAlarms, zoneMap, sensorMap, escalationDelay, cameras, snoozedAlarms, tick]);

  // Filtered timeline events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // 1. Filter Type
      if (filterType === "alarm" && !e.event_type.startsWith("alarm.")) return false;
      if (filterType === "access" && !e.event_type.startsWith("access.")) return false;
      if (filterType === "video" && !e.event_type.startsWith("video.")) return false;

      // 2. Filter Site
      if (filterSite !== "all" && e.site_id !== filterSite) return false;

      // 3. Filter Severity
      if (filterSeverity !== "all") {
        let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
        if (e.event_type === "alarm.triggered") {
          const sensorObj = sensorMap[e.details?.payload?.capteur_id || e.details?.capteur_id || ""];
          if (sensorObj?.type === "mouvement") severity = "HIGH";
          else if (sensorObj?.type === "ouverture") severity = "MEDIUM";
        } else if (e.event_type.startsWith("access.denied")) {
          severity = "HIGH";
        }
        if (severity !== filterSeverity) return false;
      }
      return true;
    });
  }, [events, filterType, filterSite, filterSeverity, sensorMap]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-control-bg text-control-text font-mono relative">
      
      {/* Top Banner for Critical Live Notifications */}
      {notification && (
        <div className="bg-control-red/15 border-b border-control-red p-3 shrink-0 flex items-center justify-between z-50 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-control-red text-control-text-bright rounded-lg">
              <BellRing className="h-5 w-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-control-red uppercase tracking-widest font-mono">
                  🚨 LIVE ALARME INTRUSION
                </span>
                <span className="text-[9px] px-1 bg-control-red text-control-text-bright font-bold">
                  {notification.severity}
                </span>
              </div>
              <p className="text-xs text-control-text-bright mt-0.5">
                Capteur <strong className="text-control-red">{notification.sensorName}</strong> déclenché dans <strong className="text-control-cyan">{notification.zoneName}</strong> à {notification.timestamp}.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMuted(!muted)}
              className="px-2.5 py-1 border border-control-border bg-control-panel hover:bg-control-panel-light text-control-text cursor-pointer flex items-center gap-1.5 text-xs"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span>{muted ? "ACTIVER SON" : "COUPER SON"}</span>
            </button>
            <button
              onClick={() => setNotification(null)}
              className="px-3 py-1 bg-control-red hover:bg-control-red/90 text-control-text-bright border border-control-red/50 font-bold text-xs cursor-pointer"
            >
              ACQUITTER NOTIF
            </button>
          </div>
        </div>
      )}

      {/* Main Subbar Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-control-border bg-control-panel/40 p-3 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4.5 w-4.5 text-control-red" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-control-text-bright">
            Console de Contrôle des Alarmes & Evénements
          </h2>
          <span className={`text-[9px] px-1.5 py-0.5 font-mono ml-2 ${
            sseConnected 
              ? "bg-control-green/10 border border-control-green/30 text-control-green" 
              : "bg-control-red/10 border border-control-red/30 text-control-red"
          }`}>
            REAL-TIME WEBSOCKET: {sseConnected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setMuted(!muted)}
            className={`p-2 border transition-all cursor-pointer flex items-center gap-1.5 ${
              muted 
                ? "border-control-red/30 text-control-red bg-control-red/5" 
                : "border-control-cyan/30 text-control-cyan bg-control-cyan/5"
            }`}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span>{muted ? "MUET" : "AUDIO EN SERVICE"}</span>
          </button>

          <button
            onClick={async () => {
              await Promise.all([fetchZones(), fetchSensors(), fetchActiveAlarms(), fetchEvents()]);
            }}
            disabled={loading}
            className="p-2 border border-control-border bg-control-panel hover:bg-control-panel-light text-control-cyan hover:text-control-cyan-bright transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 min-h-0 overflow-y-auto">
        
        {/* Left/Middle Column (Active Alarms File) */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
          
          {/* Active Alarms Section */}
          <div className="bg-control-panel/50 border border-control-border rounded-xl p-4 flex flex-col shadow-xs min-h-[300px]">
            <div className="flex items-center justify-between mb-4 border-b border-control-border/60 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-control-red flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                File des Alarmes Actives ({enrichedAlarms.length})
              </h3>
              <span className="text-[10px] text-control-text/40">
                TRIEE PAR SEVERITE & ESCALADE
              </span>
            </div>

            {enrichedAlarms.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-control-border bg-control-panel-light/10 rounded-xl">
                <Shield className="h-10 w-10 text-control-green/40 mb-2" />
                <p className="text-xs text-control-green font-semibold uppercase tracking-wider">
                  Aucun incident actif
                </p>
                <p className="text-[10px] text-control-text/40 mt-1 max-w-[240px]">
                  Toutes les alarmes d'intrusion et de contrôle d'accès de l'établissement sont résolues ou acquittées.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[500px]">
                {enrichedAlarms.map((alarm) => {
                  const isSelected = selectedAlarmId === alarm.id;
                  
                  // Visual themes based on severity and escalation status
                  let statusBorder = "border-control-amber/50 bg-control-amber/5";
                  let severityBadge = "bg-control-amber/10 border-control-amber text-control-amber";
                  
                  if (alarm.severity === "HIGH") {
                    statusBorder = "border-control-red/50 bg-control-red/5";
                    severityBadge = "bg-control-red/10 border-control-red text-control-red";
                  }
                  
                  if (alarm.isEscalated) {
                    statusBorder = "border-control-red bg-control-red/10 animate-glow";
                    severityBadge = "bg-control-red text-control-text-bright font-black";
                  }

                  return (
                    <div 
                      key={alarm.id}
                      onClick={() => setSelectedAlarmId(alarm.id)}
                      className={`border p-4 flex flex-col gap-3 transition-all cursor-pointer rounded-lg hover:border-control-cyan/60 ${statusBorder} ${
                        isSelected ? "ring-1 ring-control-cyan border-control-cyan" : ""
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] px-1.5 py-0.5 bg-control-border text-control-text/60 font-semibold rounded font-mono">
                              ID: {alarm.id.substring(0, 8)}
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.5 border font-semibold tracking-wider uppercase ${severityBadge}`}>
                              {alarm.severity}
                            </span>
                            {alarm.isEscalated && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-control-red text-control-text-bright font-bold animate-pulse">
                                ESCALADEE ({alarm.elapsedSec}s)
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-control-text-bright mt-1.5 uppercase">
                            {alarm.zoneName}
                          </h4>
                          <p className="text-[10px] text-control-text/60 mt-0.5">
                            Déclencheur : <strong className="text-control-cyan">{alarm.sensorName}</strong> ({alarm.sensorType})
                          </p>
                        </div>
                        <div className="text-right text-[10px] text-control-text/50 self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:items-end">
                          <span>Déclenché : {new Date(alarm.declenchee_a).toLocaleTimeString()}</span>
                          <span className="mt-1 text-[9px] text-control-red font-semibold">
                            En attente depuis {alarm.elapsedSec}s
                          </span>
                        </div>
                      </div>

                      {/* Live Camera Thumbnail overlay */}
                      {alarm.camera && (
                        <div className="w-full h-40 bg-control-bg border border-control-border relative overflow-hidden mt-1 flex items-center justify-center rounded">
                          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/60 text-[9px] border border-control-border text-control-green flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-control-green animate-pulse" />
                            <span>LIVE PREVIEW: {alarm.camera.nom}</span>
                          </div>
                          <CameraPlayer 
                            cameraId={alarm.camera.id}
                            cameraNom={alarm.camera.nom}
                            statut="active"
                            aspectRatioMode="cover"
                            onClear={() => {}}
                          />
                        </div>
                      )}

                      {/* Display warning if escalated */}
                      {alarm.isEscalated && (
                        <div className="p-2 border border-control-red/40 bg-control-red/5 text-[9px] text-control-red flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 animate-bounce shrink-0" />
                          <span>ALERTE RETARD D'ACQUITTEMENT : Le délai de {escalationDelay}s est dépassé. Escalade active vers le Superviseur.</span>
                        </div>
                      )}

                      {/* Panel details and Actions */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-control-border/60 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
                          
                          {/* Tabs for Action Type */}
                          <div className="flex border-b border-control-border/60 text-[10px] uppercase font-bold">
                            <button
                              onClick={() => setActionTab("ack")}
                              className={`px-3 py-1.5 border-t border-x border-transparent cursor-pointer ${
                                actionTab === "ack" ? "border-control-border bg-control-panel-light/30 text-control-cyan" : "text-control-text/60"
                              }`}
                            >
                              Acquitter
                            </button>
                            <button
                              onClick={() => setActionTab("transfer")}
                              className={`px-3 py-1.5 border-t border-x border-transparent cursor-pointer ${
                                actionTab === "transfer" ? "border-control-border bg-control-panel-light/30 text-control-cyan" : "text-control-text/60"
                              }`}
                            >
                              Transférer
                            </button>
                            <button
                              onClick={() => setActionTab("snooze")}
                              className={`px-3 py-1.5 border-t border-x border-transparent cursor-pointer ${
                                actionTab === "snooze" ? "border-control-border bg-control-panel-light/30 text-control-cyan" : "text-control-text/60"
                              }`}
                            >
                              Reporter
                            </button>
                          </div>

                          {/* Tab Content */}
                          {actionTab === "ack" && (
                            <div className="space-y-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] uppercase tracking-wider text-control-text/70">
                                  Motif de l'acquittement {requireAckReason && <span className="text-control-red">*</span>}
                                </label>
                                <input
                                  type="text"
                                  placeholder={requireAckReason ? "Saisir le motif obligatoire..." : "Commentaire optionnel..."}
                                  value={ackReasonText}
                                  onChange={e => setAckReasonText(e.target.value)}
                                  className="w-full bg-control-bg border border-control-border rounded px-2.5 py-1.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan"
                                />
                              </div>
                              <button
                                onClick={() => handleAcknowledge(alarm.id)}
                                className="w-full py-1.5 bg-control-green hover:bg-control-green/90 text-white font-bold text-xs uppercase tracking-wider cursor-pointer rounded flex items-center justify-center gap-1"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Confirmer l'acquittement</span>
                              </button>
                            </div>
                          )}

                          {actionTab === "transfer" && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] uppercase tracking-wider text-control-text/70">Destinataire (Agent/Groupe) *</label>
                                  <input
                                    type="text"
                                    placeholder="ex: Patrouille 2, Superviseur..."
                                    value={transferRecipient}
                                    onChange={e => setTransferRecipient(e.target.value)}
                                    className="bg-control-bg border border-control-border rounded px-2.5 py-1.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9px] uppercase tracking-wider text-control-text/70">Raison du transfert</label>
                                  <input
                                    type="text"
                                    placeholder="Raison du transfert..."
                                    value={transferReason}
                                    onChange={e => setTransferReason(e.target.value)}
                                    className="bg-control-bg border border-control-border rounded px-2.5 py-1.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => handleTransfer(alarm.id)}
                                className="w-full py-1.5 bg-control-cyan hover:bg-control-cyan/90 text-white font-bold text-xs uppercase tracking-wider cursor-pointer rounded flex items-center justify-center gap-1"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                                <span>Transférer l'alarme</span>
                              </button>
                            </div>
                          )}

                          {actionTab === "snooze" && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col gap-1 col-span-1">
                                  <label className="text-[9px] uppercase tracking-wider text-control-text/70">Durée (minutes)</label>
                                  <select
                                    value={snoozeMinutes}
                                    onChange={e => setSnoozeMinutes(Number(e.target.value))}
                                    className="bg-control-bg border border-control-border rounded px-2 py-1.5 text-xs text-control-text-bright outline-none"
                                  >
                                    <option value={1}>1 minute</option>
                                    <option value={5}>5 minutes</option>
                                    <option value={15}>15 minutes</option>
                                    <option value={30}>30 minutes</option>
                                  </select>
                                </div>
                                <div className="flex flex-col gap-1 col-span-2">
                                  <label className="text-[9px] uppercase tracking-wider text-control-text/70">Justification du report</label>
                                  <input
                                    type="text"
                                    placeholder="ex: Vérification sur place en cours..."
                                    value={snoozeReason}
                                    onChange={e => setSnoozeReason(e.target.value)}
                                    className="bg-control-bg border border-control-border rounded px-2.5 py-1.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => handleSnooze(alarm.id)}
                                className="w-full py-1.5 bg-control-amber hover:bg-control-amber/90 text-white font-bold text-xs uppercase tracking-wider cursor-pointer rounded flex items-center justify-center gap-1"
                              >
                                <Clock className="h-3.5 w-3.5" />
                                <span>Reporter l'alarme (Mettre en sommeil)</span>
                              </button>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Setup simulator control board */}
          <div className="bg-control-panel/50 border border-control-border rounded-xl p-4 flex-1 flex flex-col shadow-xs min-h-[220px]">
            <div className="flex items-center justify-between mb-4 border-b border-control-border/60 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-control-cyan flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                Simulateur d'Intrusion & Banc d'Essai
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[200px] pr-1">
              {sensors.map((sensor) => {
                const zoneObj = zoneMap[sensor.zone_id];
                const isArmed = zoneObj?.statut === "arme";
                const isTriggered = sensor.statut === "declenche";

                return (
                  <div key={sensor.id} className="bg-control-panel-light/20 border border-control-border p-2.5 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 border ${
                        isTriggered ? "border-control-red bg-control-red/10 text-control-red animate-pulse" : "border-control-border text-control-text/40"
                      }`}>
                        {sensor.type === "mouvement" ? <Radio className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-control-text-bright">{sensor.nom}</span>
                          <span className="text-[7px] px-1 bg-control-border text-control-text/60 uppercase">{sensor.type}</span>
                        </div>
                        <span className="text-[9px] text-control-text/40">Zone : {zoneObj?.nom || "Inconnue"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-bold ${isTriggered ? "text-control-red" : "text-control-green"}`}>
                        {isTriggered ? "● DECLENCHÉ" : "○ OK"}
                      </span>
                      <button
                        onClick={async () => {
                          try {
                            await triggerSensor(sensor.id);
                          } catch (err) {}
                        }}
                        className={`px-2 py-1 border text-[9px] font-bold tracking-wider cursor-pointer rounded transition-all ${
                          isArmed 
                            ? "border-control-red/60 bg-control-red/5 hover:bg-control-red/10 text-control-red" 
                            : "border-control-border bg-control-panel hover:bg-control-panel-light text-control-text"
                        }`}
                      >
                        SIMULER
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (Live chronological event log timeline) */}
        <div className="lg:col-span-5 flex flex-col gap-4 min-h-0 bg-control-panel/50 border border-control-border rounded-xl p-4 shadow-xs">
          
          {/* Header & filters */}
          <div className="border-b border-control-border/60 pb-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-control-cyan flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                Journal des événements en direct
              </h3>
              <span className="h-2 w-2 rounded-full bg-control-cyan animate-pulse" />
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-3 gap-1.5 text-[9px]">
              <div>
                <label className="text-[8px] text-control-text/50 uppercase block mb-1">Type d'event</label>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="w-full bg-control-bg border border-control-border text-control-text px-1 py-1 outline-none"
                >
                  <option value="all">Tout</option>
                  <option value="alarm">Alarmes</option>
                  <option value="access">Contrôle d'accès</option>
                  <option value="video">Vidéo/Motion</option>
                </select>
              </div>

              <div>
                <label className="text-[8px] text-control-text/50 uppercase block mb-1">Sévérité</label>
                <select
                  value={filterSeverity}
                  onChange={e => setFilterSeverity(e.target.value as any)}
                  className="w-full bg-control-bg border border-control-border text-control-text px-1 py-1 outline-none"
                >
                  <option value="all">Toutes</option>
                  <option value="CRITICAL">Critique</option>
                  <option value="HIGH">Haute</option>
                  <option value="MEDIUM">Moyenne</option>
                  <option value="LOW">Basse</option>
                </select>
              </div>

              <div>
                <label className="text-[8px] text-control-text/50 uppercase block mb-1">Site</label>
                <select
                  value={filterSite}
                  onChange={e => setFilterSite(e.target.value)}
                  className="w-full bg-control-bg border border-control-border text-control-text px-1 py-1 outline-none"
                >
                  <option value="all">Tous</option>
                  <option value="a0000000-0000-0000-0000-000000000001">HQ Paris</option>
                </select>
              </div>
            </div>

            {/* AutoScroll control */}
            <div className="flex items-center justify-between text-[9px] text-control-text/60">
              <label className="flex items-center gap-1 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoscroll} 
                  onChange={e => setAutoscroll(e.target.checked)} 
                  className="rounded border-control-border bg-control-bg text-control-cyan accent-control-cyan focus:outline-none" 
                />
                <span>Défilement automatique (Auto-scroll)</span>
              </label>
              <span>Affichés : {filteredEvents.length}</span>
            </div>
          </div>

          {/* Timeline Feed Container */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[300px]">
            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-control-text/40">
                Aucun événement ne correspond aux filtres.
              </div>
            ) : (
              filteredEvents.map((evt) => {
                let badgeColor = "bg-control-cyan/15 border-control-cyan/30 text-control-cyan";
                if (evt.event_type.startsWith("alarm.")) {
                  badgeColor = "bg-control-red/15 border-control-red/30 text-control-red";
                } else if (evt.event_type.startsWith("access.denied")) {
                  badgeColor = "bg-control-amber/15 border-control-amber/30 text-control-amber";
                } else if (evt.event_type.startsWith("access.granted")) {
                  badgeColor = "bg-control-green/15 border-control-green/30 text-control-green";
                }

                return (
                  <div 
                    key={evt.id} 
                    className="p-2 border border-control-border bg-control-panel-light/10 text-[10px] leading-relaxed flex flex-col gap-1 font-mono rounded"
                  >
                    <div className="flex justify-between items-center text-[8px] text-control-text/40">
                      <span>{new Date(evt.timestamp).toLocaleString()}</span>
                      <span className={`px-1 border font-bold uppercase ${badgeColor}`}>
                        {evt.event_type}
                      </span>
                    </div>
                    <p className="text-control-text-bright mt-0.5">{evt.message}</p>
                  </div>
                );
              })
            )}
            <div ref={timelineEndRef} />
          </div>

          {/* Settings panel (Admins only) */}
          <div className="border-t border-control-border/60 pt-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-control-cyan flex items-center gap-1 mb-2">
              <Sliders className="h-3.5 w-3.5" />
              Configuration d'Administration (Escalade & Motif)
            </h4>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <div className="flex flex-col gap-1 justify-center">
                <label className="flex items-center gap-1.5 cursor-pointer text-control-text/80">
                  <input
                    type="checkbox"
                    checked={requireAckReason}
                    disabled={!isAdmin}
                    onChange={e => setRequireAckReason(e.target.checked)}
                    className="rounded border-control-border bg-control-bg text-control-cyan accent-control-cyan focus:outline-none"
                  />
                  <span>Motif d'acquittement obligatoire</span>
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-control-text/60">Délai d'escalade (secondes)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={600}
                    value={escalationDelay}
                    disabled={!isAdmin}
                    onChange={e => setEscalationDelay(Number(e.target.value))}
                    className="w-16 bg-control-bg border border-control-border rounded px-2 py-1 outline-none text-control-text-bright text-center"
                  />
                  <span>sec</span>
                </div>
              </div>
            </div>
            {!isAdmin && (
              <p className="text-[8px] text-control-red mt-1.5 uppercase font-semibold">
                ⚠️ Modification restreinte aux Administrateurs uniquement.
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
