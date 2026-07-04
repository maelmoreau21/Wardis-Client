import { create } from "zustand";

export type TabType = 
  | "status" 
  | "live" 
  | "access" 
  | "alarms" 
  | "events" 
  | "map" 
  | "users" 
  | "settings"
  | "camera-config"
  | "diagnostics"
  | "reports"
  | "admin-system";

export interface WorkspaceTab {
  id: string;
  type: TabType;
  title: string;
  closable: boolean;
  params?: Record<string, any>;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  openTab: (type: TabType, title: string, params?: Record<string, any>, closable?: boolean) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  clearTabs: () => void;
}

const DEFAULT_TABS: WorkspaceTab[] = [
  { id: "status", type: "status", title: "overviewTab", closable: false }
];

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: DEFAULT_TABS,
  activeTabId: "status",

  openTab: (type, title, params, closable = true) => {
    const { tabs } = get();
    // If it's a singleton tab (e.g., users, settings, status) and already exists, just focus it
    const isSingleton = ["status", "users", "settings"].includes(type);
    const existingTab = isSingleton ? tabs.find((t) => t.type === type) : null;

    if (existingTab) {
      set({ activeTabId: existingTab.id });
      return;
    }

    // Generate unique ID for the tab
    const tabId = `${type}-${Date.now()}`;
    const newTab: WorkspaceTab = {
      id: tabId,
      type,
      title,
      closable,
      params
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: tabId
    });
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const tabToClose = tabs.find((t) => t.id === id);
    if (tabToClose && !tabToClose.closable) return; // Cannot close unclosable tabs

    const newTabs = tabs.filter((t) => t.id !== id);
    let newActiveTabId = activeTabId;

    if (activeTabId === id) {
      // Find the next best tab to focus
      const closedIndex = tabs.findIndex((t) => t.id === id);
      if (newTabs.length > 0) {
        // Focus the tab to the left, or the first remaining tab
        const nextIndex = Math.max(0, closedIndex - 1);
        newActiveTabId = newTabs[nextIndex].id;
      } else {
        newActiveTabId = "";
      }
    }

    set({
      tabs: newTabs.length > 0 ? newTabs : DEFAULT_TABS,
      activeTabId: newTabs.length > 0 ? newActiveTabId : "status"
    });
  },

  setActiveTabId: (id) => {
    set({ activeTabId: id });
  },

  reorderTabs: (startIndex, endIndex) => {
    const { tabs } = get();
    const result = Array.from(tabs);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    set({ tabs: result });
  },

  clearTabs: () => {
    set({
      tabs: DEFAULT_TABS,
      activeTabId: "status"
    });
  }
}));
