import React, { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";

const App: React.FC = () => {
  const { isAuthenticated, initialize } = useAuthStore();

  // Initialize auth credentials on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      {isAuthenticated ? <Dashboard /> : <Login />}
    </>
  );
};

export default App;
