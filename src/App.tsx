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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("wardis-theme", theme);
      document.documentElement.classList.remove("theme-dark", "theme-light");
      document.documentElement.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    }
  }, [theme]);

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
    return (
      <div className={`h-screen w-screen bg-control-bg p-6 overflow-auto ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
        {tabType === "live" && <LiveView />}
        {tabType === "access" && <AccessControl />}
        {tabType === "alarms" && <Alarms />}
        {tabType === "events" && <Events />}
        {tabType === "map" && <InteractiveMap />}
        {tabType === "camera-config" && <CameraConfig />}
        {tabType === "users" && <UserManagement />}
        {tabType === "settings" && <UserSettings theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />}
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "theme-dark" : "theme-light"}>
      {isAuthenticated ? (
        <Dashboard theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      ) : (
        <Login theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      )}
    </div>
  );
};

export default App;
