import { create } from "zustand";
import { fetch } from "@tauri-apps/plugin-http";
import { useAuthStore } from "./authStore";
import { getApiBase } from "./config";

export interface Camera {
  id: string;
  nom: string;
  url_rtsp: string;
  main_stream_url: string;
  sub_stream_url: string;
  site_id?: string;
  statut: "active" | "inactive";
  ptz_supported: boolean;
  created_at: string;
}

interface CameraState {
  cameras: Camera[];
  loading: boolean;
  error: string | null;
  fetchCameras: () => Promise<void>;
  generateStreamToken: (cameraId: string) => Promise<string>;
  configureWHEPStream: (cameraId: string) => Promise<string>;
  sendPTZCommand: (cameraId: string, pan: number, tilt: number, zoom: number) => Promise<void>;
}

export const useCameraStore = create<CameraState>((set) => ({
  cameras: [],
  loading: false,
  error: null,

  fetchCameras: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${getApiBase()}/cameras`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch cameras");
      }

      const data = await response.json();
      set({ cameras: data, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load cameras", loading: false });
    }
  },

  generateStreamToken: async (cameraId: string) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${getApiBase()}/cameras/${cameraId}/token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to generate stream token");
    }

    const data = await response.json();
    return data.token;
  },

  configureWHEPStream: async (cameraId: string) => {
    const token = useAuthStore.getState().token;
    const response = await fetch(`${getApiBase()}/cameras/${cameraId}/whep`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to configure WHEP stream");
    }

    const data = await response.json();
    return data.whep_url;
  },

  sendPTZCommand: async (cameraId: string, pan: number, tilt: number, zoom: number) => {
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${getApiBase()}/cameras/${cameraId}/ptz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ pan, tilt, zoom }),
      });

      if (!response.ok) {
        throw new Error("Failed to send PTZ command");
      }
    } catch (err: any) {
      console.error(`PTZ action failed for camera ${cameraId}:`, err);
    }
  },
}));
