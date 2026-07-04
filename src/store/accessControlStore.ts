import { create } from "zustand";
import { useAuthStore } from "./authStore";
import { getApiBase, safeFetch } from "./config";

export interface Door {
  id: string;
  site_id: string;
  zone_id?: string;
  name: string;
  description: string;
  status: "open" | "closed" | "forced" | "held_open";
  created_at: string;
}

export interface Cardholder {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  photo: string;
  access_group: string;
  schedule: string;
  badge_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AccessLog {
  id: string;
  badge_id?: string;
  badge_number: string;
  door_id?: string;
  site_id?: string;
  user_id?: string;
  cardholder_id?: string;
  cardholder_name?: string;
  cardholder_photo?: string;
  access_type: "granted" | "denied";
  denied_reason?: string;
  created_at: string;
}

interface AccessControlState {
  doors: Door[];
  logs: AccessLog[];
  cardholders: Cardholder[];
  loading: boolean;
  error: string | null;
  fetchDoors: () => Promise<void>;
  openDoor: (doorId: string) => Promise<void>;
  closeDoor: (doorId: string) => Promise<void>;
  fetchAccessLogs: () => Promise<void>;
  fetchCardholders: () => Promise<void>;
  createCardholder: (cardholder: Omit<Cardholder, "id">) => Promise<void>;
  updateCardholder: (id: string, cardholder: Omit<Cardholder, "id">) => Promise<void>;
  deleteCardholder: (id: string) => Promise<void>;
  swipeBadgeSimulated: (doorId: string, badgeNumber: string) => Promise<void>;
  setDoorStatusSimulated: (doorId: string, status: "open" | "closed" | "forced" | "held_open") => void;
  clearError: () => void;
}

export const useAccessControlStore = create<AccessControlState>((set, get) => ({
  doors: [],
  logs: [],
  cardholders: [],
  loading: false,
  error: null,

  fetchDoors: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await safeFetch(`${getApiBase()}/doors`, {
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
      const response = await safeFetch(`${getApiBase()}/doors/${doorId}/open`, {
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
      const response = await safeFetch(`${getApiBase()}/doors/${doorId}/close`, {
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
      const response = await safeFetch(`${getApiBase()}/access-logs`, {
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

  fetchCardholders: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await safeFetch(`${getApiBase()}/cardholders`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch cardholders list");
      }

      const data = await response.json();
      set({ cardholders: data || [], loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load cardholders", loading: false });
    }
  },

  createCardholder: async (cardholder: Omit<Cardholder, "id">) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await safeFetch(`${getApiBase()}/cardholders`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cardholder),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create cardholder");
      }

      const newCh = await response.json();
      set({
        cardholders: [newCh, ...get().cardholders],
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to create cardholder", loading: false });
      throw err;
    }
  },

  updateCardholder: async (id: string, cardholder: Omit<Cardholder, "id">) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await safeFetch(`${getApiBase()}/cardholders/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cardholder),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update cardholder");
      }

      const updatedCh = await response.json();
      set({
        cardholders: get().cardholders.map((ch) => (ch.id === id ? updatedCh : ch)),
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to update cardholder", loading: false });
      throw err;
    }
  },

  deleteCardholder: async (id: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await safeFetch(`${getApiBase()}/cardholders/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete cardholder");
      }

      set({
        cardholders: get().cardholders.filter((ch) => ch.id !== id),
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to delete cardholder", loading: false });
      throw err;
    }
  },

  swipeBadgeSimulated: async (doorId: string, badgeNumber: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      await safeFetch(`${getApiBase()}/doors/${doorId}/swipe`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ badge_number: badgeNumber }),
      });

      // Reload lists to show new swipe details
      await get().fetchAccessLogs();
      await get().fetchDoors();
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to simulate badge swipe", loading: false });
    }
  },

  // Custom client-side simulation helper to toggle between forced, held_open, open, closed
  setDoorStatusSimulated: (doorId: string, status: "open" | "closed" | "forced" | "held_open") => {
    const updatedDoors = get().doors.map((door) =>
      door.id === doorId ? { ...door, status } : door
    );
    set({ doors: updatedDoors });
  },

  clearError: () => set({ error: null }),
}));
