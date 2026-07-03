import { create } from "zustand";
import { fetch } from "@tauri-apps/plugin-http";
import { useAuthStore } from "./authStore";

export interface Zone {
  id: string;
  nom: string;
  description?: string;
  statut: "arme" | "desarme";
  created_at: string;
}

export interface Capteur {
  id: string;
  zone_id: string;
  nom: string;
  type: string; // e.g. "mouvement", "ouverture"
  statut: "ok" | "declenche";
  created_at: string;
}

export interface Alarme {
  id: string;
  zone_id: string;
  capteur_id: string;
  statut: "active" | "acquittee";
  declenchee_a: string;
  acquittee_a?: string;
  acquittee_par?: string;
}

export interface AlarmNotification {
  id: string;
  zoneName: string;
  sensorName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  timestamp: string;
}

interface AlarmState {
  zones: Zone[];
  sensors: Capteur[];
  activeAlarms: Alarme[];
  loading: boolean;
  error: string | null;
  sseConnected: boolean;
  notification: AlarmNotification | null;
  muted: boolean;
  fetchZones: () => Promise<void>;
  fetchSensors: () => Promise<void>;
  fetchActiveAlarms: () => Promise<void>;
  armZone: (zoneId: string) => Promise<void>;
  disarmZone: (zoneId: string) => Promise<void>;
  triggerSensor: (sensorId: string) => Promise<void>;
  connectEventStream: (onNewAlarm?: (notif: AlarmNotification) => void) => void;
  disconnectEventStream: () => void;
  setNotification: (notif: AlarmNotification | null) => void;
  setMuted: (muted: boolean) => void;
  clearError: () => void;
}

const API_BASE = "http://localhost:8080";

let eventSource: EventSource | null = null;

// Synthesis of high-tech siren using Web Audio API
export const playAlarmSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc2.frequency.setValueAtTime(440, audioCtx.currentTime); // A4

    // LFO frequency sweep (siren effect)
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.setValueAtTime(4, audioCtx.currentTime); // 4 sweeps per second
    lfoGain.gain.setValueAtTime(150, audioCtx.currentTime); // Modulate by +/- 150 Hz

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Set moderate volume
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

    osc1.start();
    osc2.start();
    lfo.start();

    // Expontential fade out after 2 seconds
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0);
    osc1.stop(audioCtx.currentTime + 2.1);
    osc2.stop(audioCtx.currentTime + 2.1);
    lfo.stop(audioCtx.currentTime + 2.1);
  } catch (e) {
    console.error("Web Audio API warning sound failed:", e);
  }
};

export const useAlarmStore = create<AlarmState>((set, get) => ({
  zones: [],
  sensors: [],
  activeAlarms: [],
  loading: false,
  error: null,
  sseConnected: false,
  notification: null,
  muted: false,

  fetchZones: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/zones`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch zones");
      }
      const data = await response.json();
      set({ zones: data || [], loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load zones", loading: false });
    }
  },

  fetchSensors: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/capteurs`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch sensors");
      }
      const data = await response.json();
      set({ sensors: data || [], loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load sensors", loading: false });
    }
  },

  fetchActiveAlarms: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/alarmes/active`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch active alarms");
      }
      const data = await response.json();
      set({ activeAlarms: data || [], loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load active alarms", loading: false });
    }
  },

  armZone: async (zoneId: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/zones/${zoneId}/arm`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to arm zone");
      }
      set((state) => ({
        zones: state.zones.map((z) => (z.id === zoneId ? { ...z, statut: "arme" } : z)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to arm zone", loading: false });
      throw err;
    }
  },

  disarmZone: async (zoneId: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/zones/${zoneId}/disarm`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to disarm zone");
      }
      
      set((state) => ({
        zones: state.zones.map((z) => (z.id === zoneId ? { ...z, statut: "desarme" } : z)),
        sensors: state.sensors.map((s) => (s.zone_id === zoneId ? { ...s, statut: "ok" } : s)),
        loading: false,
      }));
      
      await get().fetchActiveAlarms();
    } catch (err: any) {
      set({ error: err.message || "Failed to disarm zone", loading: false });
      throw err;
    }
  },

  triggerSensor: async (sensorId: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/capteurs/${sensorId}/trigger`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to trigger sensor");
      }

      const resData = await response.json();

      set((state) => ({
        sensors: state.sensors.map((s) => (s.id === sensorId ? { ...s, statut: "declenche" } : s)),
        loading: false,
      }));

      // A sensor trigger inside an armed zone initiates an alarm payload on the server
      if (resData.alarm) {
        await get().fetchActiveAlarms();
        
        // Formulate a local notification if SSE is slow or for immediate visual feedback
        const zones = get().zones;
        const sensors = get().sensors;

        const zoneObj = zones.find(z => z.id === resData.alarm.zone_id);
        const sensorObj = sensors.find(s => s.id === sensorId);

        const zoneName = zoneObj ? zoneObj.nom : "Zone Inconnue";
        const sensorName = sensorObj ? sensorObj.nom : "Capteur Inconnu";
        const sensorType = sensorObj ? sensorObj.type : "mouvement";

        let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
        if (sensorType === "mouvement") severity = "HIGH";
        else if (sensorType === "ouverture") severity = "MEDIUM";

        const notif: AlarmNotification = {
          id: resData.alarm.id,
          zoneName,
          sensorName,
          severity,
          timestamp: new Date(resData.alarm.declenchee_a).toLocaleTimeString()
        };

        set({ notification: notif });

        if (!get().muted) {
          playAlarmSound();
        }
      }
    } catch (err: any) {
      set({ error: err.message || "Failed to trigger sensor", loading: false });
      throw err;
    }
  },

  connectEventStream: (onNewAlarm) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    if (eventSource) return;

    const url = `${API_BASE}/events/stream?token=${encodeURIComponent(token)}`;
    eventSource = new EventSource(url);
    set({ sseConnected: true });

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("SSE alarmStore event received:", data);

        // Fetch fresh state
        await Promise.all([
          get().fetchActiveAlarms(),
          get().fetchSensors(),
          get().fetchZones()
        ]);

        if (data.event_type === "alarm.triggered") {
          const alarmPayload = data.details?.payload || {};
          const zoneId = data.zone_id || alarmPayload.zone_id;
          const sensorId = data.capteur_id || alarmPayload.capteur_id;

          const zones = get().zones;
          const sensors = get().sensors;

          const zoneObj = zones.find(z => z.id === zoneId);
          const sensorObj = sensors.find(s => s.id === sensorId);

          const zoneName = zoneObj ? zoneObj.nom : `Zone ${zoneId?.substring(0, 8) || "Inconnue"}`;
          const sensorName = sensorObj ? sensorObj.nom : `Capteur ${sensorId?.substring(0, 8) || "Inconnu"}`;
          const sensorType = sensorObj ? sensorObj.type : "ouverture";

          let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
          if (sensorType === "mouvement") severity = "HIGH";
          else if (sensorType === "ouverture") severity = "MEDIUM";

          const notif: AlarmNotification = {
            id: data.id || alarmPayload.alarme_id || Math.random().toString(),
            zoneName,
            sensorName,
            severity,
            timestamp: new Date(data.timestamp || alarmPayload.timestamp || Date.now()).toLocaleTimeString()
          };

          set({ notification: notif });

          if (!get().muted) {
            playAlarmSound();
          }

          if (onNewAlarm) {
            onNewAlarm(notif);
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE event data", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error", err);
    };
  },

  disconnectEventStream: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ sseConnected: false });
  },

  setNotification: (notif) => set({ notification: notif }),
  setMuted: (muted) => set({ muted }),
  clearError: () => set({ error: null }),
}));
