import React, { useMemo } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore, type TranslationKey } from "../store/languageStore";
import { useWorkspaceStore, type TabType } from "../store/workspaceStore";
import {
  Camera, DoorOpen, ShieldAlert, Map,
  Radio, BarChart3, Cpu, Video, Users, Settings, History
} from "lucide-react";

/* ─────────────────────────────────────────────
   Module tile definition
───────────────────────────────────────────── */
interface ModuleTile {
  key: string;
  type: TabType;
  titleKey: TranslationKey;
  description: string;
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
  closable: boolean;
  accent: string; // Tailwind color token for the icon background
}

const TILES: ModuleTile[] = [
  {
    key: "live",
    type: "live",
    titleKey: "taskLive",
    description: "Surveillance des flux vidéo en direct et grilles de caméras.",
    icon: Camera,
    closable: true,
    accent: "text-control-cyan bg-control-cyan/10 border-control-cyan/20",
  },
  {
    key: "alarms",
    type: "alarms",
    titleKey: "taskAlarms",
    description: "Console d'alarmes, acquittement et historique d'alertes.",
    icon: ShieldAlert,
    closable: true,
    accent: "text-control-red bg-control-red/10 border-control-red/20",
  },
  {
    key: "access",
    type: "access",
    titleKey: "taskAccess",
    description: "Contrôle d'accès physique, déverrouillage de portes et journal de passage.",
    icon: DoorOpen,
    closable: true,
    accent: "text-control-amber bg-control-amber/10 border-control-amber/20",
  },
  {
    key: "map",
    type: "map",
    titleKey: "taskMap",
    description: "Cartographie interactive des équipements et zones de sécurité.",
    icon: Map,
    closable: true,
    accent: "text-control-green bg-control-green/10 border-control-green/20",
  },
  {
    key: "events",
    type: "events",
    titleKey: "taskEvents",
    description: "Journal d'audit système et flux d'événements en temps réel.",
    icon: Radio,
    closable: true,
    accent: "text-control-cyan bg-control-cyan/10 border-control-cyan/20",
  },
  {
    key: "investigation",
    type: "investigation",
    titleKey: "taskInvestigation",
    description: "Lecture différée, timeline et export vidéo avec horodatage.",
    icon: History,
    closable: true,
    accent: "text-control-text-bright bg-control-panel-light border-control-border",
  },
  {
    key: "reports",
    type: "reports",
    titleKey: "taskReports",
    description: "Rapports d'activité, statistiques de disponibilité et audits.",
    icon: BarChart3,
    closable: true,
    accent: "text-control-cyan bg-control-cyan/10 border-control-cyan/20",
  },
  {
    key: "camera-config",
    type: "camera-config",
    titleKey: "taskCameraConfig",
    description: "Configuration des caméras et découverte automatique ONVIF.",
    icon: Video,
    adminOnly: true,
    closable: true,
    accent: "text-control-amber bg-control-amber/10 border-control-amber/20",
  },
  {
    key: "users",
    type: "users",
    titleKey: "taskUsers",
    description: "Gestion des utilisateurs, rôles et permissions d'accès.",
    icon: Users,
    adminOnly: true,
    closable: true,
    accent: "text-control-text-bright bg-control-panel-light border-control-border",
  },
  {
    key: "diagnostics",
    type: "diagnostics",
    titleKey: "taskDiagnostics",
    description: "État des services, journaux système et indicateurs de performance.",
    icon: Cpu,
    adminOnly: true,
    closable: true,
    accent: "text-control-green bg-control-green/10 border-control-green/20",
  },
  {
    key: "settings",
    type: "settings",
    titleKey: "taskSettings",
    description: "Préférences opérateur, thème, langue et profil de connexion.",
    icon: Settings,
    closable: true,
    accent: "text-control-text-bright bg-control-panel-light border-control-border",
  },
];

/* ─────────────────────────────────────────────
   HomePortal component
───────────────────────────────────────────── */
export const HomePortal: React.FC = () => {
  const { user } = useAuthStore();
  const { t } = useLanguageStore();
  const { openTab } = useWorkspaceStore();

  const visibleTiles = useMemo(
    () => TILES.filter((tile) => !tile.adminOnly || user?.role === "admin"),
    [user]
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-start overflow-auto px-8 py-10 gap-8">
      {/* Page heading */}
      <div className="w-full max-w-5xl">
        <h1 className="text-xl font-semibold text-control-text-bright tracking-tight">
          Vue d'ensemble
        </h1>
        <p className="text-sm text-control-text/60 mt-1">
          Sélectionnez un module pour l'ouvrir dans un nouvel onglet.
        </p>
      </div>

      {/* Module grid */}
      <div className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.key}
              onClick={() => openTab(tile.type, tile.titleKey, undefined, tile.closable)}
              className="
                group flex flex-col items-start gap-3 p-5 rounded-xl
                bg-control-panel border border-control-border
                hover:border-control-cyan/40 hover:bg-control-panel-light
                transition-all duration-150 cursor-pointer text-left
                focus:outline-none focus:ring-2 focus:ring-control-cyan/30
              "
            >
              {/* Icon */}
              <div
                className={`
                  h-11 w-11 rounded-xl flex items-center justify-center
                  border shrink-0 transition-transform duration-150
                  group-hover:scale-105 ${tile.accent}
                `}
              >
                <Icon className="h-5 w-5" />
              </div>

              {/* Label + description */}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-control-text-bright leading-tight">
                  {t(tile.titleKey)}
                </span>
                <span className="text-xs text-control-text/60 leading-relaxed line-clamp-2">
                  {tile.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
