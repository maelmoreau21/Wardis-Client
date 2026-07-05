import React, { useState, useRef } from "react";
import {
  Shield, Bell, Clock, ChevronDown, Settings, LogOut,
  Plus, X, ExternalLink, type LucideIcon
} from "lucide-react";
import { type TabType } from "../../store/workspaceStore";
import { type TranslationKey } from "../../store/languageStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAuthStore } from "../../store/authStore";
import { registerSpawnedWindow, saveCurrentLayout } from "../../store/layoutManager";

interface TabItem {
  id: string;
  type: TabType;
  title: string;
  closable: boolean;
}

interface ModuleLink {
  key: string;
  type: TabType;
  labelKey: TranslationKey | string;
  icon: LucideIcon;
  closable: boolean;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabReorder: (from: number, to: number) => void;
  onAddTab: (type: TabType, label: string) => void;
  moduleLinks: ModuleLink[];
  getTabIcon: (type: TabType) => LucideIcon | undefined;
  // Status info
  serverTime: string;
  connectionStatus: "online" | "offline" | "checking";
  activeAlarmsCount: number;
  userName: string;
  userRole: string;
  onLogout: () => void;
  onOpenSettings: () => void;
  t: (key: any, vars?: any) => string;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onAddTab,
  moduleLinks,
  getTabIcon,
  serverTime,
  connectionStatus,
  activeAlarmsCount,
  userName,
  userRole,
  onLogout,
  onOpenSettings,
  t,
}) => {
  const [showModuleMenu, setShowModuleMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const draggedIdx = useRef<number | null>(null);

  /* ── drag-to-reorder ── */
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    draggedIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx.current !== null && draggedIdx.current !== idx) {
      onTabReorder(draggedIdx.current, idx);
      draggedIdx.current = idx;
    }
  };

  const handleDragEnd = () => {
    draggedIdx.current = null;
  };

  /* ── detach a tab to its own window ── */
  const handleDetach = async (e: React.MouseEvent, tab: TabItem) => {
    e.stopPropagation();
    const token = useAuthStore.getState().token;
    const label = `detached-tab-${tab.type}-${Date.now()}`;
    try {
      registerSpawnedWindow({ label, type: "tab", tabType: tab.type });
      const webview = new WebviewWindow(label, {
        url: `index.html?detached=true&tabType=${tab.type}&token=${encodeURIComponent(token || "")}`,
        title: `Wardis – ${t(tab.title)}`,
        width: 1024,
        height: 768,
      });
      webview.once("tauri://created", () => {
        webview.listen("tauri://move", () => saveCurrentLayout());
        webview.listen("tauri://resize", () => saveCurrentLayout());
        saveCurrentLayout();
      });
    } catch (err) {
      console.error("Failed to detach tab:", err);
    }
  };

  /* ── connection status style ── */
  const connClass =
    connectionStatus === "online"
      ? "bg-control-green/10 text-control-green"
      : connectionStatus === "offline"
      ? "bg-control-red/10 text-control-red"
      : "bg-control-amber/10 text-control-amber";
  const dotClass =
    connectionStatus === "online"
      ? "bg-control-green"
      : connectionStatus === "offline"
      ? "bg-control-red"
      : "bg-control-amber animate-pulse";

  return (
    <header
      className="h-11 shrink-0 flex items-center bg-control-panel border-b border-control-border select-none z-40 overflow-hidden"
      style={{ minHeight: "44px" }}
    >
      {/* ── Logo / Brand ── */}
      <div className="flex items-center gap-2 px-3 shrink-0 h-full border-r border-control-border/50">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-control-cyan text-white shadow-sm">
          <Shield className="h-3.5 w-3.5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-bold text-control-text-bright tracking-wide">Wardis</span>
          <span className="text-[9px] text-control-text/50 font-medium">VMS</span>
        </div>
      </div>

      {/* ── Tab Strip ── */}
      <div className="flex items-end h-full flex-1 overflow-x-auto min-w-0 gap-0">
        {tabs.map((tab, idx) => {
          const TabIcon = getTabIcon(tab.type);
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => onTabSelect(tab.id)}
              className={`
                group relative flex items-center gap-1.5 h-9 px-3 text-xs font-medium
                border-r border-control-border/50 cursor-pointer shrink-0
                transition-all duration-100 select-none
                ${isActive
                  ? "bg-control-bg text-control-text-bright border-t-2 border-t-control-cyan -mb-px pb-px"
                  : "bg-control-panel text-control-text hover:bg-control-panel-light hover:text-control-text-bright"
                }
              `}
            >
              {TabIcon && (
                <TabIcon
                  className={`h-3 w-3 shrink-0 ${isActive ? "text-control-cyan" : "text-control-text/60"}`}
                />
              )}
              <span className="max-w-[120px] truncate pointer-events-none">{t(tab.title)}</span>

              {/* Detach button (visible on hover) */}
              <button
                onClick={(e) => handleDetach(e, tab)}
                title="Détacher dans une nouvelle fenêtre"
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 rounded p-0.5 transition-opacity cursor-pointer text-control-text hover:text-control-cyan"
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </button>

              {/* Close button */}
              {tab.closable && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 rounded p-0.5 transition-opacity cursor-pointer text-control-text hover:text-control-red"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}

              {/* Active tab bottom indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-px bg-control-bg" />
              )}
            </div>
          );
        })}

        {/* ── Add Tab ("+") Button ── */}
        <div className="relative flex items-center h-full px-1.5">
          <button
            onClick={() => { setShowModuleMenu(!showModuleMenu); setShowUserMenu(false); }}
            className="h-7 w-7 flex items-center justify-center rounded-md bg-control-panel-light hover:bg-control-border text-control-text hover:text-control-text-bright cursor-pointer transition-all"
            title="Ouvrir un nouveau module"
          >
            <Plus className="h-4 w-4" />
          </button>

          {showModuleMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowModuleMenu(false)} />
              <div className="absolute top-full left-0 mt-1 w-56 rounded-xl bg-control-panel border border-control-border shadow-2xl p-1.5 z-50 flex flex-col gap-0.5">
                <p className="text-[10px] font-semibold text-control-text/50 uppercase tracking-wider px-3 py-1.5 border-b border-control-border/50 mb-1">
                  {t("taskMenuTitle")}
                </p>
                {moduleLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.key}
                      onClick={() => { onAddTab(link.type, link.labelKey as string); setShowModuleMenu(false); }}
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

      {/* ── Right Side: Status + User ── */}
      <div className="flex items-center gap-1.5 px-3 shrink-0 border-l border-control-border/50 h-full">

        {/* Connection status pill */}
        <div className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${connClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          <span className="hidden md:inline">
            {connectionStatus === "online" ? t("statusStable") : connectionStatus === "checking" ? "…" : t("connectionLost")}
          </span>
        </div>

        {/* Clock */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-control-panel-light px-2.5 py-1 text-[11px] font-medium text-control-text">
          <Clock className="h-3 w-3 text-control-cyan" />
          <span className="font-mono tabular-nums">{serverTime}</span>
        </div>

        {/* Alarm bell */}
        <div className="relative">
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-control-panel-light text-control-text hover:text-control-text-bright cursor-pointer transition-all"
            title="Notifications"
            onClick={() => {}}
          >
            <Bell className="h-4 w-4" />
            {activeAlarmsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-control-red text-[9px] font-bold text-white border-2 border-control-panel">
                {activeAlarmsCount > 99 ? "99+" : activeAlarmsCount}
              </span>
            )}
          </button>
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowModuleMenu(false); }}
            className="flex items-center gap-1.5 rounded-full hover:bg-control-panel-light px-2 py-1 cursor-pointer transition-all text-control-text hover:text-control-text-bright"
          >
            <div className="h-6 w-6 rounded-full bg-control-cyan/20 flex items-center justify-center font-bold text-control-cyan text-[10px]">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <span className="hidden sm:block text-[11px] font-semibold max-w-[80px] truncate">{userName}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-control-panel border border-control-border rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden">
                <div className="px-4 py-2 border-b border-control-border/50">
                  <p className="text-xs font-semibold text-control-text-bright truncate">{userName}</p>
                  <p className="text-[11px] text-control-text/60 mt-0.5 capitalize">{userRole}</p>
                </div>
                <button
                  onClick={() => { onOpenSettings(); setShowUserMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-control-text hover:text-control-text-bright hover:bg-control-panel-light flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Settings className="h-4 w-4 text-control-cyan shrink-0" />
                  {t("taskSettings")}
                </button>
                <button
                  onClick={() => { onLogout(); setShowUserMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-control-red hover:bg-control-red/8 flex items-center gap-2.5 border-t border-control-border/40 cursor-pointer transition-colors"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {t("logoutButton")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
