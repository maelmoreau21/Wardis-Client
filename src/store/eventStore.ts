import { create } from "zustand";
import { fetch } from "@tauri-apps/plugin-http";
import { useAuthStore } from "./authStore";

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

const API_BASE = "http://localhost:8080";
let eventSource: EventSource | null = null;

export const useEventStore = create<EventState>((set) => ({
  events: [],
  sseConnected: false,
  loading: false,
  error: null,

  fetchEvents: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/events`, {
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
    const token = useAuthStore.getState().token;
    if (!token) return;
    if (eventSource) return;

    const url = `${API_BASE}/events/stream?token=${encodeURIComponent(token)}`;
    eventSource = new EventSource(url);
    set({ sseConnected: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("SSE eventStore event received:", data);

        // Standardize event details parsing
        let eventType = data.event_type || "system.info";
        let timestamp = data.timestamp || data.created_at || new Date().toISOString();
        let siteId = data.site_id || data.details?.payload?.site_id || data.details?.site_id || data.details?.door?.site_id;
        let zoneId = data.zone_id || data.details?.payload?.zone_id || data.details?.alarm?.zone_id;
        let cameraId = data.camera_id || data.details?.payload?.camera_id || data.details?.camera_id || data.details?.correlation?.camera_id;
        let badgeNum = data.badge_number || data.details?.payload?.badge_number || data.details?.badge_number || data.details?.correlation?.badge_number;

        let message = data.message || "";
        if (!message) {
          if (eventType === "alarm.correlated") {
            const camName = data.details?.camera_name || "Camera";
            const badge = badgeNum ? `Badge #${badgeNum}` : "No Badge Scanned";
            message = `ALARM CORRELATION: Alarm in Zone [${data.details?.zone_name || "Unknown"}] matched with ${camName} & operator ${badge}`;
          } else if (eventType.startsWith("access.")) {
            const isGranted = eventType === "access.granted";
            const doorName = data.details?.door_name || "Terminal";
            message = `Access attempt ${isGranted ? "GRANTED" : "DENIED"} for Badge #${badgeNum || "unknown"} at Door [${doorName}]`;
          } else if (eventType === "alarm.triggered") {
            const zoneName = data.details?.zone_name || "Zone";
            const sensorName = data.details?.sensor_name || "Sensor";
            message = `SECURITY ALARM TRIGGERED: ${sensorName} in ${zoneName}`;
          } else if (eventType.startsWith("video.") || eventType.startsWith("camera.")) {
            const camName = data.details?.camera_name || "Surveillance feed";
            message = `Motion event recorded on camera [${camName}]`;
          } else {
            message = `Telemetry log received: [${eventType}] payload recorded`;
          }
        }

        const newEvent: CorrelatedEvent = {
          id: data.id || Math.random().toString(),
          event_type: eventType,
          message: message,
          site_id: siteId,
          zone_id: zoneId,
          camera_id: cameraId,
          badge_number: badgeNum,
          timestamp: timestamp,
          details: data.details || data
        };

        set((state) => {
          // Deduplicate events
          if (state.events.some(e => e.id === newEvent.id)) {
            return state;
          }
          return {
            events: [newEvent, ...state.events].slice(0, 200)
          };
        });
      } catch (err) {
        console.error("Failed to parse incoming SSE message", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE events connection error", err);
      set({ sseConnected: false });
    };
  },

  disconnectEventStream: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ sseConnected: false });
  },

  clearEvents: () => set({ events: [] }),
  clearError: () => set({ error: null }),
}));
