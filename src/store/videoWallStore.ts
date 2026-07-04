import { create } from "zustand";

export interface VideoWallState {
  slotAssignments: (string | null)[];
  aspectRatios: ("contain" | "cover")[];
  layout: string;
  setSlotAssignments: (assignments: (string | null)[]) => void;
  setAspectRatios: (ratios: ("contain" | "cover")[]) => void;
  setLayout: (layout: string) => void;
  assignCameraToSlot: (slotIdx: number, cameraId: string | null) => void;
  autoAssignCameraOnAlarm: (cameraId: string) => void;
}

export const useVideoWallStore = create<VideoWallState>((set, get) => ({
  slotAssignments: (() => {
    try {
      const saved = localStorage.getItem("wardis-slot-assignments");
      return saved ? JSON.parse(saved) : Array(16).fill(null);
    } catch {
      return Array(16).fill(null);
    }
  })(),
  aspectRatios: (() => {
    try {
      const saved = localStorage.getItem("wardis-aspect-ratios");
      return saved ? JSON.parse(saved) : Array(16).fill("cover");
    } catch {
      return Array(16).fill("cover");
    }
  })(),
  layout: localStorage.getItem("wardis-video-layout") || "2x2",
  
  setSlotAssignments: (slotAssignments) => {
    localStorage.setItem("wardis-slot-assignments", JSON.stringify(slotAssignments));
    set({ slotAssignments });
  },
  setAspectRatios: (aspectRatios) => {
    localStorage.setItem("wardis-aspect-ratios", JSON.stringify(aspectRatios));
    set({ aspectRatios });
  },
  setLayout: (layout) => {
    localStorage.setItem("wardis-video-layout", layout);
    set({ layout });
  },
  assignCameraToSlot: (slotIdx, cameraId) => {
    const next = [...get().slotAssignments];
    next[slotIdx] = cameraId;
    get().setSlotAssignments(next);
  },
  autoAssignCameraOnAlarm: (cameraId) => {
    const { slotAssignments } = get();
    if (slotAssignments.includes(cameraId)) return;
    
    const emptyIdx = slotAssignments.indexOf(null);
    if (emptyIdx !== -1) {
      get().assignCameraToSlot(emptyIdx, cameraId);
    } else {
      get().assignCameraToSlot(0, cameraId);
    }
  }
}));
