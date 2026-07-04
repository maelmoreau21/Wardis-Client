import React, { useEffect, useState, useRef } from "react";
import { useCameraStore, Camera } from "../store/cameraStore";
import { useAccessControlStore, Door } from "../store/accessControlStore";
import { useAlarmStore } from "../store/alarmStore";
import { useAuthStore } from "../store/authStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { 
  Video, 
  DoorClosed, 
  DoorOpen, 
  Radio, 
  Eye, 
  Edit3, 
  Check, 
  Upload, 
  Play, 
  Unlock, 
  Lock, 
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  X
} from "lucide-react";

interface Position {
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
}

// ==========================================
// 1. Mini Stream Player for Map Tooltips
// ==========================================
interface MiniPlayerProps {
  cameraId: string;
  statut: string;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ cameraId, statut }) => {
  const [status, setStatus] = useState<"connecting" | "playing" | "error" | "no-signal">("connecting");
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const generateStreamToken = useCameraStore((state) => state.generateStreamToken);

  useEffect(() => {
    if (statut !== "active") {
      setStatus("no-signal");
      return;
    }

    let active = true;
    let pc: RTCPeerConnection | null = null;
    let timeoutId: number | null = null;

    const start = async () => {
      try {
        setStatus("connecting");
        const token = await generateStreamToken(cameraId);
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
            setStatus("no-signal");
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const whepUrl = `http://localhost:8889/${cameraId}/whep?token=${token}`;
        const response = await window.fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        });

        if (!response.ok) throw new Error("WHEP handshake failed");

        const answer = await response.text();
        if (!active) return;

        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answer }));

        timeoutId = window.setTimeout(() => {
          if (active && status !== "playing") {
            setStatus("no-signal");
          }
        }, 6000);
      } catch (e) {
        console.error("MiniPlayer WebRTC setup error", e);
        if (active) setStatus("error");
      }
    };

    start();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (pc) {
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraId, statut]);

  return (
    <div className="w-[180px] h-[110px] bg-black border border-control-border relative flex items-center justify-center overflow-hidden">
      {status === "playing" ? (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      ) : status === "connecting" ? (
        <div className="flex flex-col items-center gap-1">
          <div className="h-4 w-4 border border-control-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-[7px] text-control-cyan tracking-widest animate-pulse">CONNECTING...</span>
        </div>
      ) : (
        <div className="text-[7px] text-control-red font-bold uppercase flex flex-col items-center gap-1">
          <ShieldAlert className="h-4 w-4" />
          <span>FEED OFFLINE</span>
        </div>
      )}
      <div className="absolute top-1 right-1 bg-black/70 px-1 py-0.5 border border-control-cyan/30 text-[7px] text-control-cyan">
        CAM PREVIEW
      </div>
    </div>
  );
};

// ==========================================
// 2. Main Interactive Map Component
// ==========================================
export const InteractiveMap: React.FC = () => {
  // Store Subscriptions
  const { cameras, fetchCameras } = useCameraStore();
  const { doors, fetchDoors, openDoor, closeDoor } = useAccessControlStore();
  const { zones, sensors, activeAlarms, fetchZones, fetchSensors, fetchActiveAlarms, triggerSensor } = useAlarmStore();

  const [isEditMode, setIsEditMode] = useState(false);
  const [customSvgContent, setCustomSvgContent] = useState<string | null>(null);
  const [equipmentPositions, setEquipmentPositions] = useState<Record<string, Position>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ id: string; type: "camera" | "door" | "sensor" } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync stores and positions on mount
  useEffect(() => {
    fetchCameras();
    fetchDoors();
    fetchZones();
    fetchSensors();
    fetchActiveAlarms();

    const saved = localStorage.getItem("wardis_map_coordinates");
    if (saved) {
      try {
        setEquipmentPositions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse map coordinates", e);
      }
    }
  }, [fetchCameras, fetchDoors, fetchZones, fetchSensors, fetchActiveAlarms]);

  // Handle Dynamic File Upload
  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text.includes("<svg") || text.includes("<SVG")) {
        setCustomSvgContent(text);
      } else {
        alert("Incompatible file format. Please upload a standard vector .svg floor plan.");
      }
    };
    reader.readAsText(file);
  };

  // Default coordinate offsets for unpositioned nodes to distribute them evenly
  const getCoordinates = (id: string, index: number, type: "camera" | "door" | "sensor"): Position => {
    if (equipmentPositions[id]) return equipmentPositions[id];

    const cameraDefaults = [
      { x: 12, y: 24 }, // Server Room
      { x: 42, y: 16 }, // Operator HQ
      { x: 80, y: 22 }, // Entrance Lobby
      { x: 62, y: 78 }, // Loading Dock
    ];
    const doorDefaults = [
      { x: 34, y: 28 }, // Server room entry
      { x: 64, y: 28 }, // HQ main entry
      { x: 74, y: 56 }, // Lobby egress
    ];
    const sensorDefaults = [
      { x: 22, y: 18 }, // Server Room Motion
      { x: 48, y: 26 }, // HQ Motion
      { x: 86, y: 14 }, // Lobby IR
      { x: 68, y: 64 }, // Dock IR
    ];

    if (type === "camera") return cameraDefaults[index % cameraDefaults.length];
    if (type === "door") return doorDefaults[index % doorDefaults.length];
    return sensorDefaults[index % sensorDefaults.length];
  };

  // Drag and Drop Logic
  const handleMouseDown = (id: string) => (e: React.MouseEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveDragId(id);
    setSelectedItem(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isEditMode || !activeDragId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    // Constrain percentages
    x = Math.max(0.5, Math.min(99.5, x));
    y = Math.max(0.5, Math.min(99.5, y));

    setEquipmentPositions((prev) => {
      const updated = { ...prev, [activeDragId]: { x, y } };
      localStorage.setItem("wardis_map_coordinates", JSON.stringify(updated));
      return updated;
    });
  };

  const handleMouseUp = () => {
    setActiveDragId(null);
  };

  useEffect(() => {
    if (activeDragId) {
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeDragId]);

  // Reset positioning coordinates back to defaults
  const handleResetPositions = () => {
    if (window.confirm("Voulez-vous réinitialiser l'emplacement de tous les équipements ?")) {
      setEquipmentPositions({});
      localStorage.removeItem("wardis_map_coordinates");
    }
  };

  // Secondary Window Launcher for Map Cameras
  const handleDetachStream = (camera: Camera) => {
    const token = useAuthStore.getState().token;
    const label = `detached-cam-${camera.id}`;

    WebviewWindow.getByLabel(label).then(async (existing) => {
      if (existing) {
        await existing.setFocus();
      } else {
        new WebviewWindow(label, {
          url: `index.html?detached=true&cameraId=${camera.id}&token=${encodeURIComponent(token || "")}&nom=${encodeURIComponent(camera.nom)}&statut=${camera.statut}`,
          title: `Wardis Live - ${camera.nom}`,
          width: 800,
          height: 600,
        });
      }
    });
  };

  // Door Control Actions
  const handleToggleDoor = async (door: Door) => {
    try {
      if (door.status === "open") {
        await closeDoor(door.id);
      } else {
        await openDoor(door.id);
      }
    } catch (e) {
      console.error("Door operation failed", e);
    }
  };

  const handleSimulateSensor = async (sensorId: string) => {
    try {
      await triggerSensor(sensorId);
    } catch (e) {
      console.error("Sensor trigger simulation failed", e);
    }
  };

  // Check if a sensor is currently triggered or has a matching active alarm
  const isSensorAlarmActive = (sensorId: string) => {
    const hasActiveAlarm = activeAlarms.some(a => a.capteur_id === sensorId);
    const sensorObj = sensors.find(s => s.id === sensorId);
    return hasActiveAlarm || (sensorObj && sensorObj.statut === "declenche");
  };

  // Check if a zone is armed
  const getZoneArmStatus = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.statut === "arme" : false;
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 bg-control-panel/20 border border-control-border relative p-4 font-mono select-none">
      
      {/* Dynamic CSS for pulsing glow map elements */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes map-red-flash {
          0% {
            transform: translate(-50%, -50%) scale(0.9);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            background-color: rgba(239, 68, 68, 0.9);
          }
          70% {
            transform: translate(-50%, -50%) scale(1.2);
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            background-color: rgba(127, 29, 29, 0.9);
          }
          100% {
            transform: translate(-50%, -50%) scale(0.9);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            background-color: rgba(239, 68, 68, 0.9);
          }
        }
        .animate-map-alarm {
          animation: map-red-flash 1.2s infinite;
          border-color: #f87171 !important;
        }
      `}} />

      {/* Left Area: The Floor Plan Viewport */}
      <div className="flex-1 flex flex-col min-h-0 bg-control-panel/40 border border-control-border rounded-xl p-3 relative shadow-xs">
        
        {/* Top toolbar */}
        <div className="flex items-center justify-between mb-3 border-b border-control-border/60 pb-2 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-control-cyan animate-pulse" />
            <span className="text-xs font-bold text-control-text-bright uppercase tracking-wider">
              Synoptique de Sécurité Interactif
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-[10px]">
            {/* SVG Loader Trigger */}
            <input 
              type="file" 
              accept=".svg" 
              ref={fileInputRef} 
              onChange={handleSvgUpload} 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 border border-control-border hover:bg-control-cyan/10 hover:text-control-cyan transition-all flex items-center gap-1.5 cursor-pointer"
              title="Load custom SVG Floorplan blueprint"
            >
              <Upload className="h-3 w-3" />
              <span>Charger Plan SVG</span>
            </button>

            {/* Position reset */}
            {isEditMode && (
              <button
                onClick={handleResetPositions}
                className="px-2 py-1 border border-control-red/50 hover:bg-control-red/10 text-control-red transition-all cursor-pointer"
              >
                Reset Coords
              </button>
            )}

            {/* Edit Mode Toggle */}
            <button
              onClick={() => {
                setIsEditMode(!isEditMode);
                setSelectedItem(null);
              }}
              className={`px-3 py-1 border transition-all cursor-pointer flex items-center gap-1 ${
                isEditMode 
                  ? "border-control-amber bg-control-amber/15 text-control-amber font-bold" 
                  : "border-control-cyan bg-control-cyan/5 text-control-cyan hover:bg-control-cyan/15"
              }`}
            >
              {isEditMode ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Enregistrer Carto</span>
                </>
              ) : (
                <>
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Placer Équipements</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* The Map Box */}
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          className={`flex-1 relative bg-black border border-control-border overflow-hidden select-none min-h-[350px] ${
            isEditMode ? "cursor-crosshair" : "cursor-default"
          }`}
        >
          {/* Outer target corners aesthetic */}
          <div className="absolute inset-0 border border-control-cyan/5 pointer-events-none" />
          
          {/* Floor plan SVG representation */}
          {customSvgContent ? (
            <div 
              className="w-full h-full flex items-center justify-center p-2 opacity-75"
              dangerouslySetInnerHTML={{ __html: customSvgContent }} 
            />
          ) : (
            /* Default Vector Guard Station Map */
            <svg viewBox="0 0 800 500" fill="none" className="w-full h-full p-2 opacity-80">
              <defs>
                <pattern id="map-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#22d3ee" strokeWidth="0.5" strokeOpacity="0.04" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#map-grid-pattern)" />
              
              {/* Outer Walls */}
              <rect x="60" y="40" width="680" height="420" rx="6" stroke="#0891b2" strokeWidth="2.5" fill="#0891b2" fillOpacity="0.01" style={{ filter: 'drop-shadow(0 0 4px rgba(8,145,178,0.25))' }} />
              
              {/* Internal Compartments */}
              {/* Room 1: Server Compartment */}
              <path d="M 60 180 L 260 180 L 260 40" stroke="#0891b2" strokeWidth="2" strokeDasharray="3 3" />
              {/* Room 2: HQ Operations */}
              <path d="M 260 40 L 260 220 L 540 220 L 540 40" stroke="#0891b2" strokeWidth="2" />
              {/* Room 3: Main Egress Corridor */}
              <path d="M 540 180 L 740 180" stroke="#0891b2" strokeWidth="2" />
              {/* Room 4: Loading Dock */}
              <path d="M 400 220 L 400 460" stroke="#0891b2" strokeWidth="2" />
              {/* Room 5: Storage room */}
              <path d="M 200 280 L 200 460" stroke="#0891b2" strokeWidth="2" />
              {/* Corridor division */}
              <path d="M 60 280 L 740 280" stroke="#0891b2" strokeWidth="1.5" strokeDasharray="6 3" />
              {/* Room 6: Breakroom/Staff */}
              <path d="M 600 280 L 600 460" stroke="#0891b2" strokeWidth="2" />

              {/* Monospace Labels */}
              <text x="80" y="70" fill="#22d3ee" fillOpacity="0.4" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">ZONE_A: COMPUTATION CRITICAL</text>
              <text x="290" y="70" fill="#22d3ee" fillOpacity="0.4" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">ZONE_B: OPERATIONS HQ</text>
              <text x="560" y="70" fill="#22d3ee" fillOpacity="0.4" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">ZONE_C: MAIN RECEPTION</text>
              <text x="80" y="310" fill="#22d3ee" fillOpacity="0.4" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">ZONE_D: VAULT</text>
              <text x="230" y="310" fill="#22d3ee" fillOpacity="0.4" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">CENTRAL WALKWAY</text>
              <text x="620" y="310" fill="#22d3ee" fillOpacity="0.4" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">ZONE_E: DOCKS</text>
              
              {/* Tech drawings decoration */}
              <rect x="100" y="100" width="30" height="40" stroke="#0891b2" strokeWidth="1" strokeOpacity="0.2" fill="none" />
              <rect x="140" y="100" width="30" height="40" stroke="#0891b2" strokeWidth="1" strokeOpacity="0.2" fill="none" />
              <circle cx="400" cy="130" r="25" stroke="#0891b2" strokeWidth="1" strokeOpacity="0.15" strokeDasharray="2 2" fill="none" />
              <path d="M 380 130 L 420 130 M 400 110 L 400 150" stroke="#0891b2" strokeWidth="1" strokeOpacity="0.2" />
            </svg>
          )}

          {/* Overlay: Render Interactive Draggable/Clickable Node Icons */}
          
          {/* 1. Cameras */}
          {cameras.map((camera, index) => {
            const pos = getCoordinates(camera.id, index, "camera");
            const isSelected = selectedItem?.id === camera.id && selectedItem?.type === "camera";
            return (
              <div
                key={`map-cam-${camera.id}`}
                onMouseDown={handleMouseDown(camera.id)}
                onClick={() => !isEditMode && setSelectedItem({ id: camera.id, type: "camera" })}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border flex items-center justify-center transition-all z-20 cursor-pointer select-none ${
                  isEditMode 
                    ? "border-control-amber bg-black/90 hover:bg-control-amber/20 cursor-grab" 
                    : isSelected 
                      ? "border-control-cyan bg-control-cyan/20 scale-110 shadow-glow"
                      : "border-control-border bg-control-panel/95 hover:border-control-cyan hover:scale-105"
                }`}
                title={`CAM: ${camera.nom}`}
              >
                <Video className={`h-4.5 w-4.5 ${
                  camera.statut === "active" ? "text-control-cyan" : "text-control-text/40"
                }`} />
              </div>
            );
          })}

          {/* 2. Access Doors */}
          {doors.map((door, index) => {
            const pos = getCoordinates(door.id, index, "door");
            const isOpen = door.status === "open";
            const isSelected = selectedItem?.id === door.id && selectedItem?.type === "door";
            return (
              <div
                key={`map-door-${door.id}`}
                onMouseDown={handleMouseDown(door.id)}
                onClick={() => !isEditMode && setSelectedItem({ id: door.id, type: "door" })}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border flex items-center justify-center transition-all z-20 cursor-pointer select-none ${
                  isEditMode 
                    ? "border-control-amber bg-black/90 hover:bg-control-amber/20 cursor-grab" 
                    : isSelected
                      ? "border-control-cyan bg-control-cyan/20 scale-110 shadow-glow"
                      : isOpen
                        ? "border-control-green bg-control-green/10"
                        : "border-control-cyan/60 bg-control-panel-light/95 hover:border-control-cyan"
                }`}
                title={`PORTE: ${door.name} (${isOpen ? "OUVERTE" : "VERROUILLEE"})`}
              >
                {isOpen ? (
                  <DoorOpen className="h-4.5 w-4.5 text-control-green" />
                ) : (
                  <DoorClosed className="h-4.5 w-4.5 text-control-cyan" />
                )}
              </div>
            );
          })}

          {/* 3. Intrusion Sensors */}
          {sensors.map((sensor, index) => {
            const pos = getCoordinates(sensor.id, index, "sensor");
            const isTriggered = isSensorAlarmActive(sensor.id);
            const isArmed = getZoneArmStatus(sensor.zone_id);
            const isSelected = selectedItem?.id === sensor.id && selectedItem?.type === "sensor";

            return (
              <div
                key={`map-sensor-${sensor.id}`}
                onMouseDown={handleMouseDown(sensor.id)}
                onClick={() => !isEditMode && setSelectedItem({ id: sensor.id, type: "sensor" })}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border flex items-center justify-center transition-all z-20 cursor-pointer select-none ${
                  isEditMode 
                    ? "border-control-amber bg-black/90 hover:bg-control-amber/20 cursor-grab" 
                    : isSelected
                      ? "border-control-cyan bg-control-cyan/20 scale-110 shadow-glow"
                      : isTriggered 
                        ? "border-control-red bg-control-red/20 animate-map-alarm" 
                        : isArmed 
                          ? "border-control-amber bg-control-amber/10 hover:border-control-amber"
                          : "border-control-border bg-control-panel-light/95 hover:border-control-cyan"
                }`}
                title={`CAPTEUR: ${sensor.nom} (${isTriggered ? "DECLENCHE" : "OK"})`}
              >
                {sensor.type === "mouvement" ? (
                  <Radio className={`h-4.5 w-4.5 ${
                    isTriggered ? "text-control-red animate-ping" : isArmed ? "text-control-amber" : "text-control-text/50"
                  }`} />
                ) : (
                  <Eye className={`h-4.5 w-4.5 ${
                    isTriggered ? "text-control-red" : isArmed ? "text-control-amber" : "text-control-text/50"
                  }`} />
                )}
              </div>
            );
          })}

          {/* Overlay Edit Mode Status Tag */}
          {isEditMode && (
            <div className="absolute bottom-3 left-3 bg-control-amber/15 border border-control-amber text-control-amber font-mono text-[9px] px-2 py-0.5 animate-pulse font-bold">
              MODE CONFIGURATION CARTO : CLIQUER & GLISSER POUR PLACER
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Futuristic Control panel HUD for Selected Node Details */}
      <div className="w-full lg:w-[320px] bg-control-panel/50 border border-control-border rounded-xl p-4 flex flex-col justify-between shrink-0 font-mono text-xs shadow-xs">
        
        {/* Info panel header */}
        <div className="flex items-center justify-between border-b border-control-border/60 pb-2 mb-3">
          <span className="text-xs font-bold text-control-cyan uppercase tracking-wider">
            Détails Équipement
          </span>
          {selectedItem && (
            <button 
              onClick={() => setSelectedItem(null)}
              className="text-[9px] text-control-text hover:text-control-red transition-all cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Contextual Panel Body */}
        <div className="flex-1 flex flex-col justify-center min-h-[220px]">
          {selectedItem ? (
            (() => {
              // RENDER CAMERA DETAILS
              if (selectedItem.type === "camera") {
                const camera = cameras.find(c => c.id === selectedItem.id);
                if (!camera) return <p className="text-center italic text-control-text/40">Appareil non trouvé</p>;
                return (
                  <div className="space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-control-text-bright font-bold uppercase tracking-wider text-[11px] truncate">
                          {camera.nom}
                        </h4>
                        <span className={`text-[8px] px-1.5 py-0.5 border font-semibold ${
                          camera.statut === "active" ? "border-control-cyan text-control-cyan" : "border-control-red text-control-red"
                        }`}>
                          {camera.statut.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[9px] text-control-text/50 mt-1 max-w-xs break-all">
                        RTSP: {camera.url_rtsp}
                      </p>
                      
                      <div className="mt-2 text-[10px] text-control-text/80 space-y-1">
                        <div>Site: HQ Paris (HQ-1)</div>
                        <div>Source: MediaMTX ingestion</div>
                      </div>
                    </div>

                    {/* Miniature live stream preview */}
                    <div className="py-2 flex justify-center">
                      <MiniPlayer 
                        cameraId={camera.id} 
                        statut={camera.statut} 
                      />
                    </div>

                    <div className="pt-2 border-t border-control-border/40">
                      <button
                        onClick={() => handleDetachStream(camera)}
                        className="w-full py-2 border border-control-cyan bg-control-cyan/5 hover:bg-control-cyan/15 text-control-cyan font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Détacher le flux</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // RENDER ACCESS CONTROL DOOR DETAILS
              if (selectedItem.type === "door") {
                const door = doors.find(d => d.id === selectedItem.id);
                if (!door) return <p className="text-center italic text-control-text/40">Appareil non trouvé</p>;
                const isOpen = door.status === "open";
                return (
                  <div className="space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-control-text-bright font-bold uppercase tracking-wider text-[11px] truncate">
                          {door.name}
                        </h4>
                        <span className={`text-[8px] px-1.5 py-0.5 border font-semibold ${
                          isOpen ? "border-control-green text-control-green" : "border-control-cyan text-control-cyan"
                        }`}>
                          {isOpen ? "OPENED" : "LOCKED"}
                        </span>
                      </div>
                      <p className="text-[10px] text-control-text/60 mt-1 font-mono leading-relaxed">
                        {door.description || "Terminal de contrôle d'accès sécurisé."}
                      </p>
                      <div className="mt-3 text-[10px] text-control-text/80 space-y-1">
                        <div>Site: HQ Paris (HQ-1)</div>
                        <div>Protocol: Wiegand Reader NATS</div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-control-border/40">
                      <button
                        onClick={() => handleToggleDoor(door)}
                        className={`w-full py-2 border font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          isOpen
                            ? "border-control-cyan bg-control-cyan/5 hover:bg-control-cyan/15 text-control-cyan"
                            : "border-control-green bg-control-green/5 hover:bg-control-green/15 text-control-green"
                        }`}
                      >
                        {isOpen ? (
                          <>
                            <Lock className="h-4 w-4" />
                            <span>VERROUILLER LA PORTE</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-4 w-4" />
                            <span>DEVERROUILLER PORTE</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              }

              // RENDER SENSOR INTRUSION DETAILS
              if (selectedItem.type === "sensor") {
                const sensor = sensors.find(s => s.id === sensorIdMatchesSelected(selectedItem.id));
                if (!sensor) return <p className="text-center italic text-control-text/40">Appareil non trouvé</p>;
                const isTriggered = isSensorAlarmActive(sensor.id);
                const zoneObj = zones.find(z => z.id === sensor.zone_id);
                const isArmed = zoneObj?.statut === "arme";

                return (
                  <div className="space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-control-text-bright font-bold uppercase tracking-wider text-[11px] truncate">
                          {sensor.nom}
                        </h4>
                        <span className={`text-[8px] px-1.5 py-0.5 border font-semibold ${
                          isTriggered ? "border-control-red text-control-red" : "border-control-green text-control-green"
                        }`}>
                          {isTriggered ? "DECLENCHE" : "OK"}
                        </span>
                      </div>
                      <p className="text-[10px] text-control-text/50 mt-1 uppercase">
                        Type: {sensor.type} • Zone: {zoneObj?.nom || "Zone"}
                      </p>

                      <div className="mt-3 text-[10px] text-control-text/80 space-y-1">
                        <div>État d'armement: {isArmed ? "ARMÉ" : "DÉSARMÉ"}</div>
                        <div>Trigger alert state: {isTriggered ? "ALERTE EN COURS" : "AUCUNE INTRUSION"}</div>
                      </div>
                      
                      {isTriggered && (
                        <div className="mt-3 bg-control-red/10 border border-control-red/30 p-2 text-control-red text-[10px] flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
                          <span>ALERTE DE COMPORTEMENT ANORMAL DÉCLENCHÉE</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-control-border/40">
                      <button
                        onClick={() => handleSimulateSensor(sensor.id)}
                        className={`w-full py-2 border font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all ${
                          isArmed 
                            ? "border-control-red bg-control-red/5 hover:bg-control-red/15 text-control-red" 
                            : "border-control-border bg-control-panel hover:bg-control-panel-light text-control-text"
                        }`}
                      >
                        <Play className="h-4 w-4" />
                        <span>SIMULER LE DÉCLENCHEMENT</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })()
          ) : (
            /* Standby view */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-control-border/50 bg-control-panel-light/10">
              <ShieldAlert className="h-8 w-8 text-control-cyan/40 mb-2" />
              <p className="text-[10px] text-control-text-bright font-bold uppercase tracking-wider">
                Aucune Sélection
              </p>
              <p className="text-[9px] text-control-text/40 mt-1 leading-relaxed max-w-[200px]">
                Sélectionnez un icône de caméra, porte ou capteur sur la carte pour voir les détails et les actions rapides.
              </p>
            </div>
          )}
        </div>

        {/* Global overview status card */}
        <div className="mt-4 pt-3 border-t border-control-border/60 text-[9px] text-control-text/50">
          <div className="flex items-center justify-between">
            <span>ALARMES ACTIVES :</span>
            <span className={`font-bold ${activeAlarms.length > 0 ? "text-control-red" : "text-control-green"}`}>
              {activeAlarms.length} EN COURS
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>ÉQUIPEMENTS POSITIONNÉS :</span>
            <span>
              {Object.keys(equipmentPositions).length} / {cameras.length + doors.length + sensors.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Helper to resolve sensor IDs in case of string format variations
  function sensorIdMatchesSelected(selectedId: string): string {
    return selectedId;
  }
};
