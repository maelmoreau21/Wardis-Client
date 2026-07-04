import React, { useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore, type TranslationKey } from "../store/languageStore";
import { useWorkspaceStore, type TabType } from "../store/workspaceStore";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { 
  Camera, DoorOpen, ShieldAlert, Map, Radio, Users, Settings, 
  Video, ExternalLink, Search, Sparkles, Cpu
} from "lucide-react";

interface TaskTile {
  key: string;
  type: TabType;
  titleKey: TranslationKey;
  descKey: string;
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
  closable: boolean;
  category: "Operation" | "Investigation" | "Maintenance";
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
      closable: true,
      category: "Operation"
    },
    {
      key: "access",
      type: "access",
      titleKey: "taskAccess",
      descKey: "Contrôle d'accès physique, déverrouillage de portes et journal de passage.",
      icon: DoorOpen,
      closable: true,
      category: "Operation"
    },
    {
      key: "alarms",
      type: "alarms",
      titleKey: "taskAlarms",
      descKey: "Console d'acquittement des alarmes et alertes d'intrusion en temps réel.",
      icon: ShieldAlert,
      closable: true,
      category: "Operation"
    },
    {
      key: "map",
      type: "map",
      titleKey: "taskMap",
      descKey: "Cartographie interactive des équipements de sécurité et de contrôle.",
      icon: Map,
      closable: true,
      category: "Operation"
    },
    {
      key: "events",
      type: "events",
      titleKey: "taskEvents",
      descKey: "Journal d'audit système complet et flux d'événements en direct.",
      icon: Radio,
      closable: true,
      category: "Investigation"
    },
    {
      key: "diagnostics",
      type: "diagnostics",
      titleKey: "taskDiagnostics",
      descKey: "Diagnostics de l'état général des serveurs, services NATS et logs système.",
      icon: Cpu,
      closable: true,
      category: "Maintenance"
    },
    {
      key: "camera-config",
      type: "camera-config",
      titleKey: "taskCameraConfig",
      descKey: "Configuration des caméras de sécurité et scan ONVIF automatique.",
      icon: Video,
      adminOnly: true,
      closable: true,
      category: "Maintenance"
    },
    {
      key: "users",
      type: "users",
      titleKey: "taskUsers",
      descKey: "Gestion administrative des utilisateurs, des rôles et de la matrice de droits.",
      icon: Users,
      adminOnly: true,
      closable: true,
      category: "Maintenance"
    },
    {
      key: "settings",
      type: "settings",
      titleKey: "taskSettings",
      descKey: "Gestion du profil opérateur, mot de passe, préférences de thème et de langue.",
      icon: Settings,
      closable: true,
      category: "Maintenance"
    }
  ], []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Check admin restrictions
      if (task.adminOnly && user?.role !== "admin") return false;

      // Filter by search query
      if (!searchQuery) return true;
      const title = t(task.titleKey).toLowerCase();
      const desc = task.descKey.toLowerCase();
      return title.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
    });
  }, [tasks, searchQuery, user, t]);

  const handleLaunchTab = (task: TaskTile) => {
    openTab(task.type, task.titleKey, undefined, task.closable);
  };

  const handleDetachTab = async (task: TaskTile) => {
    const label = `detached-task-${task.key}-${Date.now()}`;
    try {
      const webview = new WebviewWindow(label, {
        url: `index.html?detached=true&tabType=${task.type}&token=${encodeURIComponent(token || "")}`,
        title: `Wardis Task - ${t(task.titleKey)}`,
        width: 1024,
        height: 768,
      });

      webview.once("tauri://created", () => {
        console.log(`Detached task window created: ${task.key}`);
      });
    } catch (e) {
      console.warn("Tauri detached window failed, falling back to browser window:", e);
      window.open(`?detached=true&tabType=${task.type}&token=${encodeURIComponent(token || "")}`, "_blank");
    }
  };

  // Group tasks by category
  const categories = ["Operation", "Investigation", "Maintenance"] as const;

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full py-4 px-2">
      {/* Banner */}
      <div className="wardis-panel p-6 relative overflow-hidden bg-gradient-to-r from-control-panel via-control-panel-light/30 to-control-panel border border-control-border/60 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-control-cyan/15 text-control-cyan border border-control-cyan/25">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-control-text-bright tracking-tight flex items-center gap-2">
              Wardis Security Desk
              <span className="rounded-full border border-control-cyan/25 bg-control-cyan/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-control-cyan">
                Accueil
              </span>
            </h2>
            <p className="text-xs text-control-text/75 mt-0.5">
              Plateforme industrielle unifiée de supervision vidéo et de contrôle d'accès.
            </p>
          </div>
        </div>
        
        {/* Welcome indicator */}
        <div className="flex items-center gap-3 bg-control-bg/60 border border-control-border rounded-xl px-4 py-2.5 relative z-10">
          <div className="h-8 w-8 rounded-full bg-control-cyan/10 flex items-center justify-center font-bold text-control-cyan text-xs border border-control-cyan/25">
            {(user?.email || "OP").substring(0, 2).toUpperCase()}
          </div>
          <div className="text-xs">
            <p className="font-bold text-control-text-bright">{user?.email || "operator@wardis.com"}</p>
            <p className="text-[9px] text-control-text/60 uppercase tracking-wider font-semibold">
              Rôle: {user?.role || "OPERATOR"}
            </p>
          </div>
        </div>
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
          className="w-full bg-control-panel border border-control-border rounded-xl pl-9 pr-4 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60 transition shadow-sm"
        />
      </div>

      {/* Structured Genetec categories */}
      <div className="flex flex-col gap-8">
        {categories.map((cat) => {
          const catTasks = filteredTasks.filter(t => t.category === cat);
          if (catTasks.length === 0) return null;

          return (
            <div key={cat} className="flex flex-col">
              <div className="flex items-center gap-2 border-b border-control-border/40 pb-1.5 mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-control-cyan shrink-0" />
                <h3 className="text-xs font-bold text-control-text-bright uppercase tracking-wider">
                  {cat === "Operation" ? "Opérations" : cat === "Investigation" ? "Recherche" : "Administration & Maintenance"}
                </h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {catTasks.map((task) => {
                  const Icon = task.icon;
                  return (
                    <div
                      key={task.key}
                      onClick={() => handleLaunchTab(task)}
                      className="wardis-panel p-4 group flex flex-col justify-between h-40 border-control-border/60 hover:border-control-cyan/40 hover:bg-control-panel-light/20 transition duration-150 cursor-pointer relative"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="h-9 w-9 rounded-lg bg-control-bg flex items-center justify-center text-control-cyan border border-control-border/70 group-hover:border-control-cyan/40 transition">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          
                          {/* Detach Action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDetachTab(task);
                            }}
                            className="p-1 rounded bg-control-bg border border-control-border text-control-text/75 hover:text-control-cyan hover:border-control-cyan transition cursor-pointer"
                            title="Détacher vers un écran externe"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>

                        <h4 className="text-xs font-bold text-control-text-bright mt-3 uppercase tracking-wider truncate">
                          {t(task.titleKey)}
                        </h4>
                        <p className="text-[10px] text-control-text/70 mt-1 leading-relaxed line-clamp-2">
                          {task.descKey}
                        </p>
                      </div>

                      <div className="text-[9px] uppercase tracking-wider font-bold text-control-cyan/0 group-hover:text-control-cyan/100 transition duration-150 flex items-center gap-1">
                        Lancer &rarr;
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
    </div>
  );
};
