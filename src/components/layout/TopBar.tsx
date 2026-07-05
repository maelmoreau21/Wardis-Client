import React from "react";
import { Shield, Clock, Bell, LogOut, Settings, ChevronDown } from "lucide-react";

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
    <header className="h-14 border-b border-control-border bg-control-panel flex items-center justify-between px-5 shrink-0 select-none z-30 shadow-sm">
      {/* Brand & Module Title */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-control-cyan text-white shadow-md shadow-control-cyan/25">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-control-text-bright">Wardis</span>
            <span className="text-[10px] text-control-text/60 font-medium">Security Suite</span>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-control-border" />

        {/* Module Title */}
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-control-text-bright">{title}</span>
          {subtitle && (
            <span className="text-[11px] text-control-text/60 mt-0.5">{subtitle}</span>
          )}
        </div>
      </div>

      {/* Right side: status chips + user */}
      <div className="flex items-center gap-2">
        {/* Connection status pill */}
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
          connectionStatus === "online"
            ? "bg-control-green/10 text-control-green"
            : connectionStatus === "offline"
            ? "bg-control-red/10 text-control-red"
            : "bg-control-amber/10 text-control-amber"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${
            connectionStatus === "online"
              ? "bg-control-green"
              : connectionStatus === "offline"
              ? "bg-control-red"
              : "bg-control-amber animate-pulse"
          }`} />
          <span>{connectionStatus === "online" ? t("statusStable") : connectionStatus === "checking" ? "…" : t("connectionLost")}</span>
        </div>

        {/* Server Clock */}
        <div className="flex items-center gap-1.5 rounded-full bg-control-panel-light px-3 py-1.5 text-xs font-medium text-control-text">
          <Clock className="h-3.5 w-3.5 text-control-cyan" />
          <span className="font-mono tabular-nums">{serverTime}</span>
        </div>

        {/* Alarm Bell */}
        <div className="relative">
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-control-panel-light hover:bg-control-panel text-control-text hover:text-control-text-bright cursor-pointer transition-all duration-150"
            title="Notifications"
          >
            <Bell className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            {activeAlarmsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4.5 h-[18px] w-[18px] items-center justify-center rounded-full bg-control-red text-[9px] font-bold text-white border-2 border-control-panel">
                {activeAlarmsCount > 99 ? "99+" : activeAlarmsCount}
              </span>
            )}
          </button>
        </div>

        {/* User Menu */}
        <div className="relative group">
          <button className="flex items-center gap-2 rounded-full bg-control-panel-light hover:bg-control-panel px-3 py-1.5 cursor-pointer transition-all duration-150 text-control-text hover:text-control-text-bright">
            {/* Avatar */}
            <div className="h-7 w-7 rounded-full bg-control-cyan/20 flex items-center justify-center font-semibold text-control-cyan text-xs">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-semibold max-w-[96px] truncate">{userName}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 bg-control-panel border border-control-border rounded-xl shadow-xl py-1.5 hidden group-hover:block hover:block z-50 overflow-hidden">
            <div className="px-4 py-2 border-b border-control-border/50">
              <p className="text-xs font-semibold text-control-text-bright truncate">{userName}</p>
              <p className="text-[11px] text-control-text/60 mt-0.5 capitalize">{userRole}</p>
            </div>
            <button
              onClick={onOpenSettings}
              className="w-full text-left px-4 py-2.5 text-sm text-control-text hover:text-control-text-bright hover:bg-control-panel-light flex items-center gap-2.5 cursor-pointer transition-colors"
            >
              <Settings className="h-4 w-4 text-control-cyan shrink-0" />
              {t("taskSettings")}
            </button>
            <button
              onClick={onLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-control-red hover:bg-control-red/8 flex items-center gap-2.5 border-t border-control-border/40 cursor-pointer transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("logoutButton")}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
