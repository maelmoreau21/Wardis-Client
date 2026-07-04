import React, { useEffect, useState, useRef } from "react";
import { availableMonitors, getCurrentWindow, type Monitor } from "@tauri-apps/api/window";
import { 
  Monitor as MonitorIcon, 
  Maximize2, 
  Minimize2,
  Pin, 
  EyeOff, 
  Eye, 
  X, 
  ChevronDown
} from "lucide-react";

interface DetachedHeaderProps {
  title: string;
}

export const DetachedHeader: React.FC<DetachedHeaderProps> = ({ title }) => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [currentMon, setCurrentMon] = useState<Monitor | null>(null);
  const [showMonitorDropdown, setShowMonitorDropdown] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hideCursorOnInactivity, setHideCursorOnInactivity] = useState(false);
  
  const mouseTimeoutRef = useRef<number | null>(null);

  // Initialize monitor list
  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        const list = await availableMonitors();
        setMonitors(list);
        
        // Try to get the monitor this window is currently on
        const win = getCurrentWindow();
        const current = await (win as any).currentMonitor();
        setCurrentMon(current);
      } catch (err) {
        console.error("Failed to fetch monitors:", err);
      }
    };
    fetchMonitors();
  }, []);

  // Handle cursor hiding on inactivity
  useEffect(() => {
    if (!hideCursorOnInactivity) {
      document.body.style.cursor = "default";
      if (mouseTimeoutRef.current) {
        window.clearTimeout(mouseTimeoutRef.current);
      }
      return;
    }

    const handleMouseMove = () => {
      document.body.style.cursor = "default";
      if (mouseTimeoutRef.current) {
        window.clearTimeout(mouseTimeoutRef.current);
      }
      mouseTimeoutRef.current = window.setTimeout(() => {
        document.body.style.cursor = "none";
      }, 3000); // 3 seconds of inactivity
    };

    window.addEventListener("mousemove", handleMouseMove);
    handleMouseMove(); // Initial trigger

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (mouseTimeoutRef.current) {
        window.clearTimeout(mouseTimeoutRef.current);
      }
      document.body.style.cursor = "default";
    };
  }, [hideCursorOnInactivity]);

  const handleSendToMonitor = async (monitor: Monitor, index: number) => {
    setShowMonitorDropdown(false);
    try {
      const win = getCurrentWindow();
      
      // Unmaximize first to allow sizing/positioning
      if (await win.isMaximized()) {
        await win.unmaximize();
      }
      
      // Position and size window to cover this monitor
      await win.setPosition(monitor.position);
      await win.setSize(monitor.size);
      
      setCurrentMon(monitor);
      console.log(`Window sent to Monitor ${index + 1}:`, monitor.name);
    } catch (err) {
      console.error("Failed to send window to monitor:", err);
    }
  };

  const toggleAlwaysOnTop = async () => {
    try {
      const win = getCurrentWindow();
      const nextState = !isAlwaysOnTop;
      await win.setAlwaysOnTop(nextState);
      setIsAlwaysOnTop(nextState);
    } catch (err) {
      console.error("Failed to toggle always on top:", err);
    }
  };

  const toggleFullscreen = async () => {
    try {
      const win = getCurrentWindow();
      const nextState = !isFullscreen;
      await win.setFullscreen(nextState);
      setIsFullscreen(nextState);
    } catch (err) {
      console.error("Failed to toggle fullscreen:", err);
    }
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (err) {
      console.error("Failed to close window:", err);
    }
  };

  return (
    <div className="h-10 bg-control-panel border-b border-control-border px-4 flex items-center justify-between font-mono shrink-0 select-none relative z-50">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-control-text-bright">
          {title}
        </span>
        {currentMon && (
          <span className="text-[8px] bg-control-cyan/10 border border-control-cyan/35 text-control-cyan px-1.5 py-0.5 font-bold uppercase tracking-widest text-nowrap">
            {(currentMon.name ? currentMon.name.replace("\\\\.\\", "") : "Screen")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Send to Monitor Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMonitorDropdown(!showMonitorDropdown)}
            className="flex items-center gap-1.5 px-2 py-1 border border-control-border hover:border-control-cyan/50 hover:bg-control-cyan/5 text-control-text hover:text-control-text-bright text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer"
          >
            <MonitorIcon className="h-3.5 w-3.5" />
            <span>Écran</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {showMonitorDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMonitorDropdown(false)} />
              <div className="absolute right-0 mt-1 w-56 rounded bg-control-panel border border-control-border shadow-xl p-1 z-50 flex flex-col gap-0.5">
                <p className="text-[8px] uppercase tracking-wider font-bold text-control-text/60 px-2 py-1 border-b border-control-border/50 mb-1">
                  Sélectionner un moniteur
                </p>
                {monitors.map((mon, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendToMonitor(mon, idx)}
                    className="flex items-center justify-between w-full rounded px-2 py-1.5 text-[10px] text-left font-bold uppercase tracking-wider hover:bg-control-panel-light hover:text-control-text-bright text-control-text transition cursor-pointer"
                  >
                    <span className="truncate">{(mon.name ? mon.name.replace("\\\\.\\", "") : `Écran ${idx + 1}`)}</span>
                    <span className="text-[8px] text-control-text/40">{mon.size.width}x{mon.size.height}</span>
                  </button>
                ))}
                {monitors.length === 0 && (
                  <div className="text-[9px] text-control-text/40 italic p-2">Aucun écran trouvé</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Kiosk / Window Controls */}
        <button
          onClick={toggleAlwaysOnTop}
          className={`p-1.5 border transition-all cursor-pointer ${
            isAlwaysOnTop 
              ? "border-control-cyan bg-control-cyan/10 text-control-cyan" 
              : "border-control-border text-control-text hover:text-control-cyan hover:border-control-cyan/55"
          }`}
          title={isAlwaysOnTop ? "Toujours au premier plan (Actif)" : "Toujours au premier plan (Inactif)"}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => setHideCursorOnInactivity(!hideCursorOnInactivity)}
          className={`p-1.5 border transition-all cursor-pointer ${
            hideCursorOnInactivity 
              ? "border-control-cyan bg-control-cyan/10 text-control-cyan" 
              : "border-control-border text-control-text hover:text-control-cyan hover:border-control-cyan/55"
          }`}
          title={hideCursorOnInactivity ? "Masquer le curseur (Actif)" : "Masquer le curseur (Inactif)"}
        >
          {hideCursorOnInactivity ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>

        <button
          onClick={toggleFullscreen}
          className={`p-1.5 border transition-all cursor-pointer ${
            isFullscreen 
              ? "border-control-cyan bg-control-cyan/10 text-control-cyan" 
              : "border-control-border text-control-text hover:text-control-cyan hover:border-control-cyan/55"
          }`}
          title="Plein écran (Kiosque)"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>

        <button
          onClick={handleClose}
          className="p-1.5 border border-control-red/60 bg-control-red/5 text-control-red hover:bg-control-red/25 hover:border-control-red transition-all cursor-pointer ml-1"
          title="Fermer la fenêtre"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
