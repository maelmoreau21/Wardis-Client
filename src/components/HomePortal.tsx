import React, { useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore, type TranslationKey } from "../store/languageStore";
import { useWorkspaceStore, type TabType } from "../store/workspaceStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { 
  Camera, DoorOpen, ShieldAlert, Map, Radio, Users, Settings, 
  Video, ExternalLink, Search, Sparkles, LayoutGrid, Monitor 
} from "lucide-react";

interface TaskTile {
  key: string;
  type: TabType | "camera-config";
  titleKey: TranslationKey | "taskCameraConfig";
  descKey: string;
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
  closable: boolean;
}

export const HomePortal: React.FC = () => {
  const { user, token } = useAuthStore();
  const { t } = useLanguageStore();
  const { openTab } = useWorkspaceStore();
  const [searchQuery, setSearchQuery] = useState("");

  const tasks: TaskTile[] = useMemo(() => [
    {
      key: "live",
      type: "live",
      titleKey: "taskLive",
      descKey: "Visualisation des flux caméras en direct et grilles de surveillance.",
      icon: Camera,
      closable: true
    },
    {
      key: "access",
      type: "access",
      titleKey: "taskAccess",
      descKey: "Contrôle d'accès physique, déverrouillage de portes et journal de passage.",
      icon: DoorOpen,
      closable: true
    },
    {
      key: "alarms",
      type: "alarms",
      titleKey: "taskAlarms",
      descKey: "Console d'acquittement des alarmes et alertes d'intrusion en temps réel.",
      icon: ShieldAlert,
      closable: true
    },
    {
      key: "map",
      type: "map",
      titleKey: "taskMap",
      descKey: "Cartographie interactive des équipements de sécurité et de contrôle.",
      icon: Map,
      closable: true
    },
    {
      key: "events",
      type: "events",
      titleKey: "taskEvents",
      descKey: "Journal d'audit système complet et flux d'événements en direct.",
      icon: Radio,
      closable: true
    },
    {
      key: "camera-config",
      type: "camera-config",
      titleKey: "taskCameraConfig" as any, // We will translate this manually or add key
      descKey: "Configuration des caméras de sécurité et scan ONVIF automatique.",
      icon: Video,
      adminOnly: true,
      closable: true
    },
    {
      key: "users",
      type: "users",
      titleKey: "taskUsers",
      descKey: "Gestion administrative des utilisateurs, des rôles et de la matrice de droits.",
      icon: Users,
      adminOnly: true,
      closable: true
    },
    {
      key: "settings",
      type: "settings",
      titleKey: "taskSettings",
      descKey: "Gestion du profil opérateur, mot de passe, préférences de thème et de langue.",
      icon: Settings,
      closable: true
    }
  ], []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Check admin restrictions
      if (task.adminOnly && user?.role !== "admin") return false;

      // Filter by search query
      if (!searchQuery) return true;
      const title = t(task.titleKey as any).toLowerCase();
      const desc = task.descKey.toLowerCase();
      return title.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
    });
  }, [tasks, searchQuery, user, t]);

  const handleLaunchTab = (task: TaskTile) => {
    openTab(task.type as TabType, task.titleKey as any, undefined, task.closable);
  };

  const handleDetachTab = async (task: TaskTile) => {
    const label = `detached-task-${task.key}-${Date.now()}`;
    try {
      const webview = new WebviewWindow(label, {
        url: `index.html?detached=true&tabType=${task.type}&token=${encodeURIComponent(token || "")}`,
        title: `Wardis Task - ${t(task.titleKey as any)}`,
        width: 1024,
        height: 768,
      });

      webview.once("tauri://created", () => {
        console.log(`Detached task window created: ${task.key}`);
      });
    } catch (e) {
      // Fallback if not inside Tauri
      console.warn("Tauri detached window failed, falling back to browser window:", e);
      window.open(`?detached=true&tabType=${task.type}&token=${encodeURIComponent(token || "")}`, "_blank");
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full py-4">
      {/* Banner */}
      <div className="wardis-panel p-8 relative overflow-hidden bg-gradient-to-r from-control-panel via-control-panel-light/40 to-control-panel border border-control-border/60 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4.5 relative z-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-control-cyan/15 text-control-cyan shadow-md border border-control-cyan/20">
            <Sparkles className="h-7 w-7 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-control-text-bright tracking-tight flex items-center gap-2">
              Wardis Security Desk
              <span className="rounded-full border border-control-cyan/20 bg-control-cyan/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-control-cyan">
                Home Portal
              </span>
            </h2>
            <p className="text-xs text-control-text/75 mt-1">
              Console unifiée de contrôle d'accès, d'alertes intrusion et de gestion de flux vidéo.
            </p>
          </div>
        </div>
        
        {/* Welcome indicator */}
        <div className="flex items-center gap-3 bg-control-bg/60 border border-control-border rounded-xl px-4 py-3 relative z-10">
          <div className="h-9 w-9 rounded-full bg-control-cyan/10 flex items-center justify-center font-bold text-control-cyan text-sm border border-control-cyan/20">
            {(user?.email || "OP").substring(0, 2).toUpperCase()}
          </div>
          <div className="text-xs">
            <p className="font-bold text-control-text-bright">{user?.email || "operator@wardis.com"}</p>
            <p className="text-[10px] text-control-text/70 uppercase tracking-wider font-semibold mt-0.5">
              Rôle: {user?.role || "OPERATOR"}
            </p>
          </div>
        </div>
        
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent to-control-bg/25 pointer-events-none opacity-20" />
      </div>

      {/* Task search bar */}
      <div className="relative w-full max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-control-text/50">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une tâche (Surveillance, Cartographie...)..."
          className="w-full bg-control-panel border border-control-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60 transition shadow-sm"
        />
      </div>

      {/* Grid Categories */}
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 border-b border-control-border/60 pb-2 mb-4">
            <LayoutGrid className="h-4.5 w-4.5 text-control-cyan" />
            <h3 className="text-xs font-bold text-control-text-bright uppercase tracking-wider">
              Tâches de Supervision Disponible
            </h3>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTasks.map((task) => {
              const Icon = task.icon;
              return (
                <div
                  key={task.key}
                  onClick={() => handleLaunchTab(task)}
                  className="wardis-panel p-5 group flex flex-col justify-between h-48 border-control-border/65 hover:border-control-cyan/40 hover:bg-control-panel-light/30 transition duration-200 cursor-pointer relative"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="h-10 w-10 rounded-xl bg-control-panel-light flex items-center justify-center text-control-cyan group-hover:scale-105 transition duration-200 border border-control-border/50">
                        <Icon className="h-5 w-5" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetachTab(task);
                        }}
                        className="p-1.5 rounded-lg border border-control-border/60 bg-control-panel hover:bg-control-panel-light hover:text-control-cyan text-control-text/70 transition cursor-pointer flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider"
                        title="Détacher vers un autre écran"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Détacher
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-control-text-bright mt-4 uppercase tracking-wider">
                      {task.key === "camera-config" ? "Configuration Caméras" : t(task.titleKey as any)}
                    </h4>
                    <p className="text-[11px] text-control-text/70 mt-1.5 leading-relaxed line-clamp-2">
                      {task.descKey}
                    </p>
                  </div>

                  <div className="text-[9px] uppercase tracking-wider font-bold text-control-cyan/0 group-hover:text-control-cyan/100 transition duration-200 mt-2 flex items-center gap-1">
                    <Monitor className="h-3 w-3" />
                    Lancer la tâche &rarr;
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
    </div>
  );
};
