import React from "react";
import { Cpu, HardDrive, Camera, ZoomIn } from "lucide-react";

interface StatusBarProps {
  serverStatus: "stable" | "degraded" | "offline";
  latency: number;
  camerasCount: number;
  camerasOnline: number;
  storageUsedPercent?: number;
  selectedTileTelemetry?: {
    cameraName?: string;
    fps?: number;
    resolution?: string;
    zoom?: number;
  };
  t: (key: string, vars?: any) => string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  serverStatus,
  latency,
  camerasCount,
  camerasOnline,
  storageUsedPercent = 42,
  selectedTileTelemetry,
  t
}) => {
  return (
    <footer className="h-7 border-t border-control-border bg-control-panel flex items-center justify-between px-3 shrink-0 select-none text-[10px] font-bold text-control-text uppercase tracking-wider z-30">
      {/* Server Health & Diagnostics */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-control-cyan" />
          <span>{t("natsServer")}: </span>
          <span className={serverStatus === "stable" ? "text-control-green" : "text-control-red"}>
            {serverStatus === "stable" ? "OK" : "ERR"}
          </span>
          <span className="text-control-text/45">|</span>
          <span>{t("latency", { latency })}</span>
        </div>

        <div className="h-3 w-[1px] bg-control-border" />

        {/* Disk Storage Status */}
        <div className="flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5 text-control-cyan" />
          <span>Storage: {storageUsedPercent}%</span>
          <div className="w-16 h-1.5 bg-control-panel-light border border-control-border rounded overflow-hidden">
            <div 
              style={{ width: `${storageUsedPercent}%` }} 
              className={`h-full ${storageUsedPercent > 85 ? "bg-control-red" : "bg-control-cyan"}`} 
            />
          </div>
        </div>
      </div>

      {/* Selected Item Telemetry */}
      <div className="flex items-center gap-2">
        {selectedTileTelemetry && selectedTileTelemetry.cameraName ? (
          <div className="flex items-center gap-2 text-control-cyan bg-control-cyan/5 border border-control-cyan/20 px-2 py-0.5 rounded">
            <ZoomIn className="h-3 w-3" />
            <span>{selectedTileTelemetry.cameraName}</span>
            <span className="text-control-text/30">•</span>
            <span>{selectedTileTelemetry.resolution || "1080p"}</span>
            <span className="text-control-text/30">•</span>
            <span>{selectedTileTelemetry.fps || 30} FPS</span>
            {selectedTileTelemetry.zoom && (
              <>
                <span className="text-control-text/30">•</span>
                <span>Zoom: {selectedTileTelemetry.zoom.toFixed(1)}x</span>
              </>
            )}
          </div>
        ) : (
          <span className="text-control-text/40">No Stream Selected</span>
        )}
      </div>

      {/* Cameras Status summary */}
      <div className="flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5 text-control-cyan" />
        <span>{t("activeCameras")}:</span>
        <span className="text-control-text-bright">{camerasOnline}</span>
        <span className="text-control-text/40">/</span>
        <span className="text-control-text/70">{camerasCount}</span>
      </div>
    </footer>
  );
};
