import { create } from "zustand";
import { fetch } from "@tauri-apps/plugin-http";
import { useAuthStore } from "./authStore";

export interface Camera {
  id: string;
  nom: string;
  url_rtsp: string;
  site_id?: string;
  statut: "active" | "inactive";
  created_at: string;
}

interface CameraState {
  cameras: Camera[];
  loading: boolean;
  error: string | null;
  fetchCameras: () => Promise<void>;
  generateStreamToken: (cameraId: string) => Promise<string>;
}

const API_BASE = "http://localhost:8080";

export const useCameraStore = create<CameraState>((set) => ({
  cameras: [],
  loading: false,
  error: null,

  fetchCameras: async () => {
    set({ loading: true, error: null });
    const token = useAuthStore.getState().token;
    try {
      const response = await fetch(`${API_BASE}/cameras`, {
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
    const response = await fetch(`${API_BASE}/cameras/${cameraId}/token`, {
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
}));
