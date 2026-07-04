import React, { useEffect, useState, useMemo } from "react";
import { useAlarmStore, Zone, Capteur } from "../store/alarmStore";
import { useAuthStore } from "../store/authStore";
import { 
  Shield, 
  ShieldOff, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Activity, 
  Terminal, 
  Play, 
  Radio, 
  Eye, 
  BellRing,
  AlertCircle
} from "lucide-react";

export const Alarms: React.FC = () => {
  const { user } = useAuthStore();
  const {
    zones,
    sensors,
    activeAlarms,
    loading,
    error,
    sseConnected,
    notification,
    muted,
    fetchZones,
    fetchSensors,
    fetchActiveAlarms,
    armZone,
    disarmZone,
    triggerSensor,
    setNotification,
    setMuted,
    clearError
  } = useAlarmStore();

  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("all");
  const isAdmin = user?.role === "admin";

  // Initial fetch
  useEffect(() => {
    fetchZones();
    fetchSensors();
    fetchActiveAlarms();
  }, [fetchZones, fetchSensors, fetchActiveAlarms]);

  const handleRefresh = async () => {
    await Promise.all([
      fetchZones(),
      fetchSensors(),
      fetchActiveAlarms()
    ]);
  };

  const handleToggleZone = async (zone: Zone) => {
    if (!isAdmin) return;
    try {
      if (zone.statut === "arme") {
        await disarmZone(zone.id);
      } else {
        await armZone(zone.id);
      }
    } catch (e) {
      console.error("Failed to toggle zone status:", e);
    }
  };

  const handleTriggerSensor = async (sensorId: string) => {
    try {
      await triggerSensor(sensorId);
    } catch (e) {
      console.error("Failed to trigger sensor:", e);
    }
  };

  // Helper mappings
  const zoneMap = useMemo(() => {
    const map: Record<string, Zone> = {};
    zones.forEach(z => {
      map[z.id] = z;
    });
    return map;
  }, [zones]);

  const sensorMap = useMemo(() => {
    const map: Record<string, Capteur> = {};
    sensors.forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, [sensors]);

  // Enrich active alarms with names and type-based severity
  const enrichedAlarms = useMemo(() => {
    return activeAlarms.map((alarm) => {
      const zoneObj = zoneMap[alarm.zone_id];
      const sensorObj = sensorMap[alarm.capteur_id];

      const zoneName = zoneObj ? zoneObj.nom : "Zone Inconnue";
      const sensorName = sensorObj ? sensorObj.nom : "Capteur Inconnu";
      const sensorType = sensorObj ? sensorObj.type : "ouverture";

      let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (sensorType === "mouvement") severity = "HIGH";
      else if (sensorType === "ouverture") severity = "MEDIUM";

      return {
        ...alarm,
        zoneName,
        sensorName,
        sensorType,
        severity: severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
      };
    });
  }, [activeAlarms, zoneMap, sensorMap]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-control-panel/30 border border-control-border relative overflow-hidden">
      
      {/* Visual Alert Banner for Live In-session Alarms */}
      {notification && (
        <div className="bg-control-red/10 border-b-2 border-control-red p-4 animate-pulse shrink-0 flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-control-red text-control-text-bright rounded-lg">
              <BellRing className="h-6 w-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-control-red uppercase tracking-wider font-mono">
                  🚨 ALERTE INTRUSION EN COURS
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-control-red text-control-text-bright font-semibold font-mono">
                  {notification.severity}
                </span>
              </div>
              <p className="text-xs text-control-text-bright font-mono mt-0.5">
                Capteur <strong className="text-control-red">{notification.sensorName}</strong> déclenché dans <strong className="text-control-cyan">{notification.zoneName}</strong> à {notification.timestamp}.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMuted(!muted);
              }}
              className="px-3 py-1.5 border border-control-border bg-control-panel hover:bg-control-panel-light text-control-text font-mono text-xs cursor-pointer flex items-center gap-1.5"
            >
              {muted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span>{muted ? "RÉACTIVER SON" : "COUPER SON"}</span>
            </button>
            <button
              onClick={() => setNotification(null)}
              className="px-4 py-1.5 bg-control-red hover:bg-control-red/90 text-control-text-bright border border-control-red/50 font-bold font-mono text-xs cursor-pointer"
            >
              ACQUITTER VISUEL
            </button>
          </div>
        </div>
      )}

      {/* Control bar / Sub-Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-control-border bg-control-panel/40 p-3 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4.5 w-4.5 text-control-cyan" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-control-text-bright">
            Intrusion & Security Zones
          </h2>
          <span className={`text-[9px] px-1.5 py-0.5 font-mono ml-2 ${
            sseConnected 
              ? "bg-control-green/10 border border-control-green/30 text-control-green" 
              : "bg-control-red/10 border border-control-red/30 text-control-red"
          }`}>
            REAL-TIME STREAM: {sseConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setMuted(!muted)}
            className={`p-2 border transition-all cursor-pointer flex items-center gap-1.5 ${
              muted 
                ? "border-control-red/30 text-control-red bg-control-red/5" 
                : "border-control-cyan/30 text-control-cyan bg-control-cyan/5"
            }`}
            title={muted ? "Unmute Alarm Sounds" : "Mute Alarm Sounds"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span>{muted ? "AUDIO MUTED" : "AUDIO ACTIVE"}</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 border border-control-border bg-control-panel hover:bg-control-panel-light text-control-cyan hover:text-control-cyan-bright transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-control-red/10 border-b border-control-red text-control-red text-xs font-mono flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>ERROR: {error}</span>
          </div>
          <button 
            onClick={clearError}
            className="text-[10px] underline uppercase tracking-wider hover:text-control-text-bright cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 min-h-0 overflow-y-auto">
        
        {/* Left Column (Zones and Sensor Sim) */}
        <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
          
          {/* Zones Box */}
          <div className="bg-control-panel/50 border border-control-border rounded-xl p-4 flex flex-col shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b border-control-border/60 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-control-cyan font-mono flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Zones de Surveillance ({zones.length})
              </h3>
              <span className="text-[10px] text-control-text/50 font-mono">
                ARM CONTROLS
              </span>
            </div>

            {zones.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-control-text/40">
                No surveillance zones registered on host.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {zones.map((zone) => {
                  const isArmed = zone.statut === "arme";
                  const zoneAlarms = enrichedAlarms.filter(a => a.zone_id === zone.id);
                  const hasActiveAlarm = zoneAlarms.length > 0;

                  return (
                    <div 
                      key={zone.id} 
                      className={`border p-4 flex flex-col justify-between transition-all ${
                        hasActiveAlarm 
                          ? "border-control-red bg-control-red/5 animate-glow"
                          : isArmed 
                            ? "border-control-amber/50 bg-control-amber/5"
                            : "border-control-border bg-control-panel-light/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-control-text-bright uppercase font-mono tracking-wider">
                            {zone.nom}
                          </h4>
                          {hasActiveAlarm ? (
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-control-red opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-control-red"></span>
                            </span>
                          ) : (
                            <span className={`h-2 w-2 rounded-full ${isArmed ? "bg-control-amber animate-pulse" : "bg-control-green"}`} />
                          )}
                        </div>
                        <p className="text-[10px] text-control-text/60 mt-1 font-mono leading-relaxed">
                          {zone.description || "Aucune description fournie pour cette zone."}
                        </p>

                        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono">
                          {isArmed ? (
                            <span className="text-control-amber flex items-center gap-1">
                              <Shield className="h-3.5 w-3.5" />
                              ARME (INTRUSION ACTIVED)
                            </span>
                          ) : (
                            <span className="text-control-green flex items-center gap-1">
                              <ShieldOff className="h-3.5 w-3.5" />
                              DESARME (BYPASSED)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action toggle button */}
                      <div className="mt-4 pt-3 border-t border-control-border/40">
                        <button
                          onClick={() => handleToggleZone(zone)}
                          disabled={!isAdmin}
                          className={`w-full py-1.5 border font-bold font-mono text-[10px] tracking-widest transition-all cursor-pointer rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
                            isArmed 
                              ? "border-control-green/60 bg-control-green/5 hover:bg-control-green/10 text-control-green"
                              : "border-control-red/60 bg-control-red/5 hover:bg-control-red/10 text-control-red"
                          }`}
                        >
                          {isArmed ? "DISARM ZONE (DESARMER)" : "ARM ZONE (ARMER)"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sensors & Testing Board */}
          <div className="bg-control-panel/50 border border-control-border rounded-xl p-4 flex-1 flex flex-col min-h-[300px] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-control-border/60 pb-2 gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-control-cyan font-mono flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                Banc d'Essai - Capteurs & Simulateur d'Intrusion
              </h3>
              
              {/* Filter */}
              <div className="flex gap-2">
                <select
                  value={selectedZoneFilter}
                  onChange={(e) => setSelectedZoneFilter(e.target.value)}
                  className="bg-control-bg border border-control-border text-control-text text-[10px] font-mono px-2 py-1 outline-none"
                >
                  <option value="all">Toutes les Zones</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            {sensors.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-control-text/40 flex-1 flex items-center justify-center">
                Aucun capteur d'intrusion configuré sur le serveur.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[350px] pr-1">
                {sensors
                  .filter(s => selectedZoneFilter === "all" || s.zone_id === selectedZoneFilter)
                  .map((sensor) => {
                    const zoneObj = zoneMap[sensor.zone_id];
                    const isZoneArmed = zoneObj?.statut === "arme";
                    const isDeclenched = sensor.statut === "declenche";

                    return (
                      <div 
                        key={sensor.id}
                        className="bg-control-panel-light/35 border border-control-border p-2.5 flex items-center justify-between font-mono text-xs gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 border ${
                            isDeclenched
                              ? "border-control-red bg-control-red/10 text-control-red animate-pulse"
                              : "border-control-border text-control-text/50"
                          }`}>
                            {sensor.type === "mouvement" ? (
                              <Radio className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-control-text-bright">
                                {sensor.nom}
                              </span>
                              <span className="text-[8px] px-1 bg-control-border text-control-text/70 uppercase">
                                {sensor.type}
                              </span>
                            </div>
                            <div className="text-[9px] text-control-text/50 mt-0.5">
                              Zone: {zoneObj ? zoneObj.nom : `ID ${sensor.zone_id.substring(0,8)}`}
                            </div>
                          </div>
                        </div>

                        {/* Status + Trigger Button */}
                        <div className="flex items-center gap-4">
                          <span className={`text-[10px] font-bold ${
                            isDeclenched ? "text-control-red" : "text-control-green"
                          }`}>
                            {isDeclenched ? "● DECLENCHE" : "○ OK"}
                          </span>
                          <button
                            onClick={() => handleTriggerSensor(sensor.id)}
                            className={`px-3 py-1.5 border flex items-center gap-1 text-[9px] font-bold tracking-wider cursor-pointer rounded-lg transition-all ${
                              isZoneArmed
                                ? "border-control-red/60 bg-control-red/5 hover:bg-control-red/10 text-control-red"
                                : "border-control-border bg-control-panel hover:bg-control-panel-light text-control-text"
                            }`}
                            title={isZoneArmed ? "Triggering will raise a live Alarm!" : "Triggering is logged but raises no Alarm because Zone is disarmed."}
                          >
                            <Play className="h-3 w-3" />
                            <span>SIMULER</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Active Alarms) */}
        <div className="lg:col-span-4 flex flex-col min-h-0 bg-control-panel/50 border border-control-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-control-border/60 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-control-red font-mono flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Intrusions Actives ({activeAlarms.length})
            </h3>
            {activeAlarms.length > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-control-red animate-ping" />
            )}
          </div>

          {enrichedAlarms.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 font-mono border border-dashed border-control-border bg-control-panel-light/10">
              <Shield className="h-8 w-8 text-control-green/40 mb-2" />
              <p className="text-xs text-control-green font-semibold uppercase tracking-wider">
                Systeme Sécurisé
              </p>
              <p className="text-[10px] text-control-text/40 mt-1 leading-relaxed max-w-[200px]">
                Aucune alarme ou déclenchement d'intrusion actif dans l'établissement.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {enrichedAlarms.map((alarm) => {
                let severityColor = "border-control-cyan text-control-cyan bg-control-cyan/5";
                if (alarm.severity === "HIGH") {
                  severityColor = "border-control-amber text-control-amber bg-control-amber/5";
                } else if (alarm.severity === "CRITICAL") {
                  severityColor = "border-control-red text-control-red bg-control-red/10 animate-pulse";
                }

                return (
                  <div 
                    key={alarm.id}
                    className="border border-control-red/50 bg-control-red/5 p-3 flex flex-col gap-2 font-mono"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[8px] text-control-text/50 font-semibold block">
                          ALARM ID: {alarm.id.substring(0, 8)}...
                        </span>
                        <h4 className="text-xs font-bold text-control-text-bright mt-0.5">
                          {alarm.zoneName}
                        </h4>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 border font-semibold ${severityColor}`}>
                        {alarm.severity}
                      </span>
                    </div>

                    <div className="text-[10px] text-control-text/80 space-y-1">
                      <p>
                        Capteur: <strong className="text-control-cyan">{alarm.sensorName}</strong>
                      </p>
                      <p className="text-[9px] text-control-text/50">
                        Type: <span className="uppercase">{alarm.sensorType}</span>
                      </p>
                      <p className="text-[9px] text-control-text/50">
                        Déclenché à: {new Date(alarm.declenchee_a).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="mt-1 flex items-center justify-between border-t border-control-border/40 pt-2 text-[9px] text-control-red/70 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-control-red animate-pulse" />
                        <span>STATUT ALARME: EN COURS</span>
                      </div>
                    </div>
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
