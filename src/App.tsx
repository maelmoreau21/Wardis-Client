import React, { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { DetachedCameraPlayer } from "./components/DetachedCameraPlayer";

const App: React.FC = () => {
  const { isAuthenticated, initialize } = useAuthStore();

  // Parse query parameters for detached multi-window mode
  const queryParams = new URLSearchParams(window.location.search);
  const isDetached = queryParams.get("detached") === "true";
  const cameraId = queryParams.get("cameraId");
  const token = queryParams.get("token");
  const nom = queryParams.get("nom");
  const statut = queryParams.get("statut");

  useEffect(() => {
    if (isDetached && token) {
      // Direct injection of token for detached session context
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
    <>
      {isAuthenticated ? <Dashboard /> : <Login />}
    </>
  );
};

export default App;
