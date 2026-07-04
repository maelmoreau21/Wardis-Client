import { create } from "zustand";
import { fetch } from "@tauri-apps/plugin-http";
import { useAuthStore } from "./authStore";
import { getApiBase } from "./config";
import { connectWebSocket, disconnectWebSocket } from "./websocketService";

export interface CorrelatedEvent {
  id: string;
  event_type: string; // e.g. "alarm.triggered", "access.granted", "access.denied", "video.motion", "alarm.correlated"
  message: string;
  site_id?: string;
  zone_id?: string;
  camera_id?: string;
  badge_number?: string;
  timestamp: string;
  details?: any;
}

interface EventState {
  events: CorrelatedEvent[];
  sseConnected: boolean;
  loading: boolean;
  error: string | null;
  fetchEvents: () => Promise<void>;
  connectEventStream: () => void;
  disconnectEventStream: () => void;
  clearEvents: () => void;
  clearError: () => void;
}


export const useEventStore = create<EventState>((set) => ({
  events: [],
  sseConnected: false,
  loading: false,
  error: null,

  fetchEvents: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${getApiBase()}/events`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch event logs history");
      }

      const data = await response.json();
      set({ events: data || [], loading: false });
    } catch (err: any) {
      console.warn("Could not load historical events from backend:", err.message);
      // Fail silently or set error, but don't disrupt the app
      set({ loading: false });
    }
  },

  connectEventStream: () => {
    connectWebSocket();
    set({ sseConnected: true });
  },

  disconnectEventStream: () => {
    disconnectWebSocket();
    set({ sseConnected: false });
  },

  clearEvents: () => set({ events: [] }),
  clearError: () => set({ error: null }),
}));
