import { getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";

export interface SavedWindow {
  label: string;
  type: "tab" | "camera";
  tabType?: string;
  cameraId?: string;
  cameraNom?: string;
  statut?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFullscreen: boolean;
  isAlwaysOnTop: boolean;
}

// Track spawned windows metadata in localStorage so we know what content each window label has
export const registerSpawnedWindow = (metadata: Omit<SavedWindow, "x" | "y" | "width" | "height" | "isFullscreen" | "isAlwaysOnTop">) => {
  const list = getRegisteredWindows();
  const index = list.findIndex(w => w.label === metadata.label);
  if (index !== -1) {
    list[index] = { ...list[index], ...metadata };
  } else {
    list.push(metadata as any);
  }
  localStorage.setItem("wardis-spawned-windows-meta", JSON.stringify(list));
};

export const unregisterSpawnedWindow = (label: string) => {
  const list = getRegisteredWindows();
  const filtered = list.filter(w => w.label !== label);
  localStorage.setItem("wardis-spawned-windows-meta", JSON.stringify(filtered));
};

const getRegisteredWindows = (): Omit<SavedWindow, "x" | "y" | "width" | "height" | "isFullscreen" | "isAlwaysOnTop">[] => {
  try {
    return JSON.parse(localStorage.getItem("wardis-spawned-windows-meta") || "[]");
  } catch {
    return [];
  }
};

export const saveCurrentLayout = async () => {
  try {
    const allWindows = await getAllWebviewWindows();
    const registeredMeta = getRegisteredWindows();
    const savedWindows: SavedWindow[] = [];

    for (const win of allWindows) {
      const isMain = win.label === "main";
      const meta = registeredMeta.find(m => m.label === win.label);
      if (!isMain && !meta) continue;

      try {
        const position = await win.outerPosition();
        const size = await win.outerSize();
        const isFullscreen = await win.isFullscreen();
        
        savedWindows.push({
          label: win.label,
          type: isMain ? "tab" : (meta?.type || "tab"),
          tabType: meta?.tabType,
          cameraId: meta?.cameraId,
          cameraNom: meta?.cameraNom,
          statut: meta?.statut,
          x: position.x,
          y: position.y,
          width: size.width,
          height: size.height,
          isFullscreen,
          isAlwaysOnTop: false, // Updated dynamically or assumed false
        });
      } catch (e) {
        console.error("Error getting window metrics for layout save:", e);
      }
    }

    const payload = JSON.stringify({ windows: savedWindows });
    await invoke("save_layout", { layoutJson: payload });
  } catch (err) {
    console.error("Failed to save layout:", err);
  }
};

export const loadSavedLayout = async (): Promise<SavedWindow[]> => {
  try {
    const layoutJson: string = await invoke("load_layout");
    if (!layoutJson || layoutJson === "{}") return [];
    const data = JSON.parse(layoutJson);
    return data.windows || [];
  } catch (err) {
    console.error("Failed to load layout:", err);
    return [];
  }
};
