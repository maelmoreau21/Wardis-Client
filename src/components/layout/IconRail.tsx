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
    <aside className="w-[72px] bg-control-panel border-r border-control-border flex flex-col items-center py-3 justify-between shrink-0 select-none h-full">
      {/* Navigation Modules */}
      <div className="flex flex-col gap-1.5 w-full items-center px-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = activeType === link.type;
          const isAlarms = link.type === "alarms";
          const label = t(link.labelKey);
          // Shorten label to ~8 chars for display under icon
          const shortLabel = label.length > 9 ? label.substring(0, 8) + "…" : label;

          return (
            <div key={link.key} className="relative group w-full">
              <button
                onClick={() => onLinkClick(link)}
                className={`relative w-full rounded-xl flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-control-cyan/15 text-control-cyan"
                    : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright"
                }`}
              >
                {/* Icon */}
                <div className="relative">
                  <Icon className="h-5 w-5 shrink-0" />

                  {/* Alarm Badge */}
                  {isAlarms && activeAlarmsCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-control-red text-white text-[9px] font-bold rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center border-2 border-control-panel">
                      {activeAlarmsCount > 99 ? "99+" : activeAlarmsCount}
                    </span>
                  )}
                </div>

                {/* Short label below icon */}
                <span className="text-[10px] font-medium leading-none text-center w-full truncate px-0.5">
                  {shortLabel}
                </span>
              </button>

              {/* Full Tooltip on hover */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-control-panel-light border border-control-border text-control-text-bright text-xs font-medium rounded-lg px-3 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl">
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-1.5 w-full items-center px-2 pt-3 border-t border-control-border/40">
        {/* Settings */}
        <div className="relative group w-full">
          <button
            onClick={onSettingsClick}
            className={`relative w-full rounded-xl flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all duration-200 cursor-pointer ${
              activeType === "settings"
                ? "bg-control-cyan/15 text-control-cyan"
                : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright"
            }`}
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-medium leading-none">{t("taskSettings").substring(0, 8)}</span>
          </button>
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-control-panel-light border border-control-border text-control-text-bright text-xs font-medium rounded-lg px-3 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl">
            {t("taskSettings")}
          </div>
        </div>

        {/* Logout */}
        <div className="relative group w-full">
          <button
            onClick={onLogoutClick}
            className="relative w-full rounded-xl flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all duration-200 cursor-pointer text-control-red/70 hover:bg-control-red/10 hover:text-control-red"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-medium leading-none">{t("logoutButton").substring(0, 8)}</span>
          </button>
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-control-panel-light border border-control-border text-control-text-bright text-xs font-medium rounded-lg px-3 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl">
            {t("logoutButton")}
          </div>
        </div>
      </div>
    </aside>
  );
};
