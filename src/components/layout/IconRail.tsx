import React from "react";
import { type LucideIcon, Settings, LogOut } from "lucide-react";
import { type TranslationKey } from "../../store/languageStore";

interface IconRailLink {
  key: string;
  type: string;
  labelKey: TranslationKey | string;
  icon: LucideIcon;
  closable: boolean;
}

interface IconRailProps {
  links: IconRailLink[];
  activeType: string;
  onLinkClick: (link: IconRailLink) => void;
  onSettingsClick: () => void;
  onLogoutClick: () => void;
  activeAlarmsCount: number;
  t: (key: any) => string;
}

export const IconRail: React.FC<IconRailProps> = ({
  links,
  activeType,
  onLinkClick,
  onSettingsClick,
  onLogoutClick,
  activeAlarmsCount,
  t
}) => {
  return (
    <aside className="w-16 bg-control-panel border-r border-control-border flex flex-col items-center py-4 justify-between shrink-0 select-none h-full">
      {/* Navigation Modules */}
      <div className="flex flex-col gap-3 w-full items-center">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = activeType === link.type;
          const isAlarms = link.type === "alarms";
          
          return (
            <div key={link.key} className="relative group w-12 h-12 flex items-center justify-center">
              {/* Active Accent Bar */}
              {isActive && (
                <div className="absolute left-0 w-1 h-8 bg-control-cyan rounded-r-md transition-all duration-300" />
              )}
              
              <button
                onClick={() => onLinkClick(link)}
                className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer relative ${
                  isActive
                    ? "bg-control-cyan/10 border border-control-cyan/30 text-control-cyan shadow-sm shadow-control-cyan/5"
                    : "text-control-text border border-transparent hover:bg-control-panel-light hover:text-control-text-bright hover:border-control-border"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                
                {/* Alarm Badge */}
                {isAlarms && activeAlarmsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-control-red text-white text-[9px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center animate-pulse border border-control-panel">
                    {activeAlarmsCount}
                  </span>
                )}
              </button>

              {/* Tooltip */}
              <div className="absolute left-14 top-1/2 -translate-y-1/2 ml-2 bg-control-panel border border-control-border text-control-text-bright text-[10px] uppercase font-bold tracking-wider rounded px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl">
                {t(link.labelKey)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Actions (Settings, Profile/Logout) */}
      <div className="flex flex-col gap-3 w-full items-center mt-auto pt-4 border-t border-control-border/40">
        {/* Settings */}
        <div className="relative group w-12 h-12 flex items-center justify-center">
          {activeType === "settings" && (
            <div className="absolute left-0 w-1 h-8 bg-control-cyan rounded-r-md transition-all duration-300" />
          )}
          <button
            onClick={onSettingsClick}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
              activeType === "settings"
                ? "bg-control-cyan/10 border border-control-cyan/30 text-control-cyan"
                : "text-control-text border border-transparent hover:bg-control-panel-light hover:text-control-text-bright hover:border-control-border"
            }`}
          >
            <Settings className="h-5 w-5 shrink-0" />
          </button>
          <div className="absolute left-14 top-1/2 -translate-y-1/2 ml-2 bg-control-panel border border-control-border text-control-text-bright text-[10px] uppercase font-bold tracking-wider rounded px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl">
            {t("taskSettings")}
          </div>
        </div>

        {/* Logout */}
        <div className="relative group w-12 h-12 flex items-center justify-center">
          <button
            onClick={onLogoutClick}
            className="w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer text-control-red/80 border border-transparent hover:bg-control-panel-light hover:text-control-red hover:border-control-border"
          >
            <LogOut className="h-5 w-5 shrink-0" />
          </button>
          <div className="absolute left-14 top-1/2 -translate-y-1/2 ml-2 bg-control-panel border border-control-border text-control-text-bright text-[10px] uppercase font-bold tracking-wider rounded px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl">
            {t("logoutButton")}
          </div>
        </div>
      </div>
    </aside>
  );
};
