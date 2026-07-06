import React, { useEffect, useState, useRef } from "react";
import { useCameraStore } from "../store/cameraStore";
import { useAuthStore } from "../store/authStore";
import { useAlarmStore } from "../store/alarmStore";
import { useVideoWallStore } from "../store/videoWallStore";
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
  Gamepad,
  Camera as CameraIcon,
  Bookmark,
  Maximize2,
  Volume2,
  VolumeX,
  Save,
  Play,
  Pause,
  Radio,
  Loader2,
} from "lucide-react";

// ==========================================
// 0. TilePlaybackBar — per-tile overlay bar
// ==========================================
const MAX_SEEK_SECONDS = 24 * 3600; // 24 h lookback

interface TilePlaybackBarProps {
  isPlayback: boolean;
  seekOffsetSeconds: number; // 0 = live; > 0 = seconds in the past
  isLoading: boolean;
  isPaused: boolean;
  onSeek: (offsetSeconds: number) => void;
  onTogglePlayPause: () => void;
  onBackToLive: () => void;
}

const TilePlaybackBar: React.FC<TilePlaybackBarProps> = ({
  isPlayback,
  seekOffsetSeconds,
  isLoading,
  isPaused,
  onSeek,
  onTogglePlayPause,
  onBackToLive,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const seekTime = new Date(Date.now() - seekOffsetSeconds * 1000);
  const timeLabel =
    !isPlayback || seekOffsetSeconds === 0
      ? "En direct"
      : seekTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

  const pct = (seekOffsetSeconds / MAX_SEEK_SECONDS) * 100;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-40 transition-opacity duration-200 ${
        isPlayback || isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Seek loading bar */}
      {isLoading && (
        <div className="absolute bottom-full left-0 right-0 h-0.5 bg-control-border/30 overflow-hidden">
          <div
            className="h-full bg-control-cyan absolute"
            style={{
              animation: "wardis-seek-slide 0.9s ease-in-out infinite",
              width: "45%",
            }}
          />
        </div>
      )}

      <div className="bg-black/85 backdrop-blur-sm border-t border-white/5 px-3 pt-2 pb-2.5 flex flex-col gap-2">
        {/* Scrubber timeline */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-control-text/50 font-mono shrink-0">−24h</span>
          <input
            type="range"
            min={0}
            max={MAX_SEEK_SECONDS}
            step={30}
            value={seekOffsetSeconds}
            onChange={(e) => onSeek(Number(e.target.value))}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            className="flex-1 h-1 cursor-pointer rounded-full"
            style={{
              accentColor: "var(--color-control-cyan)",
              background: `linear-gradient(to left, var(--color-control-cyan) ${pct}%, var(--color-control-border) ${pct}%)`,
            }}
          />
          <span className="text-xs text-control-green font-mono shrink-0">Live</span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Play / Pause */}
          <button
            onClick={onTogglePlayPause}
            className="flex items-center justify-center h-9 w-9 rounded-md bg-control-panel-light hover:bg-control-cyan/20 text-control-text-bright hover:text-control-cyan border border-control-border hover:border-control-cyan/50 transition-all shrink-0"
            title={isPaused ? "Lecture" : "Pause"}
          >
            {isLoading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin text-control-cyan" />
            ) : isPaused ? (
              <Play className="h-4.5 w-4.5" />
            ) : (
              <Pause className="h-4.5 w-4.5" />
            )}
          </button>

          {/* Timestamp */}
          <div className="flex-1 text-center">
            <span
              className={`font-mono text-xs font-semibold tracking-wide ${
                isPlayback && seekOffsetSeconds > 0
                  ? "text-control-amber"
                  : "text-control-green"
              }`}
            >
              {timeLabel}
            </span>
          </div>

          {/* Back to live */}
          <button
            onClick={onBackToLive}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium transition-all shrink-0 ${
              isPlayback && seekOffsetSeconds > 0
                ? "border-control-red/60 bg-control-red/10 text-control-red hover:bg-control-red/20 cursor-pointer"
                : "border-control-green/40 bg-control-green/5 text-control-green opacity-60 cursor-default"
            }`}
            title="Revenir au direct"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Direct</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 1. CameraPlayer Component (WHEP WebRTC & HLS)
// ==========================================
export interface CameraPlayerProps {
  cameraId: string;
  cameraNom: string;
  statut: string;
  isZoomed?: boolean;
  isSelected?: boolean;
  aspectRatioMode: "contain" | "cover";
  onClear: () => void;
  onDoubleClick?: () => void;
  onClick?: () => void;
  ptzSupported?: boolean;
  onTogglePTZ?: () => void;
  isPTZOpen?: boolean;
  /** null/0 = live; positive = seek N seconds into the past within HLS buffer */
  seekOffsetSeconds?: number | null;
  /** Pause/play the stream */
  isPausedPlayback?: boolean;
}

export const CameraPlayer: React.FC<CameraPlayerProps> = ({ 
  cameraId, 
  cameraNom, 
  statut, 
  isZoomed = false, 
  isSelected = false,
  aspectRatioMode,
  onClear, 
  onDoubleClick,
  onClick,
  ptzSupported: _ptzSupported = false,
  onTogglePTZ: _onTogglePTZ,
  isPTZOpen = false,
  seekOffsetSeconds = null,
  isPausedPlayback = false,
}) => {
  const [status, setStatus] = useState<"connecting" | "playing" | "error" | "no-signal" | "paused">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isAudioActive, setIsAudioActive] = useState(false);
  const [bookmarkSuccess, setBookmarkSuccess] = useState(false);
  
  // Digital Zoom state
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const generateStreamToken = useCameraStore((state) => state.generateStreamToken);
  const configureWHEPStream = useCameraStore((state) => state.configureWHEPStream);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Performance: Intersection Observer to pause/stop decoding when off-screen
  useEffect(() => {
    const container = playerContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
    return () => {
      observer.unobserve(container);
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
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeStr(d.toLocaleDateString() + " " + d.toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        fps: Math.floor(Math.random() * 3) + 29, // 29-31 fps
        bitrate: isZoomed 
          ? Math.floor(Math.random() * 800) + 6000 
          : Math.floor(Math.random() * 300) + 2000, 
        latency: isZoomed
          ? Math.floor(Math.random() * 500) + 2500 
          : Math.floor(Math.random() * 20) + 110, 
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

  // Playback initialization with Visibility check
  useEffect(() => {
    if (statut !== "active") {
      setStatus("no-signal");
      setErrorMsg("Camera is configured as INACTIVE on the server.");
      return;
    }

    if (!isVisible) {
      setStatus("paused");
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
            iceServers: []
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
  }, [cameraId, statut, retryTrigger, isZoomed, isVisible]);

  // Seek within HLS buffer when seekOffsetSeconds changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (seekOffsetSeconds === null || seekOffsetSeconds === 0) {
      // Return to live edge
      if (video.seekable.length > 0) {
        video.currentTime = video.seekable.end(video.seekable.length - 1);
      }
      return;
    }
    if (video.seekable.length > 0) {
      const liveEdge = video.seekable.end(video.seekable.length - 1);
      const target = Math.max(video.seekable.start(0), liveEdge - seekOffsetSeconds);
      video.currentTime = target;
    }
  }, [seekOffsetSeconds]);

  // Pause / resume the video stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPausedPlayback) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [isPausedPlayback]);

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

  // Digital Zoom: wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (status !== "playing") return;
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.max(1, Math.min(8, zoomScale * factor));
    if (newScale === 1) {
      setZoomOffset({ x: 0, y: 0 });
    }
    setZoomScale(newScale);
  };

  // Digital Zoom: Panning when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1 || status !== "playing") return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - zoomOffset.x, y: e.clientY - zoomOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || zoomScale <= 1) return;
    setZoomOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Capture Screenshot (Snapshot)
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || status !== "playing") return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 1920;
      canvas.height = videoRef.current.videoHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg");
        const a = document.createElement("a");
        a.href = url;
        a.download = `Snapshot_${cameraNom}_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Screenshot capture failed:", err);
    }
  };

  // Save Bookmark
  const handleSaveBookmark = () => {
    setBookmarkSuccess(true);
    setTimeout(() => setBookmarkSuccess(false), 2000);
  };

  return (
    <div 
      ref={playerContainerRef}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
        className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-control-bg/95 to-transparent p-2.5 flex items-center justify-between text-[9px] font-mono select-none"
      >
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${
            status === "playing" ? "bg-control-green animate-pulse" :
            status === "connecting" ? "bg-control-amber animate-pulse" :
            status === "paused" ? "bg-gray-500" : "bg-control-red"
          }`} />
          <span className="text-control-text-bright tracking-wider uppercase font-bold">
            CAM // {cameraNom}
          </span>
        </div>

        {/* Live ticking timestamp */}
        <div className="text-control-text/70 text-[8px] font-bold">
          {currentTimeStr}
        </div>
        
        {/* Stream Actions */}
        <div className="flex items-center gap-1.5">
          {status === "playing" && (
            <div className="hidden sm:flex items-center gap-2 text-control-cyan/70 font-mono text-[8px]">
              <span>{metrics.fps} FPS</span>
              <span>{metrics.bitrate} KB/S</span>
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
            onClick={(e) => { e.stopPropagation(); setShowConfig(!showConfig); }}
            className="p-1 hover:bg-control-cyan/10 border border-transparent hover:border-control-cyan/20 text-control-text hover:text-control-cyan transition-all"
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Quick actions — top-right compact row, visible on hover */}
      {status === "playing" && (
        <div
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute top-9 right-2 z-30 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <button
            onClick={handleCaptureSnapshot}
            className="flex items-center justify-center h-7 w-7 rounded bg-black/60 hover:bg-control-cyan/20 text-control-text hover:text-control-cyan border border-white/10 hover:border-control-cyan/40 transition-all"
            title="Capture d'image"
          >
            <CameraIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleSaveBookmark}
            className="flex items-center justify-center h-7 w-7 rounded bg-black/60 hover:bg-control-cyan/20 text-control-text hover:text-control-cyan border border-white/10 hover:border-control-cyan/40 transition-all"
            title="Poser un signet"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIsAudioActive(!isAudioActive)}
            className={`flex items-center justify-center h-7 w-7 rounded border transition-all ${
              isAudioActive
                ? "bg-control-cyan/10 border-control-cyan/40 text-control-cyan"
                : "bg-black/60 border-white/10 text-control-text hover:text-control-cyan hover:bg-control-cyan/20 hover:border-control-cyan/40"
            }`}
            title={isAudioActive ? "Couper l'audio" : "Activer l'audio"}
          >
            {isAudioActive ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onDoubleClick}
            className="flex items-center justify-center h-7 w-7 rounded bg-black/60 hover:bg-control-cyan/20 text-control-text hover:text-control-cyan border border-white/10 hover:border-control-cyan/40 transition-all"
            title="Agrandir"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bookmark Success Visual Overlay */}
      {bookmarkSuccess && (
        <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center font-mono text-control-cyan text-xs font-bold uppercase tracking-wider animate-fade-in">
          🔖 Signet Enregistré avec Succès !
        </div>
      )}

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
              muted={!isAudioActive}
              style={{
                transform: `scale(${zoomScale}) translate(${zoomOffset.x / zoomScale}px, ${zoomOffset.y / zoomScale}px)`,
                cursor: zoomScale > 1 ? (isPanning ? "grabbing" : "grab") : "default",
                transition: isPanning ? "none" : "transform 0.1s ease-out"
              }}
              className={`w-full h-full ${aspectRatioMode === "contain" ? "object-contain" : "object-cover"}`}
            />
            
            {/* Stream Type & REC tags */}
            <div 
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute top-10 right-2.5 flex gap-1.5 z-15 select-none"
            >
              <div className={`border text-[7px] font-mono font-bold px-1.5 py-0.5 flex items-center gap-1 ${
                isZoomed 
                  ? "bg-control-cyan/15 border-control-cyan text-control-cyan" 
                  : "bg-control-amber/15 border-control-amber text-control-amber"
              }`}>
                <span>{isZoomed ? "HIGH-RES HLS" : "LOW-RES WHEP"}</span>
              </div>
              <div className="bg-control-red/15 border border-control-red text-control-red text-[7px] font-mono font-bold px-1.5 py-0.5 animate-pulse flex items-center gap-1">
                <span className="h-1 w-1 bg-control-red rounded-full animate-ping" />
                <span>LIVE</span>
              </div>
            </div>
            
            {/* PTZ overlay Controls inside Player */}
            {isPTZOpen && (
              <div 
                onDoubleClick={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-4 right-4 z-20 bg-control-bg/90 border border-control-cyan/40 p-2 flex flex-col items-center gap-1.5 backdrop-blur-xs select-none shadow-[0_0_10px_rgba(0,0,0,0.8)] rounded-xl"
              >
                <div className="text-[7px] text-control-cyan/80 uppercase font-mono font-bold tracking-widest mb-1 border-b border-control-border/40 pb-0.5 w-full text-center">PTZ CONTROLLER</div>
                
                {/* D-Pad Grid */}
                <div className="grid grid-cols-3 gap-1">
                  <div />
                  <button
                    onMouseDown={() => startPTZ(0, 1, 0)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    className="p-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all cursor-pointer"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <div />

                  <button
                    onMouseDown={() => startPTZ(-1, 0, 0)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    className="p-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <div className="w-5 h-5 border border-dashed border-control-border/30 flex items-center justify-center text-[5px] text-control-text/30 font-mono">
                    PAD
                  </div>
                  <button
                    onMouseDown={() => startPTZ(1, 0, 0)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    className="p-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all cursor-pointer"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>

                  <div />
                  <button
                    onMouseDown={() => startPTZ(0, -1, 0)}
                    onMouseUp={stopPTZ}
                    onMouseLeave={stopPTZ}
                    className="p-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/10 text-control-text-bright active:text-control-cyan transition-all cursor-pointer"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div />
                </div>
              </div>
            )}
            
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-control-bg/30 pointer-events-none opacity-20" />
          </>
        ) : status === "connecting" ? (
          <div className="flex flex-col items-center justify-center gap-3 p-4 select-none">
            <div className="h-6 w-6 border-2 border-control-cyan border-t-transparent rounded-full animate-spin" />
            <div className="text-[9px] text-control-cyan uppercase tracking-widest font-mono font-semibold animate-pulse text-center">
              {isZoomed ? "Negotiating HLS Feed..." : "Negotiating WHEP Feed..."}
            </div>
          </div>
        ) : status === "paused" ? (
          <div className="flex flex-col items-center justify-center gap-2 p-4 select-none">
            <div className="text-[10px] text-control-text/40 uppercase tracking-widest font-mono font-bold">
              [ DECODING SUSPENDED ]
            </div>
            <div className="text-[8px] text-control-text/30 font-mono uppercase text-center max-w-[150px]">
              Stream paused to save GPU resources. Scroll back to resume.
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
type LayoutType = "1x1" | "2x2" | "3x3" | "4x4" | "1+5" | "1+7" | "libre" | "auto";

interface SavedNamedView {
  name: string;
  layout: LayoutType;
  slotAssignments: (string | null)[];
  aspectRatios: ("contain" | "cover")[];
  freeTiles?: { id: string; cameraId: string | null; x: number; y: number; w: number; h: number }[];
}

export const LiveView: React.FC = () => {
  const { cameras, loading, error, fetchCameras } = useCameraStore();
  const { activeAlarms, sensors, fetchActiveAlarms, fetchSensors } = useAlarmStore();
  
  // Layout and view state from global store
  const {
    slotAssignments,
    setSlotAssignments,
    aspectRatios,
    setAspectRatios,
    layout: storeLayout,
    setLayout: setStoreLayout
  } = useVideoWallStore();

  const layout = storeLayout as LayoutType;
  const setLayout = (l: LayoutType) => setStoreLayout(l);
  
  // Custom Free Layout tiles
  const [freeTiles, setFreeTiles] = useState<{ id: string; cameraId: string | null; x: number; y: number; w: number; h: number }[]>([
    { id: "free-1", cameraId: null, x: 2, y: 2, w: 45, h: 45 },
    { id: "free-2", cameraId: null, x: 50, y: 2, w: 45, h: 45 },
    { id: "free-3", cameraId: null, x: 2, y: 50, w: 45, h: 45 },
    { id: "free-4", cameraId: null, x: 50, y: 50, w: 45, h: 45 },
  ]);

  // Named views list
  const [namedViews, setNamedViews] = useState<SavedNamedView[]>([]);
  const [newViewName, setNewViewName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Sequence Configuration per slot
  const [sequenceSettings, setSequenceSettings] = useState<{
    [slotIdx: number]: {
      active: boolean;
      camerasList: string[];
      currentIndex: number;
      interval: number; // in seconds
    };
  }>({});

  // Active slot selectors
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [zoomedSlotIndex, setZoomedSlotIndex] = useState<number | null>(null);
  const [activePickerSlot, setActivePickerSlot] = useState<number | null>(null);
  
  // Active PTZ panel display trackers
  const [ptzOpenSlots, setPtzOpenSlots] = useState<{ [slotIdx: number]: boolean }>({});

  // ── Per-tile independent playback state ──────────────────────────────────
  type TilePlaybackState = {
    isPlayback: boolean;
    seekOffsetSeconds: number;
    isLoading: boolean;
    isPaused: boolean;
  };
  const [tilePlaybackStates, setTilePlaybackStates] = useState<Record<number, TilePlaybackState>>({});

  const getTilePlayback = (idx: number): TilePlaybackState =>
    tilePlaybackStates[idx] ?? { isPlayback: false, seekOffsetSeconds: 0, isLoading: false, isPaused: false };

  const handleTileSeek = (idx: number, offsetSeconds: number) => {
    setTilePlaybackStates((prev) => ({
      ...prev,
      [idx]: {
        ...(prev[idx] ?? { isPlayback: false, seekOffsetSeconds: 0, isLoading: false, isPaused: false }),
        isPlayback: offsetSeconds > 0,
        seekOffsetSeconds: offsetSeconds,
        isLoading: true,
      },
    }));
    // Clear loading indicator after seek completes
    setTimeout(() => {
      setTilePlaybackStates((prev) => {
        if (!prev[idx]) return prev;
        return { ...prev, [idx]: { ...prev[idx], isLoading: false } };
      });
    }, 700);
  };

  const handleTileBackToLive = (idx: number) => {
    setTilePlaybackStates((prev) => ({
      ...prev,
      [idx]: { isPlayback: false, seekOffsetSeconds: 0, isLoading: false, isPaused: false },
    }));
  };

  const handleToggleTilePlayPause = (idx: number) => {
    setTilePlaybackStates((prev) => {
      const cur = prev[idx] ?? { isPlayback: false, seekOffsetSeconds: 0, isLoading: false, isPaused: false };
      return { ...prev, [idx]: { ...cur, isPaused: !cur.isPaused } };
    });
  };
  // ─────────────────────────────────────────────────────────────────────────

  // Dragging states
  const [draggedFreeTileId, setDraggedFreeTileId] = useState<string | null>(null);
  const [freeTileResizingId, setFreeTileResizingId] = useState<string | null>(null);
  const [dragStartMouse, setDragStartMouse] = useState({ x: 0, y: 0 });
  const [freeTileStartPos, setFreeTileStartPos] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Gamepad / Joystick connection states
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);

  const sendPTZCommand = useCameraStore((state) => state.sendPTZCommand);

  // Fetch cameras and alarms on mount
  useEffect(() => {
    fetchCameras();
    fetchActiveAlarms();
    fetchSensors();

    // Load saved views
    try {
      const views = JSON.parse(localStorage.getItem("wardis-named-views") || "[]");
      setNamedViews(views);
    } catch (_) {}
  }, [fetchCameras, fetchActiveAlarms, fetchSensors]);

  // Load layout/alarm periodic checkers
  useEffect(() => {
    const alarmInterval = setInterval(() => {
      fetchActiveAlarms();
    }, 8000);
    return () => clearInterval(alarmInterval);
  }, [fetchActiveAlarms]);

  // Viewport/Slot counts mapping
  const getSlotCount = (l: LayoutType) => {
    if (l === "1x1") return 1;
    if (l === "2x2") return 4;
    if (l === "3x3") return 9;
    if (l === "4x4") return 16;
    if (l === "1+5") return 6;
    if (l === "1+7") return 8;
    if (l === "auto") return Math.min(cameras.length, 16); // auto-assign all cameras
    return 4; // free mode initialized with 4
  };

  // Auto-fill slots when layout or site selection changes
  useEffect(() => {
    if (loading || cameras.length === 0) return;
    const count = getSlotCount(layout);
    const newAssignments = [...slotAssignments];
    for (let i = 0; i < count; i++) {
      if (newAssignments[i] === null && cameras[i]) {
        newAssignments[i] = cameras[i].id;
      }
    }
    setSlotAssignments(newAssignments);

    // Sync free layout cam assignments
    setFreeTiles(prev => prev.map((tile, i) => ({
      ...tile,
      cameraId: tile.cameraId || (cameras[i] ? cameras[i].id : null)
    })));
  }, [layout, cameras, loading]);

  // Sequence runner timer
  useEffect(() => {
    const activeSlots = Object.keys(sequenceSettings).filter(
      key => sequenceSettings[Number(key)]?.active
    ).map(Number);

    if (activeSlots.length === 0) return;

    const intervals = activeSlots.map(slotIdx => {
      const settings = sequenceSettings[slotIdx];
      return setInterval(() => {
        if (!settings.camerasList || settings.camerasList.length <= 1) return;
        const nextIdx = (settings.currentIndex + 1) % settings.camerasList.length;
        
        // Update slot assignment
        {
          const next = [...slotAssignments];
          next[slotIdx] = settings.camerasList[nextIdx];
          setSlotAssignments(next);
        }

        // Update sequence state
        setSequenceSettings(prev => ({
          ...prev,
          [slotIdx]: {
            ...prev[slotIdx],
            currentIndex: nextIdx
          }
        }));
      }, settings.interval * 1000);
    });

    return () => {
      intervals.forEach(clearInterval);
    };
  }, [sequenceSettings]);

  // Hotkey listener for named view recall (1 to 9 keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger hotkeys if user is currently typing in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const view = namedViews[num - 1];
        if (view) {
          e.preventDefault();
          loadNamedView(view);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [namedViews]);

  // Check if camera has active alarm
  const isCameraInAlarm = (cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera) return false;

    // Direct ID match
    const hasDirectAlarm = activeAlarms.some(alarm => alarm.zone_id === (camera as any).zone_id);
    if (hasDirectAlarm) return true;

    return activeAlarms.some(alarm => {
      const sensor = sensors.find(s => s.id === alarm.capteur_id);
      if (!sensor) return false;

      // Smart match by names or direct tags
      const camNameLower = camera.nom.toLowerCase();
      const sensorNameLower = sensor.nom.toLowerCase();
      
      // If sensor name contains parts of camera name, or vice versa
      const camTokens = camNameLower.split(/[\s_-]+/);
      return camTokens.some(tok => tok.length > 2 && sensorNameLower.includes(tok));
    });
  };

  const loadNamedView = (view: SavedNamedView) => {
    setLayout(view.layout);
    setSlotAssignments(view.slotAssignments);
    setAspectRatios(view.aspectRatios);
    if (view.freeTiles) {
      setFreeTiles(view.freeTiles);
    }
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    const viewObj: SavedNamedView = {
      name: newViewName.trim(),
      layout,
      slotAssignments,
      aspectRatios,
      freeTiles: layout === "libre" ? freeTiles : undefined
    };

    const nextViews = [...namedViews, viewObj].slice(0, 9); // Keep max 9 views bound to hotkeys
    setNamedViews(nextViews);
    localStorage.setItem("wardis-named-views", JSON.stringify(nextViews));
    setNewViewName("");
    setShowSaveModal(false);
  };

  const handleClearSlot = (idx: number) => {
    const next = [...slotAssignments];
    next[idx] = null;
    setSlotAssignments(next);
  };

  const handleToggleAspectRatio = (idx: number) => {
    const next = [...aspectRatios];
    next[idx] = next[idx] === "contain" ? "cover" : "contain";
    setAspectRatios(next);
  };

  const handleAssignCamera = (slotIndex: number, cameraId: string | null) => {
    const next = [...slotAssignments];
    next[slotIndex] = cameraId;
    setSlotAssignments(next);
    setActivePickerSlot(null);
  };

  // Sequence Configuration toggler helper
  const handleToggleSequence = (slotIdx: number) => {
    const isRunning = sequenceSettings[slotIdx]?.active;
    
    // Create sequence with all active cameras
    const availableCams = cameras.filter(c => c.statut === "active").map(c => c.id);

    setSequenceSettings(prev => ({
      ...prev,
      [slotIdx]: {
        active: !isRunning,
        camerasList: availableCams,
        currentIndex: 0,
        interval: 8 // default 8s
      }
    }));
  };

  // Drag & Drop: Tree drop handler
  const handleDropFromTree = (e: React.DragEvent, targetSlotIdx: number) => {
    e.preventDefault();
    const cameraId = e.dataTransfer.getData("wardis/camera-id") || e.dataTransfer.getData("text/plain");
    if (!cameraId) return;

    const next = [...slotAssignments];
    next[targetSlotIdx] = cameraId;
    setSlotAssignments(next);
  };

  // Drag & Drop: Drag starts from tile
  const handleTileDragStart = (e: React.DragEvent, slotIdx: number) => {
    e.dataTransfer.setData("wardis/slot-index", slotIdx.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  // Drag & Drop: Tile Swap handler
  const handleTileDrop = (e: React.DragEvent, targetSlotIdx: number) => {
    e.preventDefault();
    const sourceSlotIdxStr = e.dataTransfer.getData("wardis/slot-index");
    
    if (sourceSlotIdxStr) {
      const sourceSlotIdx = parseInt(sourceSlotIdxStr);
      if (sourceSlotIdx === targetSlotIdx) return;

      // Swap camera assignments
      const next = [...slotAssignments];
      const temp = next[sourceSlotIdx];
      next[sourceSlotIdx] = next[targetSlotIdx];
      next[targetSlotIdx] = temp;
      setSlotAssignments(next);
    } else {
      // Tree drag to slot
      handleDropFromTree(e, targetSlotIdx);
    }
  };

  // Free Layout Drag & Resize mouse handlers
  const handleFreeTileDragStart = (e: React.MouseEvent, tileId: string) => {
    e.preventDefault();
    setDraggedFreeTileId(tileId);
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    const tile = freeTiles.find(t => t.id === tileId);
    if (tile) {
      setFreeTileStartPos({ x: tile.x, y: tile.y, w: tile.w, h: tile.h });
    }
  };

  const handleFreeTileResizeStart = (e: React.MouseEvent, tileId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setFreeTileResizingId(tileId);
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    const tile = freeTiles.find(t => t.id === tileId);
    if (tile) {
      setFreeTileStartPos({ x: tile.x, y: tile.y, w: tile.w, h: tile.h });
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggedFreeTileId) {
        const dx = ((e.clientX - dragStartMouse.x) / window.innerWidth) * 100;
        const dy = ((e.clientY - dragStartMouse.y) / window.innerHeight) * 100;

        setFreeTiles(prev => prev.map(t => {
          if (t.id === draggedFreeTileId) {
            return {
              ...t,
              x: Math.max(0, Math.min(90, freeTileStartPos.x + dx)),
              y: Math.max(0, Math.min(90, freeTileStartPos.y + dy))
            };
          }
          return t;
        }));
      } else if (freeTileResizingId) {
        const dx = ((e.clientX - dragStartMouse.x) / window.innerWidth) * 100;
        const dy = ((e.clientY - dragStartMouse.y) / window.innerHeight) * 100;

        setFreeTiles(prev => prev.map(t => {
          if (t.id === freeTileResizingId) {
            return {
              ...t,
              w: Math.max(15, Math.min(80, freeTileStartPos.w + dx)),
              h: Math.max(15, Math.min(80, freeTileStartPos.h + dy))
            };
          }
          return t;
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setDraggedFreeTileId(null);
      setFreeTileResizingId(null);
    };

    if (draggedFreeTileId || freeTileResizingId) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [draggedFreeTileId, freeTileResizingId, dragStartMouse, freeTileStartPos]);

  // PTZ USB gamepad handler mapping
  useEffect(() => {
    const handleConnect = () => {
      setIsGamepadConnected(true);
    };
    const handleDisconnect = () => {
      setIsGamepadConnected(false);
    };

    window.addEventListener("gamepadconnected", handleConnect);
    window.addEventListener("gamepaddisconnected", handleDisconnect);

    return () => {
      window.removeEventListener("gamepadconnected", handleConnect);
      window.removeEventListener("gamepaddisconnected", handleDisconnect);
    };
  }, []);

  const getActiveCameraId = (): string | null => {
    if (zoomedSlotIndex !== null) return slotAssignments[zoomedSlotIndex];
    if (selectedSlotIndex !== null) return slotAssignments[selectedSlotIndex];
    return slotAssignments.find(id => id !== null) || null;
  };

  const getActiveSlotIndex = (): number | null => {
    if (zoomedSlotIndex !== null) return zoomedSlotIndex;
    if (selectedSlotIndex !== null) return selectedSlotIndex;
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-control-panel/20 border border-control-border relative p-4 gap-4 select-none">
      
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between bg-control-panel/80 p-3 border border-control-border gap-4 select-none shrink-0 font-mono z-20 rounded-xl">
        
        {/* Layout Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-control-text/60 font-semibold pr-1">Grille :</span>
          {([
            { key: "auto", label: "Auto" },
            { key: "1x1",  label: "1×1"  },
            { key: "2x2",  label: "2×2"  },
            { key: "3x3",  label: "3×3"  },
            { key: "4x4",  label: "4×4"  },
            { key: "1+5",  label: "1+5"  },
            { key: "1+7",  label: "1+7"  },
            { key: "libre", label: "Libre" },
          ] as { key: LayoutType; label: string }[]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setLayout(opt.key);
                setActivePickerSlot(null);
                setZoomedSlotIndex(null);
              }}
              className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer border flex items-center gap-1.5 ${
                layout === opt.key
                  ? "border-control-cyan bg-control-cyan/10 text-control-cyan"
                  : "border-control-border text-control-text hover:text-control-text-bright hover:bg-control-panel-light"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Named Views Saved Controller */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-control-text/60 uppercase tracking-widest font-bold pr-1">Vues ({namedViews.length}/9):</span>
          <div className="flex gap-1.5">
            {namedViews.map((view, i) => (
              <button
                key={i}
                onClick={() => loadNamedView(view)}
                className="px-2 py-1 text-[9px] border border-control-border hover:border-control-cyan hover:text-control-cyan bg-control-panel-light/40 transition-colors uppercase font-bold"
                title={`Rappel via raccourci numérique ${i + 1}`}
              >
                {i + 1}: {view.name}
              </button>
            ))}
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-2.5 py-1 text-[9px] border border-control-cyan/50 text-control-cyan hover:bg-control-cyan/10 uppercase font-bold flex items-center gap-1 cursor-pointer"
            >
              <Save className="h-3 w-3" />
              <span>Save View</span>
            </button>
          </div>
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
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 relative">
          
          {/* Viewport content */}
          <div className="flex-1 min-h-0 relative flex flex-col">
            
            {/* Zoomed slot view (Double clicked) */}
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
                      aspectRatioMode={aspectRatios[zoomedSlotIndex]}
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
            })() : layout === "libre" ? (
              
              /* Free custom layout container */
              <div className="flex-1 min-h-0 border border-dashed border-control-border bg-black/40 relative rounded-xl overflow-hidden">
                <div className="absolute top-2 left-2 text-[9px] text-control-text/40 uppercase font-mono font-bold">
                  [ Mode Libre - Glisser l'en-tête pour déplacer, angle bas-droite pour redimensionner ]
                </div>
                {freeTiles.map((tile) => {
                  const camera = cameras.find(c => c.id === tile.cameraId);
                  return (
                    <div
                      key={tile.id}
                      style={{
                        position: "absolute",
                        left: `${tile.x}%`,
                        top: `${tile.y}%`,
                        width: `${tile.w}%`,
                        height: `${tile.h}%`,
                      }}
                      className="border border-control-border bg-control-panel flex flex-col rounded-xl overflow-hidden shadow-2xl"
                    >
                      {/* Drag header */}
                      <div
                        onMouseDown={(e) => handleFreeTileDragStart(e, tile.id)}
                        className="bg-control-panel-light/75 px-3 py-1.5 text-[9px] font-mono font-bold flex items-center justify-between cursor-move text-control-text-bright border-b border-control-border"
                      >
                        <span className="truncate">CAM // {camera ? camera.nom : "Unassigned"}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setFreeTiles(prev => prev.map(t => t.id === tile.id ? { ...t, cameraId: null } : t));
                            }}
                            className="text-control-red hover:underline"
                          >
                            CLEAR
                          </button>
                        </div>
                      </div>
                      
                      {/* Slot display */}
                      <div className="flex-1 min-h-0 relative">
                        {camera ? (
                          <CameraPlayer
                            cameraId={camera.id}
                            cameraNom={camera.nom}
                            statut={camera.statut}
                            aspectRatioMode="cover"
                            onClear={() => {
                              setFreeTiles(prev => prev.map(t => t.id === tile.id ? { ...t, cameraId: null } : t));
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                            <Plus className="h-5 w-5 text-control-text/40" />
                            <span className="text-[9px] text-control-text/40 font-mono">DRAG CAM HERE</span>
                          </div>
                        )}
                      </div>

                      {/* Resize handle in bottom right corner */}
                      <div
                        onMouseDown={(e) => handleFreeTileResizeStart(e, tile.id)}
                        className="absolute bottom-0 right-0 w-3 h-3 bg-control-cyan/40 hover:bg-control-cyan cursor-se-resize rounded-tl"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Regular structured layouts + Auto-sizing grid */
              (() => {
                // In "auto" mode: render only assigned slots, no empty tiles
                const totalSlots = getSlotCount(layout);
                const indicesToRender: number[] =
                  layout === "auto"
                    ? slotAssignments
                        .map((id, i) => (id !== null ? i : -1))
                        .filter((i) => i !== -1)
                        .slice(0, 16)
                    : Array.from({ length: totalSlots }, (_, i) => i);

                // Auto-compute column count based on the number of tiles to render
                const autoGridCols = (n: number) =>
                  n <= 1 ? "grid-cols-1"
                  : n <= 2 ? "grid-cols-2"
                  : n <= 4 ? "grid-cols-2"
                  : n <= 9 ? "grid-cols-3"
                  : "grid-cols-4";

                const gridClass =
                  layout === "1x1"  ? "grid-cols-1"
                  : layout === "2x2"  ? "grid-cols-2"
                  : layout === "3x3"  ? "grid-cols-3"
                  : layout === "4x4"  ? "grid-cols-4"
                  : layout === "1+5" ? "grid-1-plus-5"
                  : layout === "1+7" ? "grid-1-plus-7"
                  : autoGridCols(indicesToRender.length); // auto / libre fallback

                return (
                  <div className={`flex-1 min-h-0 grid gap-1 ${gridClass}`}>
                    {/* Custom grid templates + seek animation */}
                    <style dangerouslySetInnerHTML={{ __html: `
                      .grid-1-plus-5 {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        grid-template-rows: repeat(3, 1fr);
                      }
                      .grid-1-plus-5 > :nth-child(1) {
                        grid-column: span 2;
                        grid-row: span 2;
                      }
                      .grid-1-plus-7 {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        grid-template-rows: repeat(4, 1fr);
                      }
                      .grid-1-plus-7 > :nth-child(1) {
                        grid-column: span 3;
                        grid-row: span 3;
                      }
                      @keyframes wardis-seek-slide {
                        0%   { left: -45%; }
                        100% { left: 100%; }
                      }
                    ` }} />

                    {indicesToRender.map((idx) => {
                      const assignedCamId = slotAssignments[idx];
                      const camera = cameras.find((c) => c.id === assignedCamId);
                      const isSelected = getActiveSlotIndex() === idx;
                      const isAlarmActive = assignedCamId ? isCameraInAlarm(assignedCamId) : false;
                      const tilePlayback = getTilePlayback(idx);

                      return (
                        <div
                          key={idx}
                          draggable={!!assignedCamId}
                          onDragStart={(e) => handleTileDragStart(e, idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleTileDrop(e, idx)}
                          className={`group relative w-full h-full rounded-lg transition-all overflow-hidden ${
                            isAlarmActive
                              ? "ring-2 ring-control-red shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-pulse"
                              : ""
                          }`}
                        >
                          {assignedCamId && camera ? (
                            <>
                              <CameraPlayer
                                cameraId={assignedCamId}
                                cameraNom={camera.nom}
                                statut={camera.statut}
                                isZoomed={false}
                                isSelected={isSelected}
                                aspectRatioMode={aspectRatios[idx]}
                                onClear={() => handleClearSlot(idx)}
                                onClick={() => setSelectedSlotIndex(idx)}
                                onDoubleClick={() => setZoomedSlotIndex(idx)}
                                ptzSupported={camera.ptz_supported}
                                onTogglePTZ={() =>
                                  setPtzOpenSlots((prev) => ({ ...prev, [idx]: !prev[idx] }))
                                }
                                isPTZOpen={!!ptzOpenSlots[idx]}
                                seekOffsetSeconds={
                                  tilePlayback.isPlayback ? tilePlayback.seekOffsetSeconds : null
                                }
                                isPausedPlayback={tilePlayback.isPaused}
                              />
                              {/* Per-tile playback bar — shown on hover or while in playback mode */}
                              <TilePlaybackBar
                                isPlayback={tilePlayback.isPlayback}
                                seekOffsetSeconds={tilePlayback.seekOffsetSeconds}
                                isLoading={tilePlayback.isLoading}
                                isPaused={tilePlayback.isPaused}
                                onSeek={(offset) => handleTileSeek(idx, offset)}
                                onTogglePlayPause={() => handleToggleTilePlayPause(idx)}
                                onBackToLive={() => handleTileBackToLive(idx)}
                              />
                            </>
                          ) : layout !== "auto" ? (
                            /* Empty slot drop zone — hidden in Auto mode */
                            <div
                              onClick={() => setSelectedSlotIndex(idx)}
                              className={`relative w-full h-full bg-control-panel/40 border transition-all flex flex-col items-center justify-center p-4 text-center select-none rounded-lg ${
                                isSelected
                                  ? "border-control-cyan shadow-[0_0_15px_rgba(0,240,255,0.4)] z-10"
                                  : "border-dashed border-control-border hover:border-control-cyan/40"
                              }`}
                            >
                              {activePickerSlot === idx ? (
                                <div className="absolute inset-0 bg-control-bg/95 z-20 flex flex-col p-3 text-left overflow-y-auto rounded-lg">
                                  <div className="flex items-center justify-between border-b border-control-border pb-2 mb-2 shrink-0">
                                    <span className="text-xs text-control-text-bright font-semibold">
                                      Caméra — Emplacement {idx + 1}
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setActivePickerSlot(null); }}
                                      className="text-xs text-control-red hover:underline"
                                    >
                                      Fermer
                                    </button>
                                  </div>
                                  <div className="flex-1 space-y-1 overflow-y-auto">
                                    {cameras.map((cam) => {
                                      const isAssigned = slotAssignments.includes(cam.id);
                                      return (
                                        <button
                                          key={cam.id}
                                          disabled={isAssigned}
                                          onClick={(e) => { e.stopPropagation(); handleAssignCamera(idx, cam.id); }}
                                          className={`w-full text-left px-3 py-2 text-xs border flex items-center justify-between transition-all rounded ${
                                            isAssigned
                                              ? "border-transparent bg-control-panel-light/30 text-control-text/40 cursor-not-allowed"
                                              : "border-control-border bg-control-panel hover:bg-control-cyan/5 hover:border-control-cyan/35 text-control-text hover:text-control-text-bright cursor-pointer"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <span
                                              className={`h-2 w-2 rounded-full shrink-0 ${
                                                cam.statut === "active" ? "bg-control-green" : "bg-control-red"
                                              }`}
                                            />
                                            <span className="truncate">{cam.nom}</span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setActivePickerSlot(idx); }}
                                    className="p-3 border border-control-border bg-control-panel-light text-control-cyan/40 hover:text-control-cyan hover:border-control-cyan/50 hover:shadow-md transition-all cursor-pointer rounded-xl mb-2"
                                  >
                                    <Plus className="h-5 w-5" />
                                  </button>
                                  <div className="text-xs text-control-text-bright font-semibold">
                                    Emplacement {idx + 1}
                                  </div>
                                  <p className="text-xs text-control-text/60 mt-1 max-w-[160px] leading-relaxed">
                                    Glissez une caméra ici ou cliquez sur « + ».
                                  </p>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

          {/* Right Area: PTZ HUD Panel */}
          <div className="w-full lg:w-72 bg-control-panel border border-control-border rounded-xl p-4 font-mono select-none flex flex-col shrink-0 gap-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-control-border pb-2">
              <span className="text-xs text-control-text-bright font-bold uppercase tracking-wider font-mono">Slot Settings & PTZ</span>
              <span className="h-1.5 w-1.5 rounded-full bg-control-cyan animate-pulse" />
            </div>

            {selectedSlotIndex !== null && (
              <div className="flex flex-col gap-2.5 bg-control-panel-light/30 border border-control-border p-3 rounded-xl">
                <span className="text-[10px] text-control-text/50 uppercase font-bold tracking-wider">Slot {selectedSlotIndex + 1} Control</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleToggleAspectRatio(selectedSlotIndex)}
                    className="flex-1 py-1 border border-control-border hover:border-control-cyan/50 text-[9px] uppercase font-bold text-control-text transition-colors"
                  >
                    Aspect: {aspectRatios[selectedSlotIndex] === "contain" ? "Fit" : "Fill"}
                  </button>
                  <button
                    onClick={() => handleToggleSequence(selectedSlotIndex)}
                    className={`flex-1 py-1 border text-[9px] uppercase font-bold transition-colors ${
                      sequenceSettings[selectedSlotIndex]?.active
                        ? "border-control-cyan bg-control-cyan/10 text-control-cyan"
                        : "border-control-border hover:border-control-cyan/50 text-control-text"
                    }`}
                  >
                    Sequence: {sequenceSettings[selectedSlotIndex]?.active ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            )}

            {activeCamera ? (
              <div className="flex flex-col gap-1 text-[10px] bg-control-panel-light/40 border border-control-border p-2 rounded-xl">
                <div className="text-control-cyan font-bold uppercase truncate">
                  CAM // {activeCamera.nom}
                </div>
                <div className="text-control-text/60 text-[8px] truncate">
                  ID: {activeCamera.id}
                </div>
                <div className="text-control-text/60 text-[8px]">
                  STATUS: <span className="text-control-green font-bold uppercase">{activeCamera.statut}</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-control-text/40 italic bg-control-panel-light/20 border border-dashed border-control-border/60 p-3 text-center rounded-xl">
                No active camera in selected slot.
              </div>
            )}

            {/* D-Pad Directional PTZ Controls */}
            <div className="flex flex-col items-center gap-3 border-t border-b border-control-border/50 py-4">
              <span className="text-[9px] text-control-text/60 uppercase font-bold tracking-widest">PTZ Move</span>
              <div className="grid grid-cols-3 gap-2 w-36 h-36">
                <div />
                <button
                  disabled={!activeCameraId}
                  onMouseDown={() => activeCameraId && startPTZ(0, 1, 0)}
                  onMouseUp={stopPTZ}
                  onMouseLeave={stopPTZ}
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

            {/* Gamepad status */}
            <div className="border-t border-control-border/50 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[9px] text-control-text/60 uppercase font-bold tracking-widest">
                <span className="flex items-center gap-1.5">
                  <Gamepad className="h-3.5 w-3.5" />
                  <span>USB Gamepad</span>
                </span>
                <span className={`h-1.5 w-1.5 rounded-full ${isGamepadConnected ? "bg-control-green animate-pulse" : "bg-control-text/30"}`} />
              </div>
              <div className="bg-control-bg/60 border border-control-border p-2 text-[9px] font-mono rounded-xl">
                <div className="flex justify-between items-center text-control-text/50">
                  <span>STATUS:</span>
                  <span className={`font-bold ${isGamepadConnected ? "text-control-green" : "text-control-text/40"}`}>
                    {isGamepadConnected ? "CONNECTED" : "DISCONNECTED"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs font-mono">
          <div className="bg-control-panel border border-control-cyan/45 p-6 max-w-sm w-full rounded-xl shadow-2xl flex flex-col gap-4 text-xs">
            <h3 className="text-control-cyan font-bold uppercase tracking-wider text-sm">Save Named Layout View</h3>
            <p className="text-control-text/75 uppercase text-[9px]">Name your layout configuration to save it. You can bind it to hotkeys 1 to 9 for quick recall.</p>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g. Docks Monitoring"
              className="w-full bg-black border border-control-border px-3 py-2 text-control-text-bright rounded focus:border-control-cyan focus:outline-none"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-1.5 border border-control-border text-control-text hover:bg-control-panel-light uppercase font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveView}
                className="px-4 py-1.5 bg-control-cyan text-black hover:bg-control-cyan-light font-bold uppercase"
              >
                Save View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
