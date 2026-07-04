import { create } from "zustand";
import { fetch } from "@tauri-apps/plugin-http";
import { getApiBase } from "./config";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  initialize: () => void;
  login: (serverUrl: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,

  initialize: () => {
    try {
      const storedToken = sessionStorage.getItem("wardis_token");
      const storedUser = sessionStorage.getItem("wardis_user");
      if (storedToken && storedUser) {
        set({
          token: storedToken,
          user: JSON.parse(storedUser),
          isAuthenticated: true,
        });
      }
    } catch (e) {
      console.error("Failed to load auth state from session storage", e);
    }
  },

  login: async (serverUrl, email, password) => {
    set({ loading: true, error: null });
    
    if (serverUrl.trim()) {
      localStorage.setItem("wardis-server-url", serverUrl.trim());
    }

    try {
      const apiBase = getApiBase();
      // 1. Post to login endpoint
      const response = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let errMsg = "Authentication failed";
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch {
          // Response body is not JSON or empty
        }
        throw new Error(errMsg);
      }

      const loginData = await response.json();
      const token = loginData.token;

      // 2. Fetch user profile from /me
      const profileResponse = await fetch(`${apiBase}/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch operator profile");
      }

      const userProfile: UserProfile = await profileResponse.json();

      // 3. Persist to sessionStorage and state
      sessionStorage.setItem("wardis_token", token);
      sessionStorage.setItem("wardis_user", JSON.stringify(userProfile));

      set({
        token,
        user: userProfile,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      return true;
    } catch (err: any) {
      set({
        error: err.message || "Connection to security gateway failed",
        loading: false,
        isAuthenticated: false,
        token: null,
        user: null,
      });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true });
    const currentToken = get().token;
    const apiBase = getApiBase();
    try {
      if (currentToken) {
        // Attempt logout call to backend
        await fetch(`${apiBase}/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentToken}`,
          },
        });
      }
    } catch (e) {
      console.warn("Logout request failed on backend", e);
    } finally {
      // Always wipe client-side credentials
      sessionStorage.removeItem("wardis_token");
      sessionStorage.removeItem("wardis_user");
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
