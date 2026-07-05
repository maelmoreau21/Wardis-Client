import React, { useState } from "react";
import { X, Plus, ExternalLink, type LucideIcon } from "lucide-react";
import { type TranslationKey } from "../../store/languageStore";
import { type TabType } from "../../store/workspaceStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAuthStore } from "../../store/authStore";
import { registerSpawnedWindow, saveCurrentLayout } from "../../store/layoutManager";

interface TabItem {
  id: string;
  type: TabType;
  title: string;
  closable: boolean;
}

interface AddTabLink {
  key: string;
  type: TabType;
  labelKey: TranslationKey | string;
  icon: LucideIcon;
}

interface MainCanvasProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabReorder: (startIndex: number, endIndex: number) => void;
  onAddTabClick: (type: TabType, title: string) => void;
  addTabLinks: AddTabLink[];
  getTabIcon: (type: TabType) => any;
  children: React.ReactNode;
  t: (key: any) => string;
}

export const MainCanvas: React.FC<MainCanvasProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onAddTabClick,
  addTabLinks,
  getTabIcon,
  children,
  t
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== index) {
      onTabReorder(draggedIdx, index);
      setDraggedIdx(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-control-bg">
      {/* Tab Strip */}
      <div className="h-11 flex items-center bg-control-panel border-b border-control-border px-3 gap-1.5 shrink-0 select-none overflow-x-auto relative z-20">
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
          {tabs.map((tab, idx) => {
            const TabIcon = getTabIcon(tab.type);
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onTabSelect(tab.id)}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-grab active:cursor-grabbing transition-all duration-150 shrink-0 h-8 ${
                  isActive
                    ? "bg-control-cyan/15 text-control-cyan"
                    : "text-control-text hover:text-control-text-bright hover:bg-control-panel-light/70"
                }`}
              >
                {TabIcon && <TabIcon className="h-3 w-3 shrink-0 pointer-events-none" />}
                <span className="pointer-events-none">{t(tab.title)}</span>
                
                {/* Detach Tab Button */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const token = useAuthStore.getState().token;
                    const label = `detached-tab-${tab.type}-${Date.now()}`;
                    try {
                      registerSpawnedWindow({
                        label,
                        type: "tab",
                        tabType: tab.type
                      });
                      const webview = new WebviewWindow(label, {
                        url: `index.html?detached=true&tabType=${tab.type}&token=${encodeURIComponent(token || "")}`,
                        title: `Wardis Workspace - ${t(tab.title)}`,
                        width: 1024,
                        height: 768,
                      });
                      
                      webview.once("tauri://created", () => {
                        webview.listen("tauri://move", () => {
                          saveCurrentLayout();
                        });
                        webview.listen("tauri://resize", () => {
                          saveCurrentLayout();
                        });
                        saveCurrentLayout();
                      });
                    } catch (err) {
                      console.error("Failed to detach tab:", err);
                    }
                  }}
                  className="hover:bg-black/20 rounded p-0.5 ml-1 transition cursor-pointer text-control-text hover:text-control-cyan"
                  title="Détacher cet onglet dans une nouvelle fenêtre"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>

                {tab.closable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                    className="hover:bg-black/20 rounded p-0.5 ml-1 transition cursor-pointer text-control-text hover:text-control-text-bright"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Tab Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-control-panel-light hover:bg-control-panel-light/80 text-control-text hover:text-control-text-bright cursor-pointer transition-all"
            >
              <Plus className="h-4 w-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute left-0 mt-2 w-56 rounded-xl bg-control-panel border border-control-border shadow-xl p-1.5 z-40 flex flex-col gap-0.5">
                  <p className="text-[11px] font-semibold text-control-text/60 px-3 py-1.5 border-b border-control-border/50 mb-1">
                    {t("taskMenuTitle")}
                  </p>
                  {addTabLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <button
                        key={link.key}
                        onClick={() => {
                          onAddTabClick(link.type, link.labelKey as string);
                          setShowMenu(false);
                        }}
                        className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-left font-medium hover:bg-control-panel-light hover:text-control-text-bright text-control-text transition-colors cursor-pointer"
                      >
                        <Icon className="h-4 w-4 text-control-cyan shrink-0" />
                        {t(link.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0 relative">
        {children}
      </div>
    </div>
  );
};
