import React from "react";
import { type LucideIcon } from "lucide-react";
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
  t: (key: any) => string;
}

export const IconRail: React.FC<IconRailProps> = ({
  links,
  activeType,
  onLinkClick,
  t
}) => {
  return (
    <aside className="w-16 bg-control-panel border-r border-control-border flex flex-col items-center py-4 justify-between shrink-0 select-none">
      {/* Navigation Modules */}
      <div className="flex flex-col gap-3 w-full items-center">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = activeType === link.type;
          return (
            <div key={link.key} className="relative group w-12 h-12">
              <button
                onClick={() => onLinkClick(link)}
                className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-control-cyan/15 border border-control-cyan text-control-cyan shadow-sm shadow-control-cyan/5"
                    : "text-control-text border border-transparent hover:bg-control-panel-light hover:text-control-text-bright hover:border-control-border"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
              </button>

              {/* Tooltip */}
              <div className="absolute left-14 top-1/2 -translate-y-1/2 ml-2 bg-control-panel border border-control-border text-control-text-bright text-[10px] uppercase font-bold tracking-wider rounded px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl">
                {t(link.labelKey)}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
