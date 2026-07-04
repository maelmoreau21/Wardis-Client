import React, { useEffect, useState, useRef } from "react";
import { useCameraStore } from "../store/cameraStore";
import { getWhepBaseUrl } from "../store/config";
import { listen } from "@tauri-apps/api/event";
import { DetachedHeader } from "./DetachedHeader";
import { 
  RefreshCw, 
  ShieldAlert, 
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
  const [isHighlighted, setIsHighlighted] = useState(false);

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

  // WebRTC WHEP Connection & Cleanup Lifecycle
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

        const token = await generateStreamToken(cameraId);
        if (!isComponentMounted) return;

        pc = new RTCPeerConnection({
          iceServers: []
        });
        pcRef.current = pc;

        pc.addTransceiver("video", { direction: "recvonly" });
        try {
          pc.addTransceiver("audio", { direction: "recvonly" });
        } catch (_) {}

        pc.ontrack = (event) => {
          if (!isComponentMounted) return;
          console.log(`[Detached] WebRTC track received for ${cameraNom}:`, event.track.kind);
          if (videoRef.current && event.streams && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setStatus("playing");
          }
        };

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

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const whepUrl = getWhepBaseUrl(cameraId, token || "");
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

        await pc.setRemoteDescription(new RTCSessionDescription({
          type: "answer",
          sdp: answerSdp,
        }));

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

    return () => {
      isComponentMounted = false;
      cleanupPeerConnection();
    };
  }, [cameraId, statut, retryTrigger]);

  const handleRetry = () => {
    setRetryTrigger(prev => prev + 1);
  };

  return (
    <div className="h-screen w-screen bg-black text-control-text font-mono flex flex-col relative overflow-hidden select-none crt-overlay">
      {/* Detached Screen Native Header integration */}
      <DetachedHeader title={`Wardis Detached Feed // ${cameraNom}`} />

      {/* Main Video Stream Frame */}
      <div className={`flex-1 w-full h-full relative flex items-center justify-center bg-black transition-all duration-300 ${
        isHighlighted 
          ? "ring-4 ring-control-cyan ring-inset border-4 border-control-cyan shadow-[0_0_30px_rgba(0,240,255,0.7)]" 
          : ""
      }`}>
        
        {/* Floating Telemetry & Control Panel */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-3">
          {status === "playing" && showTelemetry && (
            <div className="flex items-center gap-4 text-[10px] text-control-cyan/80 bg-control-panel/75 px-3 py-1 border border-control-border backdrop-blur-xs">
              <span>{metrics.fps} FPS</span>
              <span className="w-px h-3 bg-control-border/40" />
              <span>{metrics.bitrate} KB/S</span>
              <span className="w-px h-3 bg-control-border/40" />
              <span>{metrics.latency}MS LATENCY</span>
            </div>
          )}

          {/* Floating Controls HUD */}
          <div className="flex items-center gap-1.5 bg-control-panel/75 p-1 border border-control-border backdrop-blur-xs">
            <button
              onClick={() => setShowTelemetry(!showTelemetry)}
              className={`p-1 border transition-all cursor-pointer ${
                showTelemetry 
                  ? "border-control-cyan bg-control-cyan/10 text-control-cyan" 
                  : "border-transparent text-control-text hover:text-control-cyan"
              }`}
              title="Toggle HUD Telemetry"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 border border-transparent text-control-text hover:text-control-cyan transition-all cursor-pointer"
              title={isMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={handleRetry}
              className="p-1 border border-transparent text-control-text hover:text-control-cyan transition-all cursor-pointer"
              title="Force Reconnect Feed"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

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
            <div className="absolute top-4 left-4 bg-control-red/10 border border-control-red text-control-red text-[9px] font-bold px-2 py-0.5 animate-pulse flex items-center gap-1.5 shadow-lg">
              <span className="h-1.5 w-1.5 bg-control-red rounded-full animate-ping" />
              <span>LIVE FEED</span>
            </div>
            
            {/* Target overlays */}
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
      <div className="absolute bottom-4 left-4 text-[9px] text-control-text/40 pointer-events-none z-30">
        WARDIS SYSTEM v2.0 • MULTI_SCREEN_NODE
      </div>
      <div className="absolute bottom-4 right-4 text-[9px] text-control-text/40 pointer-events-none z-30">
        LAT: {metrics.latency}ms • SECURE BRIDGE
      </div>
    </div>
  );
};
