import React, { useState } from "react";
import { X, Plus, type LucideIcon } from "lucide-react";
import { type TranslationKey } from "../../store/languageStore";
import { type TabType } from "../../store/workspaceStore";

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
      <div className="h-9 flex items-center bg-control-panel border-b border-control-border px-3 gap-1 shrink-0 select-none overflow-x-auto relative z-20">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
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
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider cursor-grab active:cursor-grabbing transition border duration-150 shrink-0 h-7 ${
                  isActive
                    ? "bg-control-cyan/15 border-control-cyan text-control-cyan"
                    : "bg-control-panel-light/40 border-control-border text-control-text hover:text-control-text-bright hover:bg-control-panel-light/60"
                }`}
              >
                {TabIcon && <TabIcon className="h-3 w-3 shrink-0 pointer-events-none" />}
                <span className="pointer-events-none">{t(tab.title)}</span>
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
              className="h-7 w-7 flex items-center justify-center rounded border border-control-border bg-control-panel-light/40 hover:bg-control-panel-light text-control-text-bright cursor-pointer transition"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute left-0 mt-1 w-52 rounded bg-control-panel border border-control-border shadow-xl p-1 z-40 flex flex-col gap-0.5">
                  <p className="text-[8px] uppercase tracking-wider font-bold text-control-text/60 px-2 py-1 border-b border-control-border/50 mb-1">
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
                        className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-[10px] text-left font-bold uppercase tracking-wider hover:bg-control-panel-light hover:text-control-text-bright text-control-text transition cursor-pointer"
                      >
                        <Icon className="h-3.5 w-3.5 text-control-cyan shrink-0" />
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
