import React, { useEffect, useState, useRef } from "react";
import { useCameraStore, Camera } from "../store/cameraStore";
import { useAccessControlStore, Door } from "../store/accessControlStore";
import { useAlarmStore } from "../store/alarmStore";
import { useAuthStore } from "../store/authStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getWhepBaseUrl } from "../store/config";
import { 
  Video, 
  DoorClosed, 
  DoorOpen, 
  Radio, 
  Eye, 
  Edit3, 
  Check, 
  Play, 
  Unlock, 
  Lock, 
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  X,
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  ChevronRight,
  Plus,
  Compass,
  FileImage,
  RefreshCw
} from "lucide-react";

interface Position {
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
}

interface MapLink {
  id: string;
  targetMapId: string;
  x: number;
  y: number;
  label: string;
}

interface FloorPlan {
  id: string;
  name: string;
  imageContent: string | null; // Base64 data URL or null for default blueprint
  parentId: string | null; // For nesting hierarchy
  equipmentPositions: Record<string, Position>;
  links: MapLink[];
}

// ==========================================
// 1. Mini Stream Player for Map Tooltips & Inline Popups
// ==========================================
interface MiniPlayerProps {
  cameraId: string;
  statut: string;
  width?: string;
  height?: string;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ cameraId, statut, width = "180px", height = "110px" }) => {
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

        const whepUrl = getWhepBaseUrl(cameraId, token);
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
    <div 
      style={{ width, height }} 
      className="bg-black border border-control-border relative flex items-center justify-center overflow-hidden rounded-lg shadow-2xl"
    >
      {status === "playing" ? (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      ) : status === "connecting" ? (
        <div className="flex flex-col items-center gap-1">
          <div className="h-5 w-5 border border-control-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-[8px] text-control-cyan tracking-widest animate-pulse">CONNECTING...</span>
        </div>
      ) : (
        <div className="text-[8px] text-control-red font-bold uppercase flex flex-col items-center gap-1">
          <ShieldAlert className="h-5 w-5 animate-pulse" />
          <span>FEED OFFLINE</span>
        </div>
      )}
      <div className="absolute top-1.5 left-1.5 bg-black/85 px-1.5 py-0.5 border border-control-cyan/30 text-[7px] text-control-cyan font-mono rounded">
        LIVE PREVIEW
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

  // Mapping State
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string>("main");
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: string; type: "camera" | "door" | "sensor" | "link" } | null>(null);
  
  // Inline camera stream popup overlay state
  const [activeVideoPopup, setActiveVideoPopup] = useState<{ cameraId: string; x: number; y: number; name: string; statut: string } | null>(null);

  // Zoom and Pan State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Drag and Drop State
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<"camera" | "door" | "sensor" | "link" | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial configurations
  useEffect(() => {
    fetchCameras();
    fetchDoors();
    fetchZones();
    fetchSensors();
    fetchActiveAlarms();

    const savedPlans = localStorage.getItem("wardis_floorplans");
    if (savedPlans) {
      try {
        const parsed = JSON.parse(savedPlans);
        if (parsed && parsed.length > 0) {
          setPlans(parsed);
          // Set first plan as active
          setCurrentPlanId(parsed[0].id);
        } else {
          setupDefaultPlans();
        }
      } catch (e) {
        console.error("Failed to parse floorplans", e);
        setupDefaultPlans();
      }
    } else {
      setupDefaultPlans();
    }
  }, [fetchCameras, fetchDoors, fetchZones, fetchSensors, fetchActiveAlarms]);

  // Setup default site plan hierarchy
  const setupDefaultPlans = () => {
    const defaultPlans: FloorPlan[] = [
      {
        id: "main",
        name: "Plan du Site Principal",
        imageContent: null,
        parentId: null,
        equipmentPositions: {},
        links: [
          {
            id: "link-to-bat-a",
            targetMapId: "bat-a",
            x: 35,
            y: 25,
            label: "Accéder au Bâtiment A"
          },
          {
            id: "link-to-bat-b",
            targetMapId: "bat-b",
            x: 65,
            y: 65,
            label: "Accéder au Bâtiment B"
          }
        ]
      },
      {
        id: "bat-a",
        name: "Bâtiment A - PC Sécurité",
        imageContent: null,
        parentId: "main",
        equipmentPositions: {},
        links: []
      },
      {
        id: "bat-b",
        name: "Bâtiment B - Docks & Stockage",
        imageContent: null,
        parentId: "main",
        equipmentPositions: {},
        links: []
      }
    ];

    setPlans(defaultPlans);
    setCurrentPlanId("main");
    savePlansToStorage(defaultPlans);
  };

  const savePlansToStorage = (updatedPlans: FloorPlan[]) => {
    localStorage.setItem("wardis_floorplans", JSON.stringify(updatedPlans));
  };

  // Get currently active floor plan
  const currentPlan = plans.find(p => p.id === currentPlanId) || plans[0] || {
    id: "main",
    name: "Plan Principal",
    imageContent: null,
    parentId: null,
    equipmentPositions: {},
    links: []
  };

  // Build Breadcrumb Hierarchy path
  const getBreadcrumbs = () => {
    const crumbs: { id: string; name: string }[] = [];
    let currentId: string | null = currentPlanId;
    while (currentId) {
      const current = plans.find(p => p.id === currentId);
      if (!current) break;
      crumbs.unshift({ id: current.id, name: current.name });
      currentId = current.parentId;
    }
    return crumbs;
  };

  // Handle Floor Plan Image Upload (PNG/JPG/SVG/WebP)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const updated = plans.map(p => {
        if (p.id === currentPlanId) {
          return { ...p, imageContent: dataUrl };
        }
        return p;
      });
      setPlans(updated);
      savePlansToStorage(updated);
    };
    reader.readAsDataURL(file);
  };

  // Create a new nested plan
  const handleCreateSubPlan = () => {
    const name = window.prompt("Nom du nouveau sous-plan :");
    if (!name) return;

    const newId = `subplan-${Date.now()}`;
    const newPlan: FloorPlan = {
      id: newId,
      name: name,
      imageContent: null,
      parentId: currentPlanId,
      equipmentPositions: {},
      links: []
    };

    // Add a link pointing to the new plan on the current plan's center
    const updated = plans.map(p => {
      if (p.id === currentPlanId) {
        return {
          ...p,
          links: [
            ...p.links,
            {
              id: `link-${Date.now()}`,
              targetMapId: newId,
              x: 50,
              y: 50,
              label: name
            }
          ]
        };
      }
      return p;
    });

    const newPlansList = [...updated, newPlan];
    setPlans(newPlansList);
    savePlansToStorage(newPlansList);
    setSelectedItem(null);
  };

  // Delete current plan
  const handleDeletePlan = () => {
    if (currentPlanId === "main") {
      alert("Le plan principal ne peut pas être supprimé.");
      return;
    }

    if (window.confirm(`Voulez-vous vraiment supprimer le plan "${currentPlan.name}" ?`)) {
      const parentId = currentPlan.parentId || "main";
      
      // Remove the plan, and remove any links pointing to it in all other plans
      const updated = plans
        .filter(p => p.id !== currentPlanId)
        .map(p => {
          return {
            ...p,
            links: p.links.filter(l => l.targetMapId !== currentPlanId)
          };
        });

      setPlans(updated);
      savePlansToStorage(updated);
      setCurrentPlanId(parentId);
      setSelectedItem(null);
    }
  };

  // Zoom & Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let nextZoom = zoom;
    if (e.deltaY < 0) {
      nextZoom = Math.min(5, zoom * zoomFactor);
    } else {
      nextZoom = Math.max(0.5, zoom / zoomFactor);
    }
    setZoom(nextZoom);
  };

  const handleMouseDownViewport = (e: React.MouseEvent) => {
    // Start panning if we left-click on background (and not editing/dragging)
    if (activeDragId) return;
    
    // Only pan on background clicks or middle click
    const isBackground = e.target === mapViewportRef.current || (e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).tagName === "rect" || (e.target as HTMLElement).tagName === "img";
    if (isBackground || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMoveViewport = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (isEditMode && activeDragId && containerRef.current) {
      // Handle drag positioning of items already on the map
      const rect = containerRef.current.getBoundingClientRect();
      // Calculate coordinates relative to the panned/zoomed canvas
      // Let's project screen coordinates back to map coordinate percentages
      let x = ((e.clientX - rect.left - pan.x) / (rect.width * zoom)) * 100;
      let y = ((e.clientY - rect.top - pan.y) / (rect.height * zoom)) * 100;

      x = Math.max(0.5, Math.min(99.5, x));
      y = Math.max(0.5, Math.min(99.5, y));

      const updated = plans.map(p => {
        if (p.id === currentPlanId) {
          if (activeDragType === "link") {
            const updatedLinks = p.links.map(l => {
              if (l.id === activeDragId) {
                return { ...l, x, y };
              }
              return l;
            });
            return { ...p, links: updatedLinks };
          } else {
            // Equipment position
            return {
              ...p,
              equipmentPositions: {
                ...p.equipmentPositions,
                [activeDragId]: { x, y }
              }
            };
          }
        }
        return p;
      });

      setPlans(updated);
    }
  };

  const handleMouseUpViewport = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (activeDragId) {
      setActiveDragId(null);
      setActiveDragType(null);
      savePlansToStorage(plans);
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Drag and Drop from Sidebar
  const handleDragStartFromSidebar = (e: React.DragEvent, id: string, type: "camera" | "door" | "sensor" | "link") => {
    e.dataTransfer.setData("wardis/entity-id", id);
    e.dataTransfer.setData("wardis/entity-type", type);
  };

  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const id = e.dataTransfer.getData("wardis/entity-id");
    const type = e.dataTransfer.getData("wardis/entity-type") as "camera" | "door" | "sensor" | "link";

    if (!id || !type) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Project canvas coordinates under current zoom/pan
    let x = ((e.clientX - rect.left - pan.x) / (rect.width * zoom)) * 100;
    let y = ((e.clientY - rect.top - pan.y) / (rect.height * zoom)) * 100;

    x = Math.max(0.5, Math.min(99.5, x));
    y = Math.max(0.5, Math.min(99.5, y));

    const updated = plans.map(p => {
      if (p.id === currentPlanId) {
        if (type === "link") {
          // If we drag a subplan from sidebar
          const subPlan = plans.find(sp => sp.id === id);
          if (!subPlan) return p;
          
          // Check if link already exists
          if (p.links.some(l => l.targetMapId === id)) return p;

          return {
            ...p,
            links: [
              ...p.links,
              {
                id: `link-${Date.now()}`,
                targetMapId: id,
                x,
                y,
                label: subPlan.name
              }
            ]
          };
        } else {
          // Add equipment position
          return {
            ...p,
            equipmentPositions: {
              ...p.equipmentPositions,
              [id]: { x, y }
            }
          };
        }
      }
      return p;
    });

    setPlans(updated);
    savePlansToStorage(updated);
    setSelectedItem({ id, type });
  };

  // Remove element positioning (Unplace it)
  const handleRemoveFromMap = (id: string, type: "camera" | "door" | "sensor" | "link") => {
    const updated = plans.map(p => {
      if (p.id === currentPlanId) {
        if (type === "link") {
          return {
            ...p,
            links: p.links.filter(l => l.id !== id)
          };
        } else {
          const newPositions = { ...p.equipmentPositions };
          delete newPositions[id];
          return {
            ...p,
            equipmentPositions: newPositions
          };
        }
      }
      return p;
    });

    setPlans(updated);
    savePlansToStorage(updated);
    setSelectedItem(null);
  };

  // Reset positions on the current map
  const handleResetPositions = () => {
    if (window.confirm("Voulez-vous réinitialiser le placement de tous les éléments sur ce plan ?")) {
      const updated = plans.map(p => {
        if (p.id === currentPlanId) {
          return {
            ...p,
            equipmentPositions: {},
            links: []
          };
        }
        return p;
      });
      setPlans(updated);
      savePlansToStorage(updated);
      setSelectedItem(null);
    }
  };

  // Action Launch Detached Window
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

  // Access Control Operations
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

  // Sensors Trigger Action
  const handleSimulateSensor = async (sensorId: string) => {
    try {
      await triggerSensor(sensorId);
    } catch (e) {
      console.error("Sensor trigger simulation failed", e);
    }
  };

  // Helper check status functions
  const isSensorAlarmActive = (sensorId: string) => {
    const hasActiveAlarm = activeAlarms.some(a => a.capteur_id === sensorId);
    const sensorObj = sensors.find(s => s.id === sensorId);
    return hasActiveAlarm || (sensorObj && sensorObj.statut === "declenche");
  };

  const isCameraAlarmActive = (cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera || !camera.zone_id) return false;
    return activeAlarms.some(a => a.zone_id === camera.zone_id);
  };

  const isDoorAlarmActive = (doorId: string) => {
    const door = doors.find(d => d.id === doorId);
    if (!door) return false;
    const isAlarmState = door.status === "forced" || door.status === "held_open";
    const hasZoneAlarm = door.zone_id ? activeAlarms.some(a => a.zone_id === door.zone_id) : false;
    return isAlarmState || hasZoneAlarm;
  };

  const getZoneArmStatus = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.statut === "arme" : false;
  };

  // Items status classifications
  const isPlaced = (id: string, _type?: string) => {
    return currentPlan.equipmentPositions[id] !== undefined;
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0 bg-control-panel/20 border border-control-border relative p-4 font-mono select-none">
      
      {/* Red Pulse CSS for Alarms */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes map-red-flash {
          0% {
            transform: translate(-50%, -50%) scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8);
            background-color: rgba(239, 68, 68, 0.95);
          }
          70% {
            transform: translate(-50%, -50%) scale(1.25);
            box-shadow: 0 0 0 12px rgba(239, 68, 68, 0);
            background-color: rgba(127, 29, 29, 0.95);
          }
          100% {
            transform: translate(-50%, -50%) scale(0.95);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            background-color: rgba(239, 68, 68, 0.95);
          }
        }
        .animate-map-alarm {
          animation: map-red-flash 1.2s infinite;
          border-color: #f87171 !important;
        }
      `}} />

      {/* Main Floor Plan Viewport Panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-control-panel/40 border border-control-border rounded-xl p-3 relative shadow-xs">
        
        {/* Navigation Breadcrumbs & Top Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-control-border/60 pb-2 shrink-0 z-10">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <Compass className="h-4 w-4 text-control-cyan animate-spin-slow shrink-0" />
            <div className="flex items-center text-xs gap-1.5 whitespace-nowrap">
              {getBreadcrumbs().map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-control-text/40 shrink-0" />}
                  <button
                    onClick={() => {
                      setCurrentPlanId(crumb.id);
                      setSelectedItem(null);
                      setActiveVideoPopup(null);
                    }}
                    className={`font-bold hover:text-control-cyan hover:underline transition-all ${
                      crumb.id === currentPlanId ? "text-control-text-bright" : "text-control-text/60"
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-[10px]">
            {/* View Controls */}
            <div className="flex items-center border border-control-border bg-black/40 rounded overflow-hidden">
              <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} className="p-1.5 hover:bg-control-cyan/15 text-control-text hover:text-control-cyan" title="Zoom In">
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setZoom(z => Math.max(0.5, z / 1.2))} className="p-1.5 hover:bg-control-cyan/15 text-control-text hover:text-control-cyan" title="Zoom Out">
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button onClick={resetView} className="p-1.5 hover:bg-control-cyan/15 text-control-text hover:text-control-cyan border-l border-control-border" title="Recenter Map">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Custom Image Upload */}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 border border-control-border hover:bg-control-cyan/10 hover:text-control-cyan transition-all flex items-center gap-1.5 cursor-pointer"
              title="Importer un fichier image de plan"
            >
              <FileImage className="h-3 w-3" />
              <span>Charger Image Plan</span>
            </button>

            {/* Plan Operations */}
            <button
              onClick={handleCreateSubPlan}
              className="px-2.5 py-1 border border-control-border hover:bg-control-cyan/10 hover:text-control-cyan transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nouveau Sous-plan</span>
            </button>

            {currentPlanId !== "main" && (
              <button
                onClick={handleDeletePlan}
                className="px-2.5 py-1 border border-control-red/40 hover:bg-control-red/10 text-control-red transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Supprimer Plan</span>
              </button>
            )}

            {isEditMode && (
              <button
                onClick={handleResetPositions}
                className="px-2.5 py-1 border border-control-red/50 hover:bg-control-red/10 text-control-red transition-all cursor-pointer"
              >
                Reset Coords
              </button>
            )}

            {/* Edit Mode Toggle */}
            <button
              onClick={() => {
                setIsEditMode(!isEditMode);
                setSelectedItem(null);
                setActiveVideoPopup(null);
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

        {/* Viewport Frame Container */}
        <div 
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDownViewport}
          onMouseMove={handleMouseMoveViewport}
          onMouseUp={handleMouseUpViewport}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnCanvas}
          className={`flex-1 relative bg-black border border-control-border overflow-hidden select-none min-h-[450px] ${
            isPanning ? "cursor-grabbing" : isEditMode ? "cursor-crosshair" : "cursor-default"
          }`}
        >
          {/* Grid lines decoration */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
            backgroundImage: "radial-gradient(circle, #00a2ff 1px, transparent 1px)",
            backgroundSize: "20px 20px"
          }} />

          {/* Transforming Canvas wrapper */}
          <div
            ref={mapViewportRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.05s linear"
            }}
            className="w-full h-full absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            {/* The Actual Floor Plan Background */}
            <div className="relative w-full h-full flex items-center justify-center p-2 pointer-events-auto">
              {currentPlan.imageContent ? (
                <img 
                  src={currentPlan.imageContent} 
                  alt={currentPlan.name} 
                  className="max-w-full max-h-full object-contain pointer-events-none select-none opacity-85"
                />
              ) : (
                /* Default Vector Blueprint */
                <svg viewBox="0 0 800 500" fill="none" className="w-full h-full max-w-[800px] p-2 opacity-80 pointer-events-none">
                  <defs>
                    <pattern id="map-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00a2ff" strokeWidth="0.5" strokeOpacity="0.04" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#map-grid-pattern)" />
                  
                  {/* Outer Walls */}
                  <rect x="60" y="40" width="680" height="420" rx="6" stroke="#00a2ff" strokeWidth="2.5" strokeOpacity="0.3" fill="#00a2ff" fillOpacity="0.01" />
                  
                  {/* Internal Compartments */}
                  <path d="M 60 180 L 260 180 L 260 40" stroke="#00a2ff" strokeWidth="2" strokeOpacity="0.25" strokeDasharray="3 3" />
                  <path d="M 260 40 L 260 220 L 540 220 L 540 40" stroke="#00a2ff" strokeWidth="2" strokeOpacity="0.25" />
                  <path d="M 540 180 L 740 180" stroke="#00a2ff" strokeWidth="2" strokeOpacity="0.25" />
                  <path d="M 400 220 L 400 460" stroke="#00a2ff" strokeWidth="2" strokeOpacity="0.25" />
                  <path d="M 200 280 L 200 460" stroke="#00a2ff" strokeWidth="2" strokeOpacity="0.25" />
                  <path d="M 60 280 L 740 280" stroke="#00a2ff" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="6 3" />
                  
                  {/* Monospace Labels */}
                  <text x="80" y="70" fill="#00a2ff" fillOpacity="0.3" fontSize="8" fontFamily="monospace" fontWeight="bold">ZONE_A: INFORMATIQUE</text>
                  <text x="290" y="70" fill="#00a2ff" fillOpacity="0.3" fontSize="8" fontFamily="monospace" fontWeight="bold">ZONE_B: OPÉRATIONS HQ</text>
                  <text x="560" y="70" fill="#00a2ff" fillOpacity="0.3" fontSize="8" fontFamily="monospace" fontWeight="bold">ZONE_C: ACCUEIL</text>
                  <text x="80" y="310" fill="#00a2ff" fillOpacity="0.3" fontSize="8" fontFamily="monospace" fontWeight="bold">ZONE_D: STOCKAGE</text>
                  <text x="620" y="310" fill="#00a2ff" fillOpacity="0.3" fontSize="8" fontFamily="monospace" fontWeight="bold">ZONE_E: LOGISTIQUE</text>
                </svg>
              )}

              {/* Render Placed Interactive Node Icons */}
              
              {/* 1. Cameras */}
              {cameras.map((camera) => {
                const pos = currentPlan.equipmentPositions[camera.id];
                if (!pos) return null;
                const isSelected = selectedItem?.id === camera.id && selectedItem?.type === "camera";
                const isAlarm = isCameraAlarmActive(camera.id);
                
                return (
                  <div
                    key={`map-cam-${camera.id}`}
                    onMouseDown={(e) => {
                      if (isEditMode) {
                        e.stopPropagation();
                        setActiveDragId(camera.id);
                        setActiveDragType("camera");
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditMode) {
                        setSelectedItem({ id: camera.id, type: "camera" });
                        setActiveVideoPopup({
                          cameraId: camera.id,
                          x: pos.x,
                          y: pos.y,
                          name: camera.nom,
                          statut: camera.statut
                        });
                      }
                    }}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border flex items-center justify-center transition-all z-20 cursor-pointer select-none ${
                      isEditMode 
                        ? "border-control-amber bg-black/90 hover:bg-control-amber/20 cursor-grab" 
                        : isAlarm
                          ? "border-control-red bg-control-red/20 animate-map-alarm"
                          : isSelected 
                            ? "border-control-cyan bg-control-cyan/25 scale-110 shadow-glow"
                            : "border-control-border bg-control-panel/95 hover:border-control-cyan hover:scale-105"
                    }`}
                    title={`CAM: ${camera.nom}`}
                  >
                    <Video className={`h-4.5 w-4.5 ${
                      isAlarm 
                        ? "text-control-red" 
                        : camera.statut === "active" 
                          ? "text-control-cyan" 
                          : "text-control-gray"
                    }`} />
                  </div>
                );
              })}

              {/* 2. Access Control Doors */}
              {doors.map((door) => {
                const pos = currentPlan.equipmentPositions[door.id];
                if (!pos) return null;
                const isOpen = door.status === "open";
                const isSelected = selectedItem?.id === door.id && selectedItem?.type === "door";
                const isAlarm = isDoorAlarmActive(door.id);

                return (
                  <div
                    key={`map-door-${door.id}`}
                    onMouseDown={(e) => {
                      if (isEditMode) {
                        e.stopPropagation();
                        setActiveDragId(door.id);
                        setActiveDragType("door");
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditMode) {
                        setSelectedItem({ id: door.id, type: "door" });
                        setActiveVideoPopup(null);
                      }
                    }}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border flex items-center justify-center transition-all z-20 cursor-pointer select-none ${
                      isEditMode 
                        ? "border-control-amber bg-black/90 hover:bg-control-amber/20 cursor-grab" 
                        : isAlarm
                          ? "border-control-red bg-control-red/20 animate-map-alarm"
                          : isSelected
                            ? "border-control-cyan bg-control-cyan/25 scale-110 shadow-glow"
                            : isOpen
                              ? "border-control-green bg-control-green/15"
                              : "border-control-cyan/60 bg-control-panel-light/95 hover:border-control-cyan"
                    }`}
                    title={`PORTE: ${door.name} (${isOpen ? "OUVERTE" : "VERROUILLEE"})`}
                  >
                    {isOpen ? (
                      <DoorOpen className={`h-4.5 w-4.5 ${isAlarm ? "text-control-red" : "text-control-green"}`} />
                    ) : (
                      <DoorClosed className={`h-4.5 w-4.5 ${isAlarm ? "text-control-red" : "text-control-cyan"}`} />
                    )}
                  </div>
                );
              })}

              {/* 3. Sensors */}
              {sensors.map((sensor) => {
                const pos = currentPlan.equipmentPositions[sensor.id];
                if (!pos) return null;
                const isTriggered = isSensorAlarmActive(sensor.id);
                const isArmed = getZoneArmStatus(sensor.zone_id);
                const isSelected = selectedItem?.id === sensor.id && selectedItem?.type === "sensor";

                return (
                  <div
                    key={`map-sensor-${sensor.id}`}
                    onMouseDown={(e) => {
                      if (isEditMode) {
                        e.stopPropagation();
                        setActiveDragId(sensor.id);
                        setActiveDragType("sensor");
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditMode) {
                        setSelectedItem({ id: sensor.id, type: "sensor" });
                        setActiveVideoPopup(null);
                      }
                    }}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full border flex items-center justify-center transition-all z-20 cursor-pointer select-none ${
                      isEditMode 
                        ? "border-control-amber bg-black/90 hover:bg-control-amber/20 cursor-grab" 
                        : isSelected
                          ? "border-control-cyan bg-control-cyan/25 scale-110 shadow-glow"
                          : isTriggered 
                            ? "border-control-red bg-control-red/20 animate-map-alarm" 
                            : isArmed 
                              ? "border-control-amber bg-control-amber/15 hover:border-control-amber"
                              : "border-control-border bg-control-panel-light/95 hover:border-control-cyan"
                    }`}
                    title={`CAPTEUR: ${sensor.nom} (${isTriggered ? "DECLENCHE" : "OK"})`}
                  >
                    {sensor.type === "mouvement" ? (
                      <Radio className={`h-4.5 w-4.5 ${
                        isTriggered ? "text-control-red animate-ping" : isArmed ? "text-control-amber" : "text-control-text/60"
                      }`} />
                    ) : (
                      <Eye className={`h-4.5 w-4.5 ${
                        isTriggered ? "text-control-red" : isArmed ? "text-control-amber" : "text-control-text/60"
                      }`} />
                    )}
                  </div>
                );
              })}

              {/* 4. Nesting Map Links */}
              {currentPlan.links.map((link) => {
                const isSelected = selectedItem?.id === link.id && selectedItem?.type === "link";
                return (
                  <div
                    key={`map-link-${link.id}`}
                    onMouseDown={(e) => {
                      if (isEditMode) {
                        e.stopPropagation();
                        setActiveDragId(link.id);
                        setActiveDragType("link");
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditMode) {
                        setCurrentPlanId(link.targetMapId);
                        setSelectedItem(null);
                        setActiveVideoPopup(null);
                      } else {
                        setSelectedItem({ id: link.id, type: "link" });
                      }
                    }}
                    style={{ left: `${link.x}%`, top: `${link.y}%` }}
                    className={`absolute px-2.5 py-1.5 -translate-x-1/2 -translate-y-1/2 border rounded flex items-center gap-1.5 transition-all z-20 cursor-pointer select-none text-[9px] font-bold ${
                      isEditMode
                        ? "border-control-amber bg-black/90 hover:bg-control-amber/20 cursor-grab"
                        : isSelected
                          ? "border-control-cyan bg-control-cyan/30 text-control-cyan scale-105"
                          : "border-control-cyan/50 bg-black/85 text-control-text hover:border-control-cyan hover:text-control-cyan"
                    }`}
                  >
                    <MapIcon className="h-3 w-3 shrink-0" />
                    <span>{link.label}</span>
                  </div>
                );
              })}

              {/* Live Inline Camera Stream Popup */}
              {activeVideoPopup && !isEditMode && (
                <div 
                  style={{ 
                    left: `${activeVideoPopup.x}%`, 
                    top: `${activeVideoPopup.y - 12}%`,
                    transform: "translateX(-50%) translateY(-100%)" 
                  }}
                  className="absolute z-30 p-2 bg-control-panel border border-control-cyan/50 rounded-xl shadow-2xl flex flex-col gap-1.5 w-[220px]"
                >
                  <div className="flex items-center justify-between border-b border-control-border/60 pb-1">
                    <span className="text-[10px] font-bold text-control-text-bright truncate max-w-[150px]">{activeVideoPopup.name}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveVideoPopup(null);
                      }} 
                      className="text-control-text hover:text-control-red transition-all cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <MiniPlayer 
                    cameraId={activeVideoPopup.cameraId} 
                    statut={activeVideoPopup.statut} 
                    width="200px" 
                    height="120px" 
                  />
                  <div className="flex justify-between items-center text-[7px] text-control-text/60 mt-0.5">
                    <span>STATUS: {activeVideoPopup.statut.toUpperCase()}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const camera = cameras.find(c => c.id === activeVideoPopup.cameraId);
                        if (camera) handleDetachStream(camera);
                      }}
                      className="text-control-cyan hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink className="h-2 w-2" /> DÉTACHER
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Configuration mode floating hint */}
          {isEditMode && (
            <div className="absolute bottom-3 left-3 bg-control-amber/15 border border-control-amber text-control-amber font-mono text-[9px] px-2 py-0.5 animate-pulse font-bold rounded">
              MODE CONFIGURATION CARTO : GLISSER DES ÉLÉMENTS SUR LE PLAN POUR LES PLACER / GLISSER POUR REPOSITIONNER
            </div>
          )}
        </div>
      </div>

      {/* Right Control & Assets List Panel */}
      <div className="w-full xl:w-[320px] bg-control-panel/50 border border-control-border rounded-xl p-4 flex flex-col justify-between shrink-0 font-mono text-xs shadow-xs">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-control-border/60 pb-2 mb-3">
          <span className="text-xs font-bold text-control-cyan uppercase tracking-wider">
            {isEditMode ? "Équipements à placer" : "Détails Équipement"}
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

        {/* Panel Body */}
        <div className="flex-1 flex flex-col min-h-[300px] overflow-y-auto">
          {isEditMode ? (
            /* CONFIGURATION SIDEBAR LIST */
            <div className="space-y-4 pr-1">
              <div>
                <p className="text-[10px] text-control-text/40 uppercase font-bold tracking-wider mb-2">Caméras</p>
                <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1">
                  {cameras.map(c => {
                    const placed = isPlaced(c.id, "camera");
                    return (
                      <div 
                        key={c.id}
                        draggable
                        onDragStart={(e) => handleDragStartFromSidebar(e, c.id, "camera")}
                        className={`flex items-center justify-between p-1.5 border rounded cursor-grab transition-all text-[10px] ${
                          placed 
                            ? "border-control-cyan/20 bg-control-cyan/5 opacity-60" 
                            : "border-control-border bg-black/40 hover:border-control-cyan"
                        }`}
                      >
                        <span className="truncate max-w-[170px]">{c.nom}</span>
                        {placed ? <Check className="h-3.5 w-3.5 text-control-cyan" /> : <span className="text-[8px] text-control-text/40">GLISSER</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-control-text/40 uppercase font-bold tracking-wider mb-2">Portes</p>
                <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1">
                  {doors.map(d => {
                    const placed = isPlaced(d.id, "door");
                    return (
                      <div 
                        key={d.id}
                        draggable
                        onDragStart={(e) => handleDragStartFromSidebar(e, d.id, "door")}
                        className={`flex items-center justify-between p-1.5 border rounded cursor-grab transition-all text-[10px] ${
                          placed 
                            ? "border-control-cyan/20 bg-control-cyan/5 opacity-60" 
                            : "border-control-border bg-black/40 hover:border-control-cyan"
                        }`}
                      >
                        <span className="truncate max-w-[170px]">{d.name}</span>
                        {placed ? <Check className="h-3.5 w-3.5 text-control-cyan" /> : <span className="text-[8px] text-control-text/40">GLISSER</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-control-text/40 uppercase font-bold tracking-wider mb-2">Capteurs</p>
                <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1">
                  {sensors.map(s => {
                    const placed = isPlaced(s.id, "sensor");
                    return (
                      <div 
                        key={s.id}
                        draggable
                        onDragStart={(e) => handleDragStartFromSidebar(e, s.id, "sensor")}
                        className={`flex items-center justify-between p-1.5 border rounded cursor-grab transition-all text-[10px] ${
                          placed 
                            ? "border-control-cyan/20 bg-control-cyan/5 opacity-60" 
                            : "border-control-border bg-black/40 hover:border-control-cyan"
                        }`}
                      >
                        <span className="truncate max-w-[170px]">{s.nom}</span>
                        {placed ? <Check className="h-3.5 w-3.5 text-control-cyan" /> : <span className="text-[8px] text-control-text/40">GLISSER</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-control-text/40 uppercase font-bold tracking-wider mb-2">Raccourcis Plans</p>
                <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1">
                  {plans.filter(p => p.id !== currentPlanId).map(p => {
                    const alreadyLinked = currentPlan.links.some(l => l.targetMapId === p.id);
                    return (
                      <div 
                        key={p.id}
                        draggable={!alreadyLinked}
                        onDragStart={(e) => handleDragStartFromSidebar(e, p.id, "link")}
                        className={`flex items-center justify-between p-1.5 border rounded transition-all text-[10px] ${
                          alreadyLinked 
                            ? "border-control-cyan/20 bg-control-cyan/5 opacity-60 cursor-not-allowed" 
                            : "border-control-border bg-black/40 hover:border-control-cyan cursor-grab"
                        }`}
                      >
                        <span className="truncate max-w-[170px]">{p.name}</span>
                        {alreadyLinked ? <Check className="h-3.5 w-3.5 text-control-cyan" /> : <span className="text-[8px] text-control-text/40">GLISSER</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : selectedItem ? (
            /* DETAILED DETAILS VIEW */
            (() => {
              // CAMERA DETAILS
              if (selectedItem.type === "camera") {
                const camera = cameras.find(c => c.id === selectedItem.id);
                if (!camera) return <p className="text-center italic text-control-text/40">Appareil non trouvé</p>;
                const hasAlarm = isCameraAlarmActive(camera.id);
                return (
                  <div className="space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-control-text-bright font-bold uppercase tracking-wider text-[11px] truncate">
                          {camera.nom}
                        </h4>
                        <span className={`text-[8px] px-1.5 py-0.5 border font-semibold ${
                          hasAlarm 
                            ? "border-control-red text-control-red animate-pulse" 
                            : camera.statut === "active" 
                              ? "border-control-cyan text-control-cyan" 
                              : "border-control-gray text-control-gray"
                        }`}>
                          {hasAlarm ? "ALARME" : camera.statut.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[9px] text-control-text/50 mt-1 max-w-xs break-all">
                        RTSP: {camera.url_rtsp}
                      </p>
                      
                      <div className="mt-3 text-[10px] text-control-text/80 space-y-1">
                        <div>Plan actuel: {currentPlan.name}</div>
                        <div>Source: MediaMTX ingestion</div>
                      </div>
                    </div>

                    <div className="py-2 flex justify-center">
                      <MiniPlayer 
                        cameraId={camera.id} 
                        statut={camera.statut} 
                      />
                    </div>

                    <div className="pt-2 border-t border-control-border/40 flex flex-col gap-1.5">
                      <button
                        onClick={() => handleDetachStream(camera)}
                        className="w-full py-2 border border-control-cyan bg-control-cyan/5 hover:bg-control-cyan/15 text-control-cyan font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Détacher le flux</span>
                      </button>
                      <button
                        onClick={() => handleRemoveFromMap(camera.id, "camera")}
                        className="w-full py-2 border border-control-red/40 hover:bg-control-red/10 text-control-red font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Retirer de la carte</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // DOOR DETAILS
              if (selectedItem.type === "door") {
                const door = doors.find(d => d.id === selectedItem.id);
                if (!door) return <p className="text-center italic text-control-text/40">Appareil non trouvé</p>;
                const isOpen = door.status === "open";
                const hasAlarm = isDoorAlarmActive(door.id);
                return (
                  <div className="space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-control-text-bright font-bold uppercase tracking-wider text-[11px] truncate">
                          {door.name}
                        </h4>
                        <span className={`text-[8px] px-1.5 py-0.5 border font-semibold ${
                          hasAlarm 
                            ? "border-control-red text-control-red animate-pulse" 
                            : isOpen 
                              ? "border-control-green text-control-green" 
                              : "border-control-cyan text-control-cyan"
                        }`}>
                          {hasAlarm ? "ALARME" : isOpen ? "OUVERTE" : "VERROUILLÉE"}
                        </span>
                      </div>
                      <p className="text-[10px] text-control-text/60 mt-1 font-mono leading-relaxed">
                        {door.description || "Terminal de contrôle d'accès sécurisé."}
                      </p>
                      <div className="mt-3 text-[10px] text-control-text/80 space-y-1">
                        <div>Plan actuel: {currentPlan.name}</div>
                        <div>Protocole: Wiegand Reader NATS</div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-control-border/40 flex flex-col gap-1.5">
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
                            <span>DÉVERROUILLER PORTE</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleRemoveFromMap(door.id, "door")}
                        className="w-full py-2 border border-control-red/40 hover:bg-control-red/10 text-control-red font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Retirer de la carte</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // SENSOR DETAILS
              if (selectedItem.type === "sensor") {
                const sensor = sensors.find(s => s.id === selectedItem.id);
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
                          isTriggered ? "border-control-red text-control-red animate-pulse" : "border-control-green text-control-green"
                        }`}>
                          {isTriggered ? "DÉCLENCHÉ" : "OK"}
                        </span>
                      </div>
                      <p className="text-[10px] text-control-text/50 mt-1 uppercase">
                        Type: {sensor.type} • Zone: {zoneObj?.nom || "Zone"}
                      </p>

                      <div className="mt-3 text-[10px] text-control-text/80 space-y-1">
                        <div>État d'armement: {isArmed ? "ARMÉ" : "DÉSARMÉ"}</div>
                        <div>État d'intrusion: {isTriggered ? "ALERTE EN COURS" : "AUCUNE INTRUSION"}</div>
                      </div>
                      
                      {isTriggered && (
                        <div className="mt-3 bg-control-red/10 border border-control-red/30 p-2 text-control-red text-[10px] flex items-center gap-2 rounded">
                          <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
                          <span>INTRUSION ET COMPORTEMENT SUSPECT SUR SITE</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-control-border/40 flex flex-col gap-1.5">
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
                      <button
                        onClick={() => handleRemoveFromMap(sensor.id, "sensor")}
                        className="w-full py-2 border border-control-red/40 hover:bg-control-red/10 text-control-red font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Retirer de la carte</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // NESTING MAP LINK DETAILS
              if (selectedItem.type === "link") {
                const link = currentPlan.links.find(l => l.id === selectedItem.id);
                if (!link) return <p className="text-center italic text-control-text/40">Lien non trouvé</p>;
                const targetMap = plans.find(p => p.id === link.targetMapId);
                return (
                  <div className="space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-control-text-bright font-bold uppercase tracking-wider text-[11px]">
                        Lien de Plan Imbriqué
                      </h4>
                      <p className="text-[10px] text-control-text/60 mt-2 font-mono">
                        Cible : {targetMap?.name || "Plan Inconnu"}
                      </p>
                      
                      <div className="mt-3 text-[10px] text-control-text/50">
                        Coordonnées : X {Math.round(link.x)}% / Y {Math.round(link.y)}%
                      </div>
                    </div>

                    <div className="pt-3 border-t border-control-border/40 flex flex-col gap-1.5">
                      <button
                        onClick={() => {
                          setCurrentPlanId(link.targetMapId);
                          setSelectedItem(null);
                        }}
                        className="w-full py-2 border border-control-cyan bg-control-cyan/5 hover:bg-control-cyan/15 text-control-cyan font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Maximize2 className="h-4 w-4" />
                        <span>Aller au Plan</span>
                      </button>
                      <button
                        onClick={() => handleRemoveFromMap(link.id, "link")}
                        className="w-full py-2 border border-control-red/40 hover:bg-control-red/10 text-control-red font-bold tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Supprimer le Lien</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })()
          ) : (
            /* STANDBY STATE VIEW */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-control-border/50 bg-control-panel-light/10 rounded-xl">
              <Compass className="h-8 w-8 text-control-cyan/40 mb-2 animate-pulse-slow" />
              <p className="text-[10px] text-control-text-bright font-bold uppercase tracking-wider">
                Aucune Sélection
              </p>
              <p className="text-[9px] text-control-text/40 mt-1.5 leading-relaxed max-w-[200px]">
                Sélectionnez une icône sur le plan ou cliquez sur "Placer Équipements" pour configurer la disposition de votre synoptique de sécurité.
              </p>
            </div>
          )}
        </div>

        {/* Global overview status card */}
        <div className="mt-4 pt-3 border-t border-control-border/60 text-[9px] text-control-text/50">
          <div className="flex items-center justify-between">
            <span>ALARMES ACTIVES DU SITE :</span>
            <span className={`font-bold ${activeAlarms.length > 0 ? "text-control-red animate-pulse" : "text-control-green"}`}>
              {activeAlarms.length} EN COURS
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span>ÉQUIPEMENTS CONFIGURÉS :</span>
            <span>
              {Object.keys(currentPlan.equipmentPositions).length} / {cameras.length + doors.length + sensors.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
