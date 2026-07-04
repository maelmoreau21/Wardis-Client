import React, { useEffect, useState, useRef } from "react";
import { useCameraStore } from "../store/cameraStore";
import { useAuthStore } from "../store/authStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { 
  LayoutGrid, 
  RefreshCw, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ShieldAlert,
  Settings,
  ExternalLink
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
  onClear: () => void;
}

const CameraPlayer: React.FC<CameraPlayerProps> = ({ cameraId, cameraNom, statut, onClear }) => {
  const [status, setStatus] = useState<"connecting" | "playing" | "error" | "no-signal">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const generateStreamToken = useCameraStore((state) => state.generateStreamToken);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const handleDetachStream = async () => {
    setShowConfig(false);
    const token = useAuthStore.getState().token;
    const label = `detached-cam-${cameraId}`;
    try {
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.setFocus();
      } else {
        const webview = new WebviewWindow(label, {
          url: `index.html?detached=true&cameraId=${cameraId}&token=${encodeURIComponent(token || "")}&nom=${encodeURIComponent(cameraNom)}&statut=${statut}`,
          title: `Wardis Live - ${cameraNom}`,
          width: 800,
          height: 600,
        });
        webview.once("tauri://created", () => {
          console.log("Detached window created successfully");
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
        bitrate: Math.floor(Math.random() * 300) + 2000, // 2000-2300 kbps
        latency: Math.floor(Math.random() * 20) + 110, // 110-130 ms
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (statut !== "active") {
      setStatus("no-signal");
      setErrorMsg("Camera is configured as INACTIVE on the server.");
      return;
    }

    let active = true;
    let pc: RTCPeerConnection | null = null;
    let timeoutId: number | null = null;

    const startStream = async () => {
      try {
        setStatus("connecting");
        setErrorMsg(null);

        // 1. Fetch WHEP JWT Token from server API
        const token = await generateStreamToken(cameraId);
        if (!active) return;

        // 2. Setup RTCPeerConnection
        pc = new RTCPeerConnection({
          iceServers: [] // Local MediaMTX works fine without stun
        });
        pcRef.current = pc;

        // 3. Add video and audio transceivers (recvonly)
        pc.addTransceiver("video", { direction: "recvonly" });
        try {
          pc.addTransceiver("audio", { direction: "recvonly" });
        } catch (_) {}

        // 4. Handle track connection
        pc.ontrack = (event) => {
          if (!active) return;
          console.log(`WebRTC WHEP track received for ${cameraNom}:`, event.track.kind);
          if (videoRef.current && event.streams && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setStatus("playing");
          }
        };

        // 5. Track state changes
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

        // 6. Create SDP Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 7. Post SDP Offer to WHEP endpoint on MediaMTX (port 8889)
        const whepUrl = `http://localhost:8889/${cameraId}/whep?token=${token}`;
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

        // 8. Apply Answer
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: "answer",
          sdp: answerSdp,
        }));

        // Connection Timeout (8s)
        timeoutId = window.setTimeout(() => {
          if (active && status !== "playing") {
            setStatus("no-signal");
            setErrorMsg("WebRTC Connection Timeout");
            cleanup();
          }
        }, 8000);

      } catch (err: any) {
        console.error(`WebRTC WHEP playback failed for ${cameraNom}:`, err);
        if (active) {
          setStatus("error");
          setErrorMsg(err.message || "Failed to establish WebRTC handshake");
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
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      pcRef.current = null;
    };

    startStream();

    return () => {
      active = false;
      cleanup();
    };
  }, [cameraId, statut, retryTrigger]);

  const handleRetry = () => {
    setRetryTrigger(prev => prev + 1);
  };

  return (
    <div className="relative w-full h-full bg-control-panel flex flex-col border border-control-border brackets overflow-hidden group">
      
      {/* Top overlay panel */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-control-bg/90 to-transparent p-2 flex items-center justify-between text-[9px] font-mono select-none">
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
            <div className="hidden sm:flex items-center gap-3 text-control-cyan/70">
              <span>{metrics.fps} FPS</span>
              <span>{metrics.bitrate} KB/S</span>
              <span>{metrics.latency}MS</span>
            </div>
          )}
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
        <div className="absolute inset-0 bg-control-bg/95 z-20 flex flex-col items-center justify-center p-4 text-center font-mono">
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
            {/* Blinking REC tag */}
            <div className="absolute top-8 right-2 bg-control-red/15 border border-control-red text-control-red text-[8px] font-mono font-bold px-1.5 py-0.5 animate-pulse flex items-center gap-1">
              <span className="h-1 w-1 bg-control-red rounded-full animate-ping" />
              <span>LIVE</span>
            </div>
            
            {/* CRT Grid scanlines effect */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-control-bg/30 pointer-events-none opacity-20" />
          </>
        ) : status === "connecting" ? (
          <div className="flex flex-col items-center justify-center gap-3 p-4 select-none">
            <div className="h-6 w-6 border-2 border-control-cyan border-t-transparent rounded-full animate-spin" />
            <div className="text-[10px] text-control-cyan uppercase tracking-widest font-mono font-semibold animate-pulse text-center">
              Negotiating WHEP Feed...
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
  );
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
        <div className={`flex-1 min-h-0 grid ${getGridColsClass()} gap-3`}>
          {Array.from({ length: layoutSize }).map((_, idx) => {
            const assignedCamId = slotAssignments[idx];
            const camera = cameras.find((c) => c.id === assignedCamId);

            if (assignedCamId && camera) {
              return (
                <CameraPlayer
                  key={`${idx}-${assignedCamId}`}
                  cameraId={assignedCamId}
                  cameraNom={camera.nom}
                  statut={camera.statut}
                  onClear={() => handleClearSlot(idx)}
                />
              );
            }

            // Empty slot state
            return (
              <div 
                key={`empty-${idx}`}
                className="relative w-full h-full bg-control-panel/40 border border-dashed border-control-border hover:border-control-cyan/40 transition-all flex flex-col items-center justify-center p-4 text-center select-none font-mono"
              >
                {activePickerSlot === idx ? (
                  /* Camera Selector Overlay inside the slot */
                  <div className="absolute inset-0 bg-control-bg/95 z-10 flex flex-col p-3 text-left overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-control-border pb-1.5 mb-2 shrink-0">
                      <span className="text-[10px] text-control-text-bright font-bold uppercase tracking-wider">
                        Select Cam For Slot {idx + 1}
                      </span>
                      <button 
                        onClick={() => setActivePickerSlot(null)}
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
                              onClick={() => handleAssignCamera(idx, cam.id)}
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
                        onClick={() => setActivePickerSlot(idx)}
                        className="p-3 border border-control-border bg-control-panel-light text-control-cyan/40 hover:text-control-cyan hover:border-control-cyan/50 hover:glow transition-all cursor-pointer rounded-none"
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
  );
};
