import { create } from "zustand";
import { fetch } from "@tauri-apps/plugin-http";
import { useAuthStore } from "./authStore";
import { getApiBase } from "./config";
import { connectWebSocket, disconnectWebSocket } from "./websocketService";

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
  requireAckReason: boolean;
  escalationDelay: number; // in seconds
  snoozedAlarms: { [alarmId: string]: number }; // map of alarmId -> unsnooze timestamp
  setRequireAckReason: (req: boolean) => void;
  setEscalationDelay: (delay: number) => void;
  addSnoozedAlarm: (alarmId: string, durationMinutes: number) => void;
  clearSnoozedAlarms: () => void;
  fetchZones: () => Promise<void>;
  fetchSensors: () => Promise<void>;
  fetchActiveAlarms: () => Promise<void>;
  armZone: (zoneId: string) => Promise<void>;
  disarmZone: (zoneId: string) => Promise<void>;
  triggerSensor: (sensorId: string) => Promise<void>;
  acknowledgeAlarm: (alarmId: string, reason: string) => Promise<void>;
  transferAlarm: (alarmId: string, recipient: string, reason: string) => Promise<void>;
  snoozeAlarm: (alarmId: string, durationMinutes: number, reason: string) => Promise<void>;
  connectEventStream: (onNewAlarm?: (notif: AlarmNotification) => void) => void;
  disconnectEventStream: () => void;
  setNotification: (notif: AlarmNotification | null) => void;
  setMuted: (muted: boolean) => void;
  clearError: () => void;
}

const getApiUrl = () => getApiBase();

// Synthesis of high-tech siren using Web Audio API
export const playAlarmSound = (severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW") => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (severity === "CRITICAL") {
      osc1.type = "sawtooth";
      osc2.type = "sawtooth";
      osc1.frequency.setValueAtTime(1000, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(500, audioCtx.currentTime);

      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.frequency.setValueAtTime(6, audioCtx.currentTime); // 6 sweeps per second
      lfoGain.gain.setValueAtTime(250, audioCtx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      lfo.start();

      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      osc1.start();
      osc2.start();

      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
      osc1.stop(audioCtx.currentTime + 1.6);
      osc2.stop(audioCtx.currentTime + 1.6);
      lfo.stop(audioCtx.currentTime + 1.6);
    } else if (severity === "HIGH") {
      osc1.type = "sawtooth";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc2.frequency.setValueAtTime(440, audioCtx.currentTime); // A4

      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.frequency.setValueAtTime(3, audioCtx.currentTime); // 3 sweeps per second
      lfoGain.gain.setValueAtTime(150, audioCtx.currentTime); // Modulate by +/- 150 Hz
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      lfo.start();

      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc1.start();
      osc2.start();

      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0);
      osc1.stop(audioCtx.currentTime + 2.1);
      osc2.stop(audioCtx.currentTime + 2.1);
      lfo.stop(audioCtx.currentTime + 2.1);
    } else if (severity === "MEDIUM") {
      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(300, audioCtx.currentTime);

      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc1.start();
      osc2.start();

      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime + 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);
      
      osc1.stop(audioCtx.currentTime + 1.1);
      osc2.stop(audioCtx.currentTime + 1.1);
    } else {
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(400, audioCtx.currentTime);

      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      osc1.start();
      osc2.start();

      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc1.stop(audioCtx.currentTime + 0.5);
      osc2.stop(audioCtx.currentTime + 0.5);
    }
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
  requireAckReason: localStorage.getItem("wardis-require-ack-reason") === "true",
  escalationDelay: parseInt(localStorage.getItem("wardis-escalation-delay") || "30"),
  snoozedAlarms: {},

  setRequireAckReason: (requireAckReason) => {
    localStorage.setItem("wardis-require-ack-reason", String(requireAckReason));
    set({ requireAckReason });
  },
  setEscalationDelay: (escalationDelay) => {
    localStorage.setItem("wardis-escalation-delay", String(escalationDelay));
    set({ escalationDelay });
  },
  addSnoozedAlarm: (alarmId, durationMinutes) => set((state) => ({
    snoozedAlarms: {
      ...state.snoozedAlarms,
      [alarmId]: Date.now() + durationMinutes * 60000
    }
  })),
  clearSnoozedAlarms: () => set({ snoozedAlarms: {} }),

  fetchZones: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${getApiUrl()}/zones`, {
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
      const response = await fetch(`${getApiUrl()}/capteurs`, {
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
      const response = await fetch(`${getApiUrl()}/alarmes/active`, {
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
      const response = await fetch(`${getApiUrl()}/zones/${zoneId}/arm`, {
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
      const response = await fetch(`${getApiUrl()}/zones/${zoneId}/disarm`, {
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
      const response = await fetch(`${getApiUrl()}/capteurs/${sensorId}/trigger`, {
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

  acknowledgeAlarm: async (alarmId: string, reason: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${getApiUrl()}/alarmes/${alarmId}/acquit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to acknowledge alarm");
      }
      set({ loading: false });
      await get().fetchActiveAlarms();
    } catch (err: any) {
      set({ error: err.message || "Failed to acknowledge alarm", loading: false });
      throw err;
    }
  },

  transferAlarm: async (alarmId: string, recipient: string, reason: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${getApiUrl()}/alarmes/${alarmId}/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ recipient, reason })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to transfer alarm");
      }
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to transfer alarm", loading: false });
      throw err;
    }
  },

  snoozeAlarm: async (alarmId: string, durationMinutes: number, reason: string) => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${getApiUrl()}/alarmes/${alarmId}/delay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ duration_minutes: durationMinutes, reason })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to snooze alarm");
      }
      get().addSnoozedAlarm(alarmId, durationMinutes);
      set({ loading: false });
      await get().fetchActiveAlarms();
    } catch (err: any) {
      set({ error: err.message || "Failed to snooze alarm", loading: false });
      throw err;
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

  setNotification: (notif) => set({ notification: notif }),
  setMuted: (muted) => set({ muted }),
  clearError: () => set({ error: null }),
}));
