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
    <footer className="h-9 border-t border-control-border bg-control-panel flex items-center justify-between px-4 shrink-0 select-none text-xs text-control-text z-30">
      {/* Server Health & Diagnostics */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-control-cyan shrink-0" />
          <span className="text-control-text/70">{t("natsServer")}:</span>
          <span className={serverStatus === "stable" ? "text-control-green font-medium" : "text-control-red font-medium"}>
            {serverStatus === "stable" ? "OK" : "ERR"}
          </span>
          <span className="text-control-text/30">·</span>
          <span>{t("latency", { latency })}</span>
        </div>

        <div className="h-3.5 w-px bg-control-border" />

        {/* Disk Storage Status */}
        <div className="flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5 text-control-cyan shrink-0" />
          <span className="text-control-text/70">Stockage:</span>
          <span>{storageUsedPercent}%</span>
          <div className="w-16 h-1.5 bg-control-panel-light rounded-full overflow-hidden">
            <div
              style={{ width: `${storageUsedPercent}%` }}
              className={`h-full rounded-full transition-all ${storageUsedPercent > 85 ? "bg-control-red" : "bg-control-cyan"}`}
            />
          </div>
        </div>
      </div>

      {/* Selected Item Telemetry */}
      <div className="flex items-center gap-2">
        {selectedTileTelemetry && selectedTileTelemetry.cameraName ? (
          <div className="flex items-center gap-2 text-control-cyan bg-control-cyan/8 border border-control-cyan/15 px-2.5 py-1 rounded-full">
            <ZoomIn className="h-3 w-3 shrink-0" />
            <span className="font-medium">{selectedTileTelemetry.cameraName}</span>
            <span className="text-control-text/30">·</span>
            <span>{selectedTileTelemetry.resolution || "1080p"}</span>
            <span className="text-control-text/30">·</span>
            <span>{selectedTileTelemetry.fps || 30} fps</span>
            {selectedTileTelemetry.zoom && (
              <>
                <span className="text-control-text/30">·</span>
                <span>×{selectedTileTelemetry.zoom.toFixed(1)}</span>
              </>
            )}
          </div>
        ) : (
          <span className="text-control-text/40 italic text-[11px]">Aucun flux sélectionné</span>
        )}
      </div>

      {/* Cameras Status */}
      <div className="flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5 text-control-cyan shrink-0" />
        <span className="text-control-text/70">{t("activeCameras")} :</span>
        <span className="text-control-text-bright font-medium">{camerasOnline}</span>
        <span className="text-control-text/40">/</span>
        <span className="text-control-text/60">{camerasCount}</span>
      </div>
    </footer>
  );
};
