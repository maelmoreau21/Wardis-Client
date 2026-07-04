import React, { useEffect, useState } from "react";
import { useAuthStore } from "./store/authStore";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { DetachedCameraPlayer } from "./components/DetachedCameraPlayer";

const App: React.FC = () => {
  const { isAuthenticated, initialize } = useAuthStore();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("wardis-theme") === "light" ? "light" : "dark";
  });

  const queryParams = new URLSearchParams(window.location.search);
  const isDetached = queryParams.get("detached") === "true";
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

  if (isDetached && cameraId && nom && statut) {
    return (
      <DetachedCameraPlayer
        cameraId={cameraId}
        cameraNom={nom}
        statut={statut}
      />
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
