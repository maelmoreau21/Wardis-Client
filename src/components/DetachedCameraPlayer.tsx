import React, { useEffect, useState, useRef } from "react";
import { useCameraStore } from "../store/cameraStore";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { 
  RefreshCw, 
  ShieldAlert, 
  X, 
  Volume2, 
  VolumeX, 
  Info
} from "lucide-react";

interface DetachedCameraPlayerProps {
  cameraId: string;
  cameraNom: string;
  statut: string;
}

export const DetachedCameraPlayer: React.FC<DetachedCameraPlayerProps> = ({ 
  cameraId, 
  cameraNom, 
  statut 
}) => {
  const [status, setStatus] = useState<"connecting" | "playing" | "error" | "no-signal">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const telemetryIntervalRef = useRef<number | null>(null);
  const generateStreamToken = useCameraStore((state) => state.generateStreamToken);

  // Simulated metrics
  const [metrics, setMetrics] = useState({ fps: 30, bitrate: 2150, latency: 120 });

  // Handle telemetry updates
  useEffect(() => {
    telemetryIntervalRef.current = window.setInterval(() => {
      setMetrics({
        fps: Math.floor(Math.random() * 3) + 29, // 29-31 fps
        bitrate: Math.floor(Math.random() * 300) + 2000, // 2000-2300 kbps
        latency: Math.floor(Math.random() * 20) + 110, // 110-130 ms
      });
    }, 2500);

    return () => {
      if (telemetryIntervalRef.current) {
        clearInterval(telemetryIntervalRef.current);
      }
    };
  }, []);

  // WebRTC WHEP Connection & Cleanup Lifecycle (Memory Leak Prevention)
  useEffect(() => {
    if (statut !== "active") {
      setStatus("no-signal");
      setErrorMsg("Camera is configured as INACTIVE on the server.");
      return;
    }

    let isComponentMounted = true;
    let pc: RTCPeerConnection | null = null;
    let connectionTimeoutId: number | null = null;

    const startStream = async () => {
      try {
        setStatus("connecting");
        setErrorMsg(null);

        // 1. Fetch WHEP JWT Token from server API
        const token = await generateStreamToken(cameraId);
        if (!isComponentMounted) return;

        // 2. Setup RTCPeerConnection
        pc = new RTCPeerConnection({
          iceServers: [] // Local MediaMTX works without STUN
        });
        pcRef.current = pc;

        // 3. Add transceivers (recvonly)
        pc.addTransceiver("video", { direction: "recvonly" });
        try {
          pc.addTransceiver("audio", { direction: "recvonly" });
        } catch (_) {}

        // 4. Handle track connection
        pc.ontrack = (event) => {
          if (!isComponentMounted) return;
          console.log(`[Detached] WebRTC track received for ${cameraNom}:`, event.track.kind);
          if (videoRef.current && event.streams && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setStatus("playing");
          }
        };

        // 5. Track connection state changes
        pc.onconnectionstatechange = () => {
          if (!isComponentMounted) return;
          const state = pc?.connectionState;
          console.log(`[Detached] WebRTC Connection State for ${cameraNom}:`, state);
          
          if (state === "connected") {
            setStatus("playing");
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
          } else if (state === "failed" || state === "disconnected") {
            setStatus("no-signal");
            setErrorMsg("WebRTC Connection Lost / Failed");
            cleanupPeerConnection();
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
        if (!isComponentMounted) return;

        // 8. Apply Remote Answer SDP
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: "answer",
          sdp: answerSdp,
        }));

        // Connection Timeout trigger (8 seconds)
        connectionTimeoutId = window.setTimeout(() => {
          if (isComponentMounted && status !== "playing") {
            setStatus("no-signal");
            setErrorMsg("WebRTC Connection Timeout");
            cleanupPeerConnection();
          }
        }, 8000);

      } catch (err: any) {
        console.error(`[Detached] WebRTC WHEP playback failed for ${cameraNom}:`, err);
        if (isComponentMounted) {
          setStatus("error");
          setErrorMsg(err.message || "Failed to establish WebRTC handshake");
        }
      }
    };

    const cleanupPeerConnection = () => {
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
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

    // Cleanup function executed on component unmount
    return () => {
      isComponentMounted = false;
      cleanupPeerConnection();
    };
  }, [cameraId, statut, retryTrigger]);

  const handleRetry = () => {
    setRetryTrigger(prev => prev + 1);
  };

  const handleCloseWindow = async () => {
    try {
      const currentWindow = getCurrentWebviewWindow();
      await currentWindow.close();
    } catch (e) {
      console.error("Failed to close window via Tauri API", e);
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-control-text font-mono flex flex-col relative overflow-hidden select-none crt-overlay">
      
      {/* HUD Telemetry Top Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-control-bg/95 to-transparent p-3 flex items-center justify-between text-xs border-b border-control-border/30">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${
            status === "playing" ? "bg-control-green animate-pulse" :
            status === "connecting" ? "bg-control-amber animate-pulse" : "bg-control-red"
          }`} />
          <span className="text-control-text-bright font-bold tracking-widest text-[11px] uppercase">
            DETACHED VIEW // {cameraNom}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 bg-control-cyan/10 border border-control-cyan/35 text-control-cyan font-bold tracking-wider">
            MONITOR {cameraId.substring(0, 8).toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {status === "playing" && showTelemetry && (
            <div className="flex items-center gap-4 text-[10px] text-control-cyan/80 bg-control-panel/75 px-3 py-1 border border-control-border">
              <span>{metrics.fps} FPS</span>
              <span className="w-px h-3 bg-control-border/40" />
              <span>{metrics.bitrate} KB/S</span>
              <span className="w-px h-3 bg-control-border/40" />
              <span>{metrics.latency}MS LATENCY</span>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowTelemetry(!showTelemetry)}
              className={`p-1.5 border transition-all cursor-pointer ${
                showTelemetry 
                  ? "border-control-cyan bg-control-cyan/10 text-control-cyan" 
                  : "border-control-border text-control-text hover:text-control-cyan"
              }`}
              title="Toggle HUD Telemetry"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 border border-control-border text-control-text hover:text-control-cyan hover:border-control-cyan transition-all cursor-pointer"
              title={isMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              onClick={handleRetry}
              className="p-1.5 border border-control-border text-control-text hover:text-control-cyan hover:border-control-cyan transition-all cursor-pointer"
              title="Force Reconnect Feed"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleCloseWindow}
              className="p-1.5 border border-control-red/60 bg-control-red/5 text-control-red hover:bg-control-red/25 hover:border-control-red transition-all cursor-pointer font-bold flex items-center gap-1 text-[10px] tracking-wider uppercase ml-2"
              title="Close Secondary Screen"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">CLOSE SCREEN</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Video Stream Frame */}
      <div className="flex-1 w-full h-full relative flex items-center justify-center bg-black">
        {status === "playing" ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              className="w-full h-full object-cover"
            />
            {/* Pulsing visual tag */}
            <div className="absolute top-16 right-4 bg-control-red/10 border border-control-red text-control-red text-[9px] font-bold px-2 py-0.5 animate-pulse flex items-center gap-1.5 shadow-lg">
              <span className="h-1.5 w-1.5 bg-control-red rounded-full animate-ping" />
              <span>LIVE FEED</span>
            </div>
            
            {/* Futuristic target overlays */}
            <div className="absolute inset-0 border-[20px] border-transparent border-t-control-cyan/5 border-b-control-cyan/5 pointer-events-none" />
            <div className="absolute top-1/2 left-4 w-6 h-[1px] bg-control-cyan/20 -translate-y-1/2" />
            <div className="absolute top-1/2 right-4 w-6 h-[1px] bg-control-cyan/20 -translate-y-1/2" />
            <div className="absolute left-1/2 top-4 w-[1px] h-6 bg-control-cyan/20 -translate-x-1/2" />
            <div className="absolute left-1/2 bottom-4 w-[1px] h-6 bg-control-cyan/20 -translate-x-1/2" />
            
            {/* CRT Grid Scanlines */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-control-bg/30 pointer-events-none opacity-25" />
          </>
        ) : status === "connecting" ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center select-none p-6">
            <div className="h-8 w-8 border-2 border-control-cyan border-t-transparent rounded-full animate-spin" />
            <div className="text-xs text-control-cyan uppercase tracking-widest font-semibold animate-pulse">
              SYNCING WITH SECURITY MEDIA GATEWAY...
            </div>
          </div>
        ) : (
          /* Error placeholder styled like analog static */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-control-panel-light/30 diagonal-stripes text-center">
            <div className="p-3 bg-control-red/10 border border-control-red/30 text-control-red mb-3">
              <ShieldAlert className="h-8 w-8 animate-pulse" />
            </div>
            <div className="text-sm text-control-text-bright font-bold tracking-widest uppercase mb-1">
              CAMERA LINK OFFLINE // NO SIGNAL
            </div>
            {errorMsg && (
              <div className="text-[10px] text-control-red bg-black/60 border border-control-red/20 px-4 py-2 mt-2 max-w-md break-words font-mono uppercase tracking-wider leading-relaxed">
                {errorMsg}
              </div>
            )}
            <button
              onClick={handleRetry}
              className="mt-5 flex items-center gap-2 px-4 py-2 border border-control-cyan bg-control-cyan/10 hover:bg-control-cyan/20 text-control-cyan text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>RE-ESTABLISH FEED LINK</span>
            </button>
          </div>
        )}
      </div>

      {/* Screen corners HUD styling decorations */}
      <div className="absolute bottom-4 left-4 text-[9px] text-control-text/40 pointer-events-none">
        WARDIS SYSTEM v2.0 • MULTI_SCREEN_NODE
      </div>
      <div className="absolute bottom-4 right-4 text-[9px] text-control-text/40 pointer-events-none">
        LAT: {metrics.latency}ms • SECURE BRIDGE
      </div>
    </div>
  );
};
