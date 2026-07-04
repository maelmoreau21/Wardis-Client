import React from "react";
import { Sparkles, Clock, Bell, LogOut, Settings } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  serverTime: string;
  connectionStatus: "online" | "offline" | "checking";
  activeAlarmsCount: number;
  userName: string;
  userRole: string;
  onLogout: () => void;
  onOpenSettings: () => void;
  t: (key: any, vars?: any) => string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  serverTime,
  connectionStatus,
  activeAlarmsCount,
  userName,
  userRole,
  onLogout,
  onOpenSettings,
  t
}) => {
  return (
    <header className="h-12 border-b border-control-border bg-control-panel flex items-center justify-between px-4 shrink-0 select-none z-30">
      {/* Brand & Module Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-control-cyan text-white shadow-sm shadow-control-cyan/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-control-text-bright tracking-tight">Wardis</span>
            <span className="ml-1.5 rounded border border-control-border/40 bg-control-cyan/10 px-1 py-0.5 text-[8px] font-bold text-control-cyan uppercase tracking-wider">
              v0.0.1
            </span>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-control-border" />

        <div className="flex flex-col">
          <span className="text-xs font-bold text-control-text-bright uppercase tracking-wider">{title}</span>
          {subtitle && <span className="text-[9px] text-control-text/60 uppercase tracking-widest">{subtitle}</span>}
        </div>
      </div>

      {/* Control Room Telemetry & User controls */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-2 rounded border border-control-border bg-control-panel-light/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-control-text">
          <span className={`h-1.5 w-1.5 rounded-full ${
            connectionStatus === "online" 
              ? "bg-control-green" 
              : connectionStatus === "offline"
              ? "bg-control-red"
              : "bg-control-amber animate-pulse"
          }`} />
          <span>{connectionStatus === "online" ? t("statusStable") : t("connectionLost")}</span>
        </div>

        {/* Server Clock */}
        <div className="flex items-center gap-2 rounded border border-control-border bg-control-panel-light/40 px-2.5 py-1 text-[11px] font-bold text-control-text">
          <Clock className="h-3.5 w-3.5 text-control-cyan" />
          <span className="font-mono">{serverTime}</span>
        </div>

        {/* Alarm Notification Bell */}
        <div className="relative">
          <button 
            className="flex items-center justify-center h-8 w-8 rounded border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 text-control-text hover:text-control-text-bright cursor-pointer transition"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {activeAlarmsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-control-red text-[9px] font-bold text-white animate-pulse">
                {activeAlarmsCount}
              </span>
            )}
          </button>
        </div>

        {/* User Menu */}
        <div className="relative group">
          <button className="flex items-center gap-2 rounded border border-control-border bg-control-panel-light hover:bg-control-panel-light/85 px-2 py-1 cursor-pointer transition text-control-text hover:text-control-text-bright">
            <div className="h-6 w-6 rounded-full bg-control-cyan/15 flex items-center justify-center font-bold text-control-cyan text-[10px]">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider max-w-[80px] truncate">{userName}</span>
          </button>

          {/* User Menu Dropdown */}
          <div className="absolute right-0 mt-1 w-44 bg-control-panel border border-control-border rounded shadow-xl py-1 hidden group-hover:block hover:block z-40">
            <div className="px-3 py-1.5 border-b border-control-border/60 text-[10px] text-control-text/60 uppercase font-bold tracking-wider">
              {userRole}
            </div>
            <button 
              onClick={onOpenSettings}
              className="w-full text-left px-3 py-2 text-xs text-control-text hover:text-control-text-bright hover:bg-control-panel-light flex items-center gap-2 uppercase font-bold tracking-wider cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5 text-control-cyan" />
              {t("taskSettings")}
            </button>
            <button 
              onClick={onLogout}
              className="w-full text-left px-3 py-2 text-xs text-control-red hover:bg-control-red/10 flex items-center gap-2 border-t border-control-border/40 uppercase font-bold tracking-wider cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("logoutButton")}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
