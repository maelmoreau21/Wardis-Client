import React, { useEffect, useState, useRef } from "react";
import { useCameraStore } from "../store/cameraStore";
import { useAuthStore } from "../store/authStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { registerSpawnedWindow, saveCurrentLayout } from "../store/layoutManager";
import { getHlsBaseUrl } from "../store/config";
import { 
  LayoutGrid, 
  RefreshCw, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ShieldAlert,
  Settings,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Gamepad
} from "lucide-react";

// Standard Site Name Mapping
const SITE_NAMES: Record<string, string> = {
  "a0000000-0000-0000-0000-000000000001": "HQ Paris"
};

const getSiteName = (siteId?: string) => {
  if (!siteId) return "Unassigned Site";
  return SITE_NAMES[siteId] || `Site ${siteId.substring(0, 8)}`;
};

// ==========================================
// 1. CameraPlayer Component (WHEP WebRTC)
// ==========================================
interface CameraPlayerProps {
  cameraId: string;
  cameraNom: string;
  statut: string;
  isZoomed?: boolean;
  isSelected?: boolean;
  onClear: () => void;
  onDoubleClick?: () => void;
  onClick?: () => void;
}

const CameraPlayer: React.FC<CameraPlayerProps> = ({ 
  cameraId, 
  cameraNom, 
  statut, 
  isZoomed = false, 
  isSelected = false,
  onClear, 
  onDoubleClick,
  onClick
}) => {
  const [status, setStatus] = useState<"connecting" | "playing" | "error" | "no-signal">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const generateStreamToken = useCameraStore((state) => state.generateStreamToken);
  const configureWHEPStream = useCameraStore((state) => state.configureWHEPStream);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Sync highlight across screens/windows
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    const setupListen = async () => {
      try {
        unlistenFn = await listen<{ cameraId: string }>("camera-selected", (event) => {
          if (event.payload.cameraId === cameraId) {
            setIsHighlighted(true);
            setTimeout(() => setIsHighlighted(false), 4000);
          }
        });
      } catch (err) {
        console.error("Failed to setup camera-selected listener:", err);
      }
    };
    setupListen();
    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [cameraId]);

  const handleDetachStream = async () => {
    setShowConfig(false);
    const token = useAuthStore.getState().token;
    const label = `detached-cam-${cameraId}`;
    try {
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.setFocus();
      } else {
        registerSpawnedWindow({
          label,
          type: "camera",
          cameraId,
          cameraNom,
          statut
        });

        const webview = new WebviewWindow(label, {
          url: `index.html?detached=true&cameraId=${cameraId}&token=${encodeURIComponent(token || "")}&nom=${encodeURIComponent(cameraNom)}&statut=${statut}`,
          title: `Wardis Live - ${cameraNom}`,
          width: 800,
          height: 600,
        });

        webview.once("tauri://created", () => {
          webview.listen("tauri://move", () => {
            saveCurrentLayout();
          });
          webview.listen("tauri://resize", () => {
            saveCurrentLayout();
          });
          saveCurrentLayout();
        });

        webview.once("tauri://error", (e) => {
          console.error("Failed to create detached window", e);
        });
      }
    } catch (error) {
      console.error("Error managing detached window:", error);
    }
  };

  // Simulated metrics
  const [metrics, setMetrics] = useState({ fps: 30, bitrate: 2150, latency: 120 });

  useEffect(() => {
    // Generate slight variations in simulated telemetry
    const interval = setInterval(() => {
      setMetrics({
        fps: Math.floor(Math.random() * 3) + 29, // 29-31 fps
        bitrate: isZoomed 
          ? Math.floor(Math.random() * 800) + 6000 // 6000-6800 kbps for high-res
          : Math.floor(Math.random() * 300) + 2000, // 2000-2300 kbps for low-res
        latency: isZoomed
          ? Math.floor(Math.random() * 500) + 2500 // 2.5-3.0s latency for HLS
          : Math.floor(Math.random() * 20) + 110, // 110-130 ms latency for WHEP
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isZoomed]);

  // Load HLS.js script dynamically
  const loadHlsScript = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).Hls) {
        resolve((window as any).Hls);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js";
      script.onload = () => resolve((window as any).Hls);
      script.onerror = () => reject(new Error("Failed to load hls.js"));
      document.head.appendChild(script);
    });
  };

  useEffect(() => {
    if (statut !== "active") {
      setStatus("no-signal");
      setErrorMsg("Camera is configured as INACTIVE on the server.");
      return;
    }

    let active = true;
    let pc: RTCPeerConnection | null = null;
    let hlsInstance: any = null;
    let timeoutId: number | null = null;

    const startStream = async () => {
      try {
        setStatus("connecting");
        setErrorMsg(null);

        if (isZoomed) {
          // Play High-Resolution stream via HLS
          const token = await generateStreamToken(cameraId);
          if (!active) return;

          const hlsUrl = getHlsBaseUrl(cameraId, token);
          const Hls = await loadHlsScript();
          if (!active) return;

          if (videoRef.current) {
            if (Hls.isSupported()) {
              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
              });
              hlsInstance = hls;
              hls.loadSource(hlsUrl);
              hls.attachMedia(videoRef.current);
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (active) setStatus("playing");
              });
              hls.on(Hls.Events.ERROR, (_: any, data: any) => {
                if (!active) return;
                console.error("hls.js error:", data);
                if (data.fatal) {
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      hls.startLoad();
                      break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      hls.recoverMediaError();
                      break;
                    default:
                      setStatus("error");
                      setErrorMsg(`HLS Error: ${data.details}`);
                      break;
                  }
                }
              });
            } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
              // Safari native support
              videoRef.current.src = hlsUrl;
              videoRef.current.addEventListener("loadedmetadata", () => {
                if (active) setStatus("playing");
              });
              videoRef.current.addEventListener("error", () => {
                if (active) {
                  setStatus("error");
                  setErrorMsg("Native HLS Playback Error");
                }
              });
            } else {
              setStatus("error");
              setErrorMsg("HLS playback is not supported by this browser");
            }
          }
        } else {
          // Play Low-Resolution stream via WebRTC WHEP
          const whepUrl = await configureWHEPStream(cameraId);
          if (!active) return;

          pc = new RTCPeerConnection({
            iceServers: [] // Local MediaMTX works fine without stun
          });
          pcRef.current = pc;

          pc.addTransceiver("video", { direction: "recvonly" });
          try {
            pc.addTransceiver("audio", { direction: "recvonly" });
          } catch (_) {}

          pc.ontrack = (event) => {
            if (!active) return;
            console.log(`WebRTC WHEP track received for ${cameraNom}:`, event.track.kind);
            if (videoRef.current && event.streams && event.streams[0]) {
              videoRef.current.srcObject = event.streams[0];
              setStatus("playing");
            }
          };

          pc.onconnectionstatechange = () => {
            if (!active) return;
            const state = pc?.connectionState;
            console.log(`WebRTC Connection State for ${cameraNom}:`, state);
            if (state === "connected") {
              setStatus("playing");
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
            } else if (state === "failed" || state === "disconnected") {
              setStatus("no-signal");
              setErrorMsg("WebRTC Connection Lost / Failed");
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const response = await window.fetch(whepUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/sdp",
            },
            body: offer.sdp,
          });

          if (!response.ok) {
            throw new Error(`MediaMTX WHEP handshake failed: status ${response.status}`);
          }

          const answerSdp = await response.text();
          if (!active) return;

          await pc.setRemoteDescription(new RTCSessionDescription({
            type: "answer",
            sdp: answerSdp,
          }));

          timeoutId = window.setTimeout(() => {
            if (active && status !== "playing") {
              setStatus("no-signal");
              setErrorMsg("WebRTC Connection Timeout");
              cleanup();
            }
          }, 8000);
        }
      } catch (err: any) {
        console.error(`Playback failed for ${cameraNom}:`, err);
        if (active) {
          setStatus("error");
          setErrorMsg(err.message || "Failed to establish stream connection");
        }
      }
    };

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (pc) {
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
      if (hlsInstance) {
        hlsInstance.destroy();
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
      pcRef.current = null;
    };

    startStream();

    return () => {
      active = false;
      cleanup();
    };
  }, [cameraId, statut, retryTrigger, isZoomed]);

  const handleRetry = () => {
    setRetryTrigger(prev => prev + 1);
  };

  const sendPTZCommand = useCameraStore((state) => state.sendPTZCommand);

  const startPTZ = (pan: number, tilt: number, zoom: number) => {
    sendPTZCommand(cameraId, pan, tilt, zoom);
  };

  const stopPTZ = () => {
    sendPTZCommand(cameraId, 0, 0, 0);
  };

  return (
    <div 
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`relative w-full h-full bg-control-panel flex flex-col border rounded-xl overflow-hidden group select-none cursor-pointer transition-all ${
        isHighlighted
          ? "border-control-cyan ring-2 ring-control-cyan shadow-[0_0_20px_rgba(0,240,255,0.6)] scale-[1.01] z-20"
          : isSelected 
            ? "border-control-cyan shadow-[0_0_15px_rgba(99,102,241,0.25)] z-10" 
            : "border-control-border hover:border-control-cyan/45"
      }`}
    >
      
      {/* Top overlay panel */}
      <div 
        onDoubleClick={(e) => e.stopPropagation()}
        className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-control-bg/90 to-transparent p-2 flex items-center justify-between text-[9px] font-mono select-none"
      >
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${
            status === "playing" ? "bg-control-green animate-pulse" :
            status === "connecting" ? "bg-control-amber animate-pulse" : "bg-control-red"
          }`} />
          <span className="text-control-text-bright tracking-wider uppercase font-bold">
            CAM // {cameraNom}
          </span>
        </div>
        
        {/* Stream Actions */}
        <div className="flex items-center gap-2">
          {status === "playing" && (
            <div className="hidden sm:flex items-center gap-3 text-control-cyan/70 font-mono">
              <span>{metrics.fps} FPS</span>
              <span>{metrics.bitrate} KB/S</span>
              <span>{metrics.latency}MS</span>
            </div>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); handleDetachStream(); }}
            className="p-1 hover:bg-control-cyan/10 border border-transparent hover:border-control-cyan/20 text-control-text hover:text-control-cyan transition-all"
            title="Détacher le flux"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="p-1 hover:bg-control-cyan/10 border border-transparent hover:border-control-cyan/20 text-control-text hover:text-control-cyan transition-all"
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Settings Panel Overlay */}
      {showConfig && (
        <div 
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute inset-0 bg-control-bg/95 z-20 flex flex-col items-center justify-center p-4 text-center font-mono"
        >
          <p className="text-xs text-control-text-bright font-bold uppercase tracking-widest mb-3">Camera Actions</p>
          <div className="flex flex-col gap-2 w-full max-w-[160px]">
            <button
              onClick={() => { handleRetry(); setShowConfig(false); }}
              className="py-1.5 border border-control-cyan/50 hover:bg-control-cyan/10 text-control-cyan text-[10px] uppercase font-bold tracking-wider"
            >
              Force Reconnect
            </button>
            <button
              onClick={handleDetachStream}
              className="py-1.5 border border-control-cyan/50 hover:bg-control-cyan/10 text-control-cyan text-[10px] uppercase font-bold tracking-wider flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="h-3 w-3" />
              Détacher le flux
            </button>
            <button
              onClick={() => { onClear(); setShowConfig(false); }}
              className="py-1.5 border border-control-red/50 hover:bg-control-red/10 text-control-red text-[10px] uppercase font-bold tracking-wider flex items-center justify-center gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Disconnect Slot
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="py-1 border border-control-border hover:bg-control-panel-light text-control-text text-[10px] uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Stream Area */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center bg-black">
        {status === "playing" ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Stream Type & REC tags */}
            <div 
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute top-8 right-2 flex gap-1.5 z-10 select-none"
            >
              <div className={`border text-[8px] font-mono font-bold px-1.5 py-0.5 flex items-center gap-1 ${
                isZoomed 
                  ? "bg-control-cyan/15 border-control-cyan text-control-cyan" 
                  : "bg-control-amber/15 border-control-amber text-control-amber"
              }`}>
                <span>{isZoomed ? "HIGH-RES HLS" : "LOW-RES WHEP"}</span>
              </div>
              <div className="bg-control-red/15 border border-control-red text-control-red text-[8px] font-mono font-bold px-1.5 py-0.5 animate-pulse flex items-center gap-1">
                <span className="h-1 w-1 bg-control-red rounded-full animate-ping" />
                <span>LIVE</span>
              </div>
            </div>
            
            {/* Floating PTZ overlay controls */}
            {isSelected && (
              <div 
                onDoubleClick={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-4 right-4 z-10 bg-control-bg/90 border border-control-cyan/40 p-2 flex flex-col items-center gap-1.5 backdrop-blur-xs select-none shadow-[0_0_10px_rgba(0,0,0,0.8)]"
              >
                <div className="text-[7px] text-control-cyan/80 uppercase font-mono font-bold tracking-widest mb-1 border-b border-control-border/40 pb-0.5 w-full text-center">PTZ OVERLAY</div>
                
                {/* D-Pad Grid */}
                <div className="grid grid-cols-3 gap-1">
                  <div />
                  <button
                    onMouseDown={() => startPTZ(0, 1, 0)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    onTouchStart={() => startPTZ(0, 1, 0)}
                    onTouchEnd={stopPTZ}
                    className="p-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all cursor-pointer"
                    title="Haut"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <div />

                  <button
                    onMouseDown={() => startPTZ(-1, 0, 0)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    onTouchStart={() => startPTZ(-1, 0, 0)}
                    onTouchEnd={stopPTZ}
                    className="p-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all cursor-pointer"
                    title="Gauche"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <div className="w-5 h-5 border border-dashed border-control-border/30 flex items-center justify-center text-[6px] text-control-text/30 font-mono">
                    PAD
                  </div>
                  <button
                    onMouseDown={() => startPTZ(1, 0, 0)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    onTouchStart={() => startPTZ(1, 0, 0)}
                    onTouchEnd={stopPTZ}
                    className="p-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all cursor-pointer"
                    title="Droite"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>

                  <div />
                  <button
                    onMouseDown={() => startPTZ(0, -1, 0)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    onTouchStart={() => startPTZ(0, -1, 0)}
                    onTouchEnd={stopPTZ}
                    className="p-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all cursor-pointer"
                    title="Bas"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div />
                </div>

                {/* Zoom Controls */}
                <div className="flex gap-1 border-t border-control-border/40 pt-1.5 w-full justify-center">
                  <button
                    onMouseDown={() => startPTZ(0, 0, 1)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    onTouchStart={() => startPTZ(0, 0, 1)}
                    onTouchEnd={stopPTZ}
                    className="p-0.5 px-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all flex items-center gap-0.5 text-[7px] cursor-pointer"
                    title="Zoom+"
                  >
                    <ZoomIn className="h-2.5 w-2.5" />
                    <span>Z+</span>
                  </button>
                  <button
                    onMouseDown={() => startPTZ(0, 0, -1)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    onTouchStart={() => startPTZ(0, 0, -1)}
                    onTouchEnd={stopPTZ}
                    className="p-0.5 px-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all flex items-center gap-0.5 text-[7px] cursor-pointer"
                    title="Zoom-"
                  >
                    <ZoomOut className="h-2.5 w-2.5" />
                    <span>Z-</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* CRT Grid scanlines effect */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-control-bg/30 pointer-events-none opacity-20" />
          </>
        ) : status === "connecting" ? (
          <div className="flex flex-col items-center justify-center gap-3 p-4 select-none">
            <div className="h-6 w-6 border-2 border-control-cyan border-t-transparent rounded-full animate-spin" />
            <div className="text-[10px] text-control-cyan uppercase tracking-widest font-mono font-semibold animate-pulse text-center">
              {isZoomed ? "Negotiating HLS Feed..." : "Negotiating WHEP Feed..."}
            </div>
          </div>
        ) : (
          /* Error or No Signal Placeholder */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-control-panel-light/40 diagonal-stripes select-none text-center">
            <div className="p-2 bg-control-red/10 border border-control-red/30 text-control-red mb-2">
              <ShieldAlert className="h-6 w-6 animate-pulse" />
            </div>
            <div className="text-xs text-control-text-bright font-bold tracking-widest uppercase font-mono">
              Signal Lost // Feed Offline
            </div>
            {errorMsg && (
              <div className="text-[8px] text-control-red font-mono mt-1 max-w-[200px] break-words opacity-80 leading-relaxed uppercase">
                {errorMsg}
              </div>
            )}
            <button
              onClick={handleRetry}
              className="mt-3 flex items-center gap-1.5 px-3 py-1 border border-control-cyan/40 bg-control-cyan/5 hover:bg-control-cyan/15 text-control-cyan text-[9px] font-mono uppercase tracking-widest transition-all cursor-pointer"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              <span>Retry Link</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );;
};

// ==========================================
// 2. Main LiveView Component
// ==========================================
export const LiveView: React.FC = () => {
  const { cameras, loading, error, fetchCameras } = useCameraStore();
  const [layoutSize, setLayoutSize] = useState<1 | 4 | 9 | 16>(4);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  
  // Track selected camera IDs in slots 0 to 15
  const [slotAssignments, setSlotAssignments] = useState<(string | null)[]>(Array(16).fill(null));
  
  // Track which slot is currently opening its camera selection picker
  const [activePickerSlot, setActivePickerSlot] = useState<number | null>(null);

  // Track the zoomed slot index for high-res stream view
  const [zoomedSlotIndex, setZoomedSlotIndex] = useState<number | null>(null);

  // Track selected camera slot index for PTZ focus
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Gamepad / Joystick connection states
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  // Joystick real-time telemetry coordinates
  const [joystickTelemetry, setJoystickTelemetry] = useState({ pan: 0, tilt: 0, zoom: 0 });
  const telemetryRef = useRef({ pan: 0, tilt: 0, zoom: 0 });

  const sendPTZCommand = useCameraStore((state) => state.sendPTZCommand);

  // Helper to resolve currently active camera in the workspace
  const getActiveCameraId = (): string | null => {
    if (zoomedSlotIndex !== null) {
      return slotAssignments[zoomedSlotIndex];
    }
    if (selectedSlotIndex !== null) {
      return slotAssignments[selectedSlotIndex];
    }
    const firstActiveIdx = slotAssignments.findIndex((id) => id !== null);
    return firstActiveIdx !== -1 ? slotAssignments[firstActiveIdx] : null;
  };

  const getActiveSlotIndex = (): number | null => {
    if (zoomedSlotIndex !== null) {
      return zoomedSlotIndex;
    }
    if (selectedSlotIndex !== null) {
      return selectedSlotIndex;
    }
    const firstActiveIdx = slotAssignments.findIndex((id) => id !== null);
    return firstActiveIdx !== -1 ? firstActiveIdx : null;
  };

  const activeCameraId = getActiveCameraId();
  const activeCamera = cameras.find((c) => c.id === activeCameraId);

  const startPTZ = (pan: number, tilt: number, zoom: number) => {
    if (activeCameraId) {
      sendPTZCommand(activeCameraId, pan, tilt, zoom);
    }
  };

  const stopPTZ = () => {
    if (activeCameraId) {
      sendPTZCommand(activeCameraId, 0, 0, 0);
    }
  };

  // Gamepad Connection Listeners
  useEffect(() => {
    const handleConnect = (e: GamepadEvent) => {
      console.log("Gamepad connected:", e.gamepad);
      setIsGamepadConnected(true);
      setGamepadName(e.gamepad.id);
    };
    const handleDisconnect = (e: GamepadEvent) => {
      console.log("Gamepad disconnected:", e.gamepad);
      setIsGamepadConnected(false);
      setGamepadName(null);
    };

    window.addEventListener("gamepadconnected", handleConnect);
    window.addEventListener("gamepaddisconnected", handleDisconnect);

    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedGp = gps.find(g => g !== null);
    if (connectedGp) {
      setIsGamepadConnected(true);
      setGamepadName(connectedGp.id);
    }

    return () => {
      window.removeEventListener("gamepadconnected", handleConnect);
      window.removeEventListener("gamepaddisconnected", handleDisconnect);
    };
  }, []);

  // Gamepad requestAnimationFrame Polling Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastSentPan = 0;
    let lastSentTilt = 0;
    let lastSentZoom = 0;
    let lastCommandTime = 0;
    const THROTTLE_MS = 150;

    const checkGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let activeGamepad = null;

      for (const gp of gamepads) {
        if (gp) {
          activeGamepad = gp;
          break;
        }
      }

      if (activeGamepad) {
        let panVal = activeGamepad.axes[0] || 0;
        let tiltVal = activeGamepad.axes[1] || 0;

        const DEADZONE = 0.15;
        if (Math.abs(panVal) < DEADZONE) panVal = 0;
        if (Math.abs(tiltVal) < DEADZONE) tiltVal = 0;

        let mappedTilt = -tiltVal; // invert Gamepad vertical axis to positive-up ONVIF standard
        let mappedPan = panVal;

        let zoomInPressed = false;
        let zoomOutPressed = false;

        if (activeGamepad.buttons[0]?.pressed || activeGamepad.buttons[5]?.pressed) {
          zoomInPressed = true;
        }
        if (activeGamepad.buttons[1]?.pressed || activeGamepad.buttons[4]?.pressed) {
          zoomOutPressed = true;
        }

        let zoomVal = 0;
        if (zoomInPressed) {
          zoomVal = 1;
        } else if (zoomOutPressed) {
          zoomVal = -1;
        } else {
          const zoomAxisVal = activeGamepad.axes[2] || 0;
          if (Math.abs(zoomAxisVal) > DEADZONE) {
            zoomVal = zoomAxisVal;
          }
        }

        const pan = Math.round(mappedPan * 100) / 100;
        const tilt = Math.round(mappedTilt * 100) / 100;
        const zoom = Math.round(zoomVal * 100) / 100;

        if (pan !== telemetryRef.current.pan || 
            tilt !== telemetryRef.current.tilt || 
            zoom !== telemetryRef.current.zoom) {
          telemetryRef.current = { pan, tilt, zoom };
          setJoystickTelemetry({ pan, tilt, zoom });
        }

        const now = Date.now();
        const hasChanged = pan !== lastSentPan || tilt !== lastSentTilt || zoom !== lastSentZoom;
        const isThrottled = now - lastCommandTime < THROTTLE_MS;

        if (hasChanged || ((pan !== 0 || tilt !== 0 || zoom !== 0) && !isThrottled)) {
          const currentCamId = getActiveCameraId();
          if (currentCamId) {
            if (hasChanged || !isThrottled) {
              sendPTZCommand(currentCamId, pan, tilt, zoom);
              lastSentPan = pan;
              lastSentTilt = tilt;
              lastSentZoom = zoom;
              lastCommandTime = now;
            }
          }
        }
      } else {
        if (telemetryRef.current.pan !== 0 || telemetryRef.current.tilt !== 0 || telemetryRef.current.zoom !== 0) {
          telemetryRef.current = { pan: 0, tilt: 0, zoom: 0 };
          setJoystickTelemetry({ pan: 0, tilt: 0, zoom: 0 });
        }
      }

      animationFrameId = requestAnimationFrame(checkGamepad);
    };

    animationFrameId = requestAnimationFrame(checkGamepad);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [slotAssignments, selectedSlotIndex, zoomedSlotIndex]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  // Extract unique site IDs
  const uniqueSites = Array.from(
    new Set(cameras.map((c) => c.site_id).filter(Boolean))
  ) as string[];

  // Filter cameras matching selected site
  const filteredCameras = selectedSite
    ? cameras.filter((c) => c.site_id === selectedSite)
    : cameras;

  // Auto-fill slots when layout or site selection changes
  useEffect(() => {
    if (loading || cameras.length === 0) return;
    
    // Auto populate the slots with first available cameras
    const newAssignments = Array(16).fill(null);
    for (let i = 0; i < layoutSize; i++) {
      if (filteredCameras[i]) {
        newAssignments[i] = filteredCameras[i].id;
      }
    }
    setSlotAssignments(newAssignments);
  }, [layoutSize, selectedSite, cameras, loading]);

  const handleAssignCamera = (slotIndex: number, cameraId: string | null) => {
    setSlotAssignments((prev) => {
      const next = [...prev];
      next[slotIndex] = cameraId;
      return next;
    });
    setActivePickerSlot(null);
  };

  const handleClearSlot = (slotIndex: number) => {
    setSlotAssignments((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  };

  // Grid styling utility
  const getGridColsClass = () => {
    switch (layoutSize) {
      case 1:
        return "grid-cols-1";
      case 4:
        return "grid-cols-2";
      case 9:
        return "grid-cols-3";
      case 16:
        return "grid-cols-4";
      default:
        return "grid-cols-2";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-control-panel/20 border border-control-border relative p-4 gap-4 select-none">
      
      {/* Control panel header bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between bg-control-panel/80 p-3 border border-control-border gap-4 select-none shrink-0 font-mono z-20">
        
        {/* Site Filter Button List */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-control-text/60 uppercase tracking-widest font-bold pr-1">Filter Site:</span>
          <button
            onClick={() => setSelectedSite(null)}
            className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer border ${
              selectedSite === null
                ? "border-control-cyan bg-control-cyan/10 text-control-cyan"
                : "border-control-border text-control-text hover:text-control-text-bright hover:bg-control-panel-light"
            }`}
          >
            All Sites ({cameras.length})
          </button>
          {uniqueSites.map((siteId) => {
            const count = cameras.filter((c) => c.site_id === siteId).length;
            return (
              <button
                key={siteId}
                onClick={() => setSelectedSite(siteId)}
                className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer border ${
                  selectedSite === siteId
                    ? "border-control-cyan bg-control-cyan/10 text-control-cyan"
                    : "border-control-border text-control-text hover:text-control-text-bright hover:bg-control-panel-light"
                }`}
              >
                {getSiteName(siteId)} ({count})
              </button>
            );
          })}
        </div>

        {/* Layout Grid Configurations */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-control-text/60 uppercase tracking-widest font-bold pr-1">Grid Size:</span>
          {([1, 4, 9, 16] as const).map((size) => (
            <button
              key={size}
              onClick={() => {
                setLayoutSize(size);
                setActivePickerSlot(null);
                setZoomedSlotIndex(null);
              }}
              className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer border flex items-center gap-1.5 ${
                layoutSize === size
                  ? "border-control-cyan bg-control-cyan/10 text-control-cyan"
                  : "border-control-border text-control-text hover:text-control-text-bright hover:bg-control-panel-light"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{size} CAM</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 border-2 border-control-cyan border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-control-cyan uppercase font-mono tracking-widest font-bold animate-pulse">
            Syncing Active Cameras...
          </p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 border border-control-red/20 bg-control-red/5">
          <AlertTriangle className="h-10 w-10 text-control-red mb-3 animate-pulse" />
          <p className="text-xs font-mono uppercase text-control-red font-bold tracking-widest">
            Gateway Stream Synchronization Error
          </p>
          <p className="text-[10px] text-control-text mt-1 uppercase font-mono">
            {error}
          </p>
          <button
            onClick={() => fetchCameras()}
            className="mt-4 px-4 py-2 border border-control-cyan bg-control-cyan/5 hover:bg-control-cyan/15 text-control-cyan font-mono text-[10px] uppercase tracking-wider cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 relative">
          
          {/* Grid View wrapper */}
          <div className="flex-1 min-h-0 relative flex flex-col">
            {zoomedSlotIndex !== null ? (() => {
              const assignedCamId = slotAssignments[zoomedSlotIndex];
              const camera = cameras.find((c) => c.id === assignedCamId);
              if (assignedCamId && camera) {
                return (
                  <div className="flex-1 min-h-0 grid grid-cols-1">
                    <CameraPlayer
                      key={`zoomed-${zoomedSlotIndex}-${assignedCamId}`}
                      cameraId={assignedCamId}
                      cameraNom={camera.nom}
                      statut={camera.statut}
                      isZoomed={true}
                      isSelected={true}
                      onClear={() => {
                        handleClearSlot(zoomedSlotIndex);
                        setZoomedSlotIndex(null);
                      }}
                      onDoubleClick={() => setZoomedSlotIndex(null)}
                    />
                  </div>
                );
              }
              setZoomedSlotIndex(null);
              return null;
            })() : (
              <div className={`flex-1 min-h-0 grid ${getGridColsClass()} gap-3`}>
                {Array.from({ length: layoutSize }).map((_, idx) => {
                  const assignedCamId = slotAssignments[idx];
                  const camera = cameras.find((c) => c.id === assignedCamId);

                  if (assignedCamId && camera) {
                    const isSelected = getActiveSlotIndex() === idx;
                    return (
                      <CameraPlayer
                        key={`${idx}-${assignedCamId}`}
                        cameraId={assignedCamId}
                        cameraNom={camera.nom}
                        statut={camera.statut}
                        isZoomed={false}
                        isSelected={isSelected}
                        onClick={() => setSelectedSlotIndex(idx)}
                        onClear={() => handleClearSlot(idx)}
                        onDoubleClick={() => setZoomedSlotIndex(idx)}
                      />
                    );
                  }

                  // Empty slot state
                  const isSelected = getActiveSlotIndex() === idx;
                  return (
                    <div 
                      key={`empty-${idx}`}
                      onClick={() => setSelectedSlotIndex(idx)}
                      className={`relative w-full h-full bg-control-panel/40 border transition-all flex flex-col items-center justify-center p-4 text-center select-none font-mono ${
                        isSelected 
                          ? "border-control-cyan shadow-[0_0_15px_rgba(0,240,255,0.4)] z-10" 
                          : "border-dashed border-control-border hover:border-control-cyan/40"
                      }`}
                    >
                  {activePickerSlot === idx ? (
                    /* Camera Selector Overlay inside the slot */
                    <div className="absolute inset-0 bg-control-bg/95 z-10 flex flex-col p-3 text-left overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-control-border pb-1.5 mb-2 shrink-0">
                        <span className="text-[10px] text-control-text-bright font-bold uppercase tracking-wider">
                          Select Cam For Slot {idx + 1}
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActivePickerSlot(null); }}
                          className="text-[9px] text-control-red hover:underline uppercase"
                        >
                          Close
                        </button>
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        {filteredCameras.length === 0 ? (
                          <p className="text-[9px] text-control-text/50 uppercase italic p-2">
                            No cameras available for this filter.
                          </p>
                        ) : (
                          filteredCameras.map((cam) => {
                            const isAssigned = slotAssignments.includes(cam.id);
                            return (
                              <button
                                key={cam.id}
                                disabled={isAssigned}
                                onClick={(e) => { e.stopPropagation(); handleAssignCamera(idx, cam.id); }}
                                className={`w-full text-left px-2 py-1.5 text-[10px] border flex items-center justify-between transition-all ${
                                  isAssigned 
                                    ? "border-transparent bg-control-panel-light/30 text-control-text/40 cursor-not-allowed" 
                                    : "border-control-border bg-control-panel hover:bg-control-cyan/5 hover:border-control-cyan/35 text-control-text hover:text-control-text-bright cursor-pointer"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className={`h-1.5 w-1.5 rounded-full ${cam.statut === "active" ? "bg-control-green" : "bg-control-red"}`} />
                                  <span className="truncate">{cam.nom}</span>
                                </div>
                                <span className="text-[8px] text-control-text/40 shrink-0">
                                  {isAssigned ? "USED" : cam.statut.toUpperCase()}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Default Empty Placeholder */
                    <>
                      <div className="absolute inset-0 bg-radial-gradient from-transparent to-control-bg/60 opacity-30 pointer-events-none" />
                      
                      <div className="z-10 flex flex-col items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActivePickerSlot(idx); }}
                          className="p-3 border border-control-border bg-control-panel-light text-control-cyan/40 hover:text-control-cyan hover:border-control-cyan/50 hover:shadow-md transition-all cursor-pointer rounded-xl"
                        >
                          <Plus className="h-6 w-6" />
                        </button>
                        <div>
                          <div className="text-[10px] text-control-text-bright font-bold uppercase tracking-widest">
                            SLOT {idx + 1} EMPTY
                          </div>
                          <p className="text-[8px] text-control-text/60 mt-1 max-w-[160px] leading-relaxed uppercase">
                            Click "+" to bind a camera to this viewport.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

        {/* PTZ Lateral Sidebar Panel */}
        <div className="w-full lg:w-72 bg-control-panel border border-control-border rounded-xl p-4 font-mono select-none flex flex-col shrink-0 gap-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-control-border pb-2">
            <span className="text-xs text-control-text-bright font-bold uppercase tracking-wider">PTZ Camera Control</span>
            <span className="h-1.5 w-1.5 rounded-full bg-control-cyan animate-pulse" />
          </div>

          {activeCamera ? (
            <div className="flex flex-col gap-1 text-[10px] bg-control-panel-light/40 border border-control-border p-2">
              <div className="text-control-cyan font-bold uppercase truncate">
                CAM // {activeCamera.nom}
              </div>
              <div className="text-control-text/60 text-[8px] truncate">
                ID: {activeCamera.id}
              </div>
              <div className="text-control-text/60 text-[8px] truncate">
                STREAM: {activeCamera.main_stream_url ? "WHEP/HLS SYNCED" : "OFFLINE"}
              </div>
              <div className="text-control-text/60 text-[8px]">
                STATUS: <span className="text-control-green font-bold uppercase">{activeCamera.statut}</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-control-text/40 italic bg-control-panel-light/20 border border-dashed border-control-border/60 p-3 text-center">
              No camera active in selected slot.
            </div>
          )}

          {/* D-Pad controls */}
          <div className="flex flex-col items-center gap-3 border-t border-b border-control-border/50 py-4">
            <span className="text-[9px] text-control-text/60 uppercase font-bold tracking-widest">Directional Move</span>
            <div className="grid grid-cols-3 gap-2 w-36 h-36">
              <div />
              <button
                disabled={!activeCameraId}
                onMouseDown={() => activeCameraId && startPTZ(0, 1, 0)}
                onMouseUp={stopPTZ}
                onMouseLeave={stopPTZ}
                onTouchStart={() => activeCameraId && startPTZ(0, 1, 0)}
                onTouchEnd={stopPTZ}
                className={`border flex items-center justify-center transition-all ${
                  activeCameraId
                    ? "border-control-border bg-control-panel-light text-control-text-bright hover:border-control-cyan/50 hover:bg-control-cyan/10 active:bg-control-cyan/20 cursor-pointer"
                    : "border-control-border/20 text-control-text/20 cursor-not-allowed"
                }`}
                title="UP (Haut)"
              >
                <ChevronUp className="h-6 w-6" />
              </button>
              <div />

              <button
                disabled={!activeCameraId}
                onMouseDown={() => activeCameraId && startPTZ(-1, 0, 0)}
                onMouseUp={stopPTZ}
                onMouseLeave={stopPTZ}
                onTouchStart={() => activeCameraId && startPTZ(-1, 0, 0)}
                onTouchEnd={stopPTZ}
                className={`border flex items-center justify-center transition-all ${
                  activeCameraId
                    ? "border-control-border bg-control-panel-light text-control-text-bright hover:border-control-cyan/50 hover:bg-control-cyan/10 active:bg-control-cyan/20 cursor-pointer"
                    : "border-control-border/20 text-control-text/20 cursor-not-allowed"
                }`}
                title="LEFT (Gauche)"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              
              <button
                disabled={!activeCameraId}
                onClick={stopPTZ}
                className={`border flex items-center justify-center text-[9px] font-bold uppercase transition-all ${
                  activeCameraId
                    ? "border-control-red/40 bg-control-red/5 text-control-red hover:bg-control-red/15 hover:border-control-red cursor-pointer"
                    : "border-control-border/20 text-control-text/20 cursor-not-allowed"
                }`}
                title="STOP"
              >
                STOP
              </button>

              <button
                disabled={!activeCameraId}
                onMouseDown={() => activeCameraId && startPTZ(1, 0, 0)}
                onMouseUp={stopPTZ}
                onMouseLeave={stopPTZ}
                onTouchStart={() => activeCameraId && startPTZ(1, 0, 0)}
                onTouchEnd={stopPTZ}
                className={`border flex items-center justify-center transition-all ${
                  activeCameraId
                    ? "border-control-border bg-control-panel-light text-control-text-bright hover:border-control-cyan/50 hover:bg-control-cyan/10 active:bg-control-cyan/20 cursor-pointer"
                    : "border-control-border/20 text-control-text/20 cursor-not-allowed"
                }`}
                title="RIGHT (Droite)"
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              <div />
              <button
                disabled={!activeCameraId}
                onMouseDown={() => activeCameraId && startPTZ(0, -1, 0)}
                onMouseUp={stopPTZ}
                onMouseLeave={stopPTZ}
                onTouchStart={() => activeCameraId && startPTZ(0, -1, 0)}
                onTouchEnd={stopPTZ}
                className={`border flex items-center justify-center transition-all ${
                  activeCameraId
                    ? "border-control-border bg-control-panel-light text-control-text-bright hover:border-control-cyan/50 hover:bg-control-cyan/10 active:bg-control-cyan/20 cursor-pointer"
                    : "border-control-border/20 text-control-text/20 cursor-not-allowed"
                }`}
                title="DOWN (Bas)"
              >
                <ChevronDown className="h-6 w-6" />
              </button>
              <div />
            </div>
          </div>

          {/* Zoom controls */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[9px] text-control-text/60 uppercase font-bold tracking-widest">Zoom Control</span>
            <div className="flex gap-2 w-full">
              <button
                disabled={!activeCameraId}
                onMouseDown={() => activeCameraId && startPTZ(0, 0, 1)}
                onMouseUp={stopPTZ}
                onMouseLeave={stopPTZ}
                onTouchStart={() => activeCameraId && startPTZ(0, 0, 1)}
                onTouchEnd={stopPTZ}
                className={`flex-1 py-2 border flex items-center justify-center gap-1.5 text-xs font-bold uppercase transition-all ${
                  activeCameraId
                    ? "border-control-border bg-control-panel-light text-control-text-bright hover:border-control-cyan/50 hover:bg-control-cyan/10 active:bg-control-cyan/20 cursor-pointer"
                    : "border-control-border/20 text-control-text/20 cursor-not-allowed"
                }`}
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
                <span>Zoom +</span>
              </button>
              
              <button
                disabled={!activeCameraId}
                onMouseDown={() => activeCameraId && startPTZ(0, 0, -1)}
                onMouseUp={stopPTZ}
                onMouseLeave={stopPTZ}
                onTouchStart={() => activeCameraId && startPTZ(0, 0, -1)}
                onTouchEnd={stopPTZ}
                className={`flex-1 py-2 border flex items-center justify-center gap-1.5 text-xs font-bold uppercase transition-all ${
                  activeCameraId
                    ? "border-control-border bg-control-panel-light text-control-text-bright hover:border-control-cyan/50 hover:bg-control-cyan/10 active:bg-control-cyan/20 cursor-pointer"
                    : "border-control-border/20 text-control-text/20 cursor-not-allowed"
                }`}
                title="Zoom -"
              >
                <ZoomOut className="h-4 w-4" />
                <span>Zoom -</span>
              </button>
            </div>
          </div>

          {/* Gamepad telemetry */}
          <div className="border-t border-control-border/50 pt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[9px] text-control-text/60 uppercase font-bold tracking-widest">
              <span className="flex items-center gap-1.5">
                <Gamepad className="h-3.5 w-3.5" />
                <span>USB PTZ Joystick</span>
              </span>
              <span className={`h-1.5 w-1.5 rounded-full ${isGamepadConnected ? "bg-control-green animate-pulse" : "bg-control-text/30"}`} />
            </div>
            
            <div className="bg-control-bg/60 border border-control-border p-2 text-[9px] flex flex-col gap-1.5 font-mono">
              <div className="flex justify-between items-center text-control-text/50">
                <span>STATUS:</span>
                <span className={`font-bold ${isGamepadConnected ? "text-control-green" : "text-control-text/40"}`}>
                  {isGamepadConnected ? "CONNECTED" : "DISCONNECTED"}
                </span>
              </div>
              {isGamepadConnected && (
                <>
                  <div className="text-[8px] text-control-cyan truncate uppercase leading-none">
                    DEVICE: {gamepadName}
                  </div>
                  <div className="border-t border-control-border/40 my-1" />
                  <div className="flex justify-between text-[8px] leading-none">
                    <span className="text-control-text/50">PAN AXIS:</span>
                    <span className="text-control-text-bright font-bold">{joystickTelemetry.pan.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[8px] leading-none">
                    <span className="text-control-text/50">TILT AXIS:</span>
                    <span className="text-control-text-bright font-bold">{joystickTelemetry.tilt.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[8px] leading-none">
                    <span className="text-control-text/50">ZOOM AXIS:</span>
                    <span className="text-control-text-bright font-bold">{joystickTelemetry.zoom.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};
