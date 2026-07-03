import { create } from "zustand";
import { fetch } from "@tauri-apps/plugin-http";
import { useAuthStore } from "./authStore";

export interface Door {
  id: string;
  site_id: string;
  name: string;
  description: string;
  status: "open" | "closed";
  created_at: string;
}

export interface AccessLog {
  id: string;
  badge_id?: string;
  badge_number: string;
  door_id?: string;
  site_id?: string;
  user_id?: string;
  access_type: "granted" | "denied";
  denied_reason?: string;
  created_at: string;
}

interface AccessControlState {
  doors: Door[];
  logs: AccessLog[];
  loading: boolean;
  error: string | null;
  fetchDoors: () => Promise<void>;
  openDoor: (doorId: string) => Promise<void>;
  closeDoor: (doorId: string) => Promise<void>;
  fetchAccessLogs: () => Promise<void>;
  clearError: () => void;
}

const API_BASE = "http://localhost:8080";

export const useAccessControlStore = create<AccessControlState>((set, get) => ({
  doors: [],
  logs: [],
  loading: false,
  error: null,

  fetchDoors: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/doors`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch doors list");
      }

      const data = await response.json();
      set({ doors: data || [], loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load doors", loading: false });
    }
  },

  openDoor: async (doorId: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/doors/${doorId}/open`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to open door");
      }

      // Update state locally
      const updatedDoors = get().doors.map((door) =>
        door.id === doorId ? { ...door, status: "open" as const } : door
      );
      set({ doors: updatedDoors, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to open door", loading: false });
      throw err;
    }
  },

  closeDoor: async (doorId: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/doors/${doorId}/close`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to close door");
      }

      // Update state locally
      const updatedDoors = get().doors.map((door) =>
        door.id === doorId ? { ...door, status: "closed" as const } : door
      );
      set({ doors: updatedDoors, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to close door", loading: false });
      throw err;
    }
  },

  fetchAccessLogs: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/access-logs`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch access logs");
      }

      const data = await response.json();
      set({ logs: data || [], loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load access logs", loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
