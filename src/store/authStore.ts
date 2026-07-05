import { create } from "zustand";
import { getApiBase, safeFetch } from "./config";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  mfa_enabled: boolean;
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  mfaRequired: boolean;
  mfaToken: string | null;
  initialize: () => void;
  login: (serverUrl: string, email: string, password: string) => Promise<boolean>;
  loginMfa: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setMfaState: (required: boolean, token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
  mfaRequired: false,
  mfaToken: null,

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
    set({ loading: true, error: null, mfaRequired: false, mfaToken: null });
    
    if (serverUrl.trim()) {
      localStorage.setItem("wardis-server-url", serverUrl.trim());
    }

    try {
      const apiBase = getApiBase();
      const response = await safeFetch(`${apiBase}/login`, {
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

      // Check if Multi-Factor Authentication is required
      if (loginData.mfa_required) {
        set({
          mfaRequired: true,
          mfaToken: loginData.mfa_token,
          loading: false,
          error: null,
        });
        return false;
      }

      const token = loginData.token;

      // Fetch user profile from /me
      const profileResponse = await safeFetch(`${apiBase}/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch operator profile");
      }

      const userProfile: UserProfile = await profileResponse.json();

      // Persist to sessionStorage and state
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
        mfaRequired: false,
        mfaToken: null,
      });
      return false;
    }
  },

  loginMfa: async (code) => {
    const { mfaToken } = get();
    if (!mfaToken) {
      set({ error: "Authentication session expired. Please log in again." });
      return false;
    }

    set({ loading: true, error: null });

    try {
      const apiBase = getApiBase();
      const response = await safeFetch(`${apiBase}/login/mfa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mfa_token: mfaToken, code }),
      });

      if (!response.ok) {
        let errMsg = "MFA verification failed";
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch {
          // Empty or non-JSON
        }
        throw new Error(errMsg);
      }

      const loginData = await response.json();
      const token = loginData.token;

      // Fetch user profile from /me
      const profileResponse = await safeFetch(`${apiBase}/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch operator profile");
      }

      const userProfile: UserProfile = await profileResponse.json();

      // Persist
      sessionStorage.setItem("wardis_token", token);
      sessionStorage.setItem("wardis_user", JSON.stringify(userProfile));

      set({
        token,
        user: userProfile,
        isAuthenticated: true,
        loading: false,
        error: null,
        mfaRequired: false,
        mfaToken: null,
      });

      return true;
    } catch (err: any) {
      set({
        error: err.message || "MFA validation failed",
        loading: false,
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
        await safeFetch(`${apiBase}/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentToken}`,
          },
        });
      }
    } catch (e) {
      console.warn("Logout request failed on backend", e);
    } finally {
      sessionStorage.removeItem("wardis_token");
      sessionStorage.removeItem("wardis_user");
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        mfaRequired: false,
        mfaToken: null,
      });
    }
  },

  clearError: () => set({ error: null }),
  setMfaState: (required, token) => set({ mfaRequired: required, mfaToken: token }),
}));
