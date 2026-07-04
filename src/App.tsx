import React, { useEffect, useState } from "react";
import { useAuthStore } from "./store/authStore";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { DetachedCameraPlayer } from "./components/DetachedCameraPlayer";

// Task Views for general window detachment
import { LiveView } from "./components/LiveView";
import { AccessControl } from "./components/AccessControl";
import { Alarms } from "./components/Alarms";
import { Events } from "./components/Events";
import { InteractiveMap } from "./components/InteractiveMap";
import { UserSettings } from "./components/UserSettings";
import { UserManagement } from "./components/UserManagement";
import { CameraConfig } from "./components/CameraConfig";

// Multi-window and layout persistence imports
import { DetachedHeader } from "./components/DetachedHeader";
import { getCurrentWebviewWindow, getAllWebviewWindows, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { loadSavedLayout, registerSpawnedWindow, type SavedWindow } from "./store/layoutManager";
import { useAlarmStore } from "./store/alarmStore";
import { useCameraStore } from "./store/cameraStore";
import { useAccessControlStore } from "./store/accessControlStore";
import { Sparkles } from "lucide-react";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";

const App: React.FC = () => {
  const { isAuthenticated, initialize } = useAuthStore();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("wardis-theme") === "light" ? "light" : "dark";
  });

  const queryParams = new URLSearchParams(window.location.search);
  const isDetached = queryParams.get("detached") === "true";
  const tabType = queryParams.get("tabType");
  const cameraId = queryParams.get("cameraId");
  const token = queryParams.get("token");
  const nom = queryParams.get("nom");
  const statut = queryParams.get("statut");

  // Alarms and camera synchronization for detached webview instances
  const connectEventStream = useAlarmStore(state => state.connectEventStream);
  const disconnectEventStream = useAlarmStore(state => state.disconnectEventStream);
  const fetchCameras = useCameraStore(state => state.fetchCameras);
  const fetchDoors = useAccessControlStore(state => state.fetchDoors);

  const [savedLayout, setSavedLayout] = useState<SavedWindow[]>([]);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("wardis-theme", theme);
      document.documentElement.classList.remove("theme-dark", "theme-light");
      document.documentElement.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    }
  }, [theme]);

  // Connect backend event streams if in a detached window
  useEffect(() => {
    if (isDetached) {
      connectEventStream();
      fetchCameras().catch(() => {});
      fetchDoors().catch(() => {});
      return () => {
        disconnectEventStream();
      };
    }
  }, [isDetached, connectEventStream, disconnectEventStream, fetchCameras, fetchDoors]);

  // Keyboard shortcut to cycle focus between open windows (Ctrl + Alt + w)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        try {
          const allWindows = await getAllWebviewWindows();
          if (allWindows.length <= 1) return;
          
          const currentWin = getCurrentWebviewWindow();
          const index = allWindows.findIndex(w => w.label === currentWin.label);
          if (index !== -1) {
            const nextIndex = (index + 1) % allWindows.length;
            await allWindows[nextIndex].setFocus();
          }
        } catch (err) {
          console.error("Failed to cycle focus between windows:", err);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Check for saved layout on startup (in main window only)
  useEffect(() => {
    if (isAuthenticated && !isDetached) {
      const checkLayout = async () => {
        const layout = await loadSavedLayout();
        // If there are secondary windows in the saved layout, prompt the user
        const hasSecondaryWindows = layout.some(w => w.label !== "main");
        if (hasSecondaryWindows) {
          setSavedLayout(layout);
          setShowRestorePrompt(true);
        }
      };
      // Short delay to ensure Tauri API is ready
      setTimeout(checkLayout, 800);
    }
  }, [isAuthenticated, isDetached]);

  useEffect(() => {
    if (isDetached && token) {
      useAuthStore.setState({
        token: token,
        isAuthenticated: true,
      });
    } else {
      initialize();
    }
  }, [initialize, isDetached, token]);

  const handleRestoreLayout = async () => {
    setShowRestorePrompt(false);
    const activeToken = useAuthStore.getState().token;
    
    for (const winData of savedLayout) {
      if (winData.label === "main") {
        try {
          const mainWin = getCurrentWebviewWindow();
          await mainWin.setPosition(new PhysicalPosition(winData.x, winData.y));
          await mainWin.setSize(new PhysicalSize(winData.width, winData.height));
          if (winData.isFullscreen) {
            await mainWin.setFullscreen(true);
          }
        } catch (e) {
          console.error("Failed to restore main window coordinates:", e);
        }
        continue;
      }

      // Detached window
      let url = "";
      if (winData.type === "camera") {
        url = `index.html?detached=true&cameraId=${winData.cameraId}&token=${encodeURIComponent(activeToken || "")}&nom=${encodeURIComponent(winData.cameraNom || "")}&statut=${winData.statut || ""}`;
      } else {
        url = `index.html?detached=true&tabType=${winData.tabType}&token=${encodeURIComponent(activeToken || "")}`;
      }

      try {
        registerSpawnedWindow({
          label: winData.label,
          type: winData.type,
          tabType: winData.tabType,
          cameraId: winData.cameraId,
          cameraNom: winData.cameraNom,
          statut: winData.statut
        });

        const webview = new WebviewWindow(winData.label, {
          url,
          title: winData.type === "camera" ? `Wardis Live - ${winData.cameraNom}` : `Wardis Workspace - ${winData.tabType}`,
          x: winData.x,
          y: winData.y,
          width: winData.width,
          height: winData.height,
          fullscreen: winData.isFullscreen,
        });

        webview.once("tauri://created", async () => {
          if (winData.isAlwaysOnTop) {
            await webview.setAlwaysOnTop(true);
          }
        });
      } catch (err) {
        console.error(`Failed to restore detached window ${winData.label}:`, err);
      }
    }
  };

  // Handle detached camera player (individual stream monitor)
  if (isDetached && cameraId && nom && statut) {
    return (
      <DetachedCameraPlayer
        cameraId={cameraId}
        cameraNom={nom}
        statut={statut}
      />
    );
  }

  // Handle general detached task workspace views (monitoring panel, alarms center, maps etc.)
  if (isDetached && tabType) {
    const formattedTitle = tabType === "live" ? "VMS Live View" :
                          tabType === "alarms" ? "Centre d'Alarmes" :
                          tabType === "access" ? "Contrôle d'Accès" :
                          tabType === "events" ? "Journal des Événements" :
                          tabType === "map" ? "Cartographie Interactive" : "Console Wardis";
    return (
      <div className={`h-screen w-screen bg-control-bg flex flex-col overflow-hidden ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
        <DetachedHeader title={`Wardis Detached Workspace // ${formattedTitle}`} />
        <div className="flex-1 overflow-auto p-6">
          {tabType === "live" && <LiveView />}
          {tabType === "access" && <AccessControl />}
          {tabType === "alarms" && <Alarms />}
          {tabType === "events" && <Events />}
          {tabType === "map" && <InteractiveMap />}
          {tabType === "camera-config" && <CameraConfig />}
          {tabType === "users" && <UserManagement />}
          {tabType === "settings" && <UserSettings theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      {isAuthenticated ? (
        <>
          <Dashboard theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
          
          {/* Floating Layout Restoration Banner */}
          {showRestorePrompt && (
            <div className="fixed bottom-6 right-6 z-[9999] max-w-sm rounded-xl border border-control-cyan/45 bg-control-panel/90 p-4 font-mono text-xs text-control-text shadow-[0_0_20px_rgba(0,240,255,0.15)] backdrop-blur-md flex flex-col gap-3 animate-fade-in select-none">
              <div className="flex items-center gap-2 text-control-cyan">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span className="font-bold uppercase tracking-wider">Configuration Détectée</span>
              </div>
              <p className="text-[10px] uppercase text-control-text/70 tracking-wider">
                Une disposition multi-écrans précédente a été trouvée. Souhaitez-vous la restaurer ?
              </p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={handleRestoreLayout}
                  className="flex-1 py-1.5 bg-control-cyan hover:bg-control-cyan-light text-black font-bold uppercase tracking-widest transition-all cursor-pointer text-center rounded"
                >
                  Restaurer
                </button>
                <button
                  onClick={() => setShowRestorePrompt(false)}
                  className="px-3 py-1.5 border border-control-border hover:bg-control-panel-light text-control-text hover:text-control-text-bright font-bold uppercase tracking-wider transition-all cursor-pointer rounded"
                >
                  Ignorer
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Login theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      )}
    </div>
  );
};

export default App;
