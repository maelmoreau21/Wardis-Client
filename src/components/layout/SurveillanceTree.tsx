import React, { useState, useEffect, useMemo } from "react";
import { useCameraStore, Camera } from "../../store/cameraStore";
import { useAccessControlStore, Door } from "../../store/accessControlStore";
import { useAlarmStore, Capteur } from "../../store/alarmStore";
import { emit } from "@tauri-apps/api/event";
import { 
  Search, Star, History, ChevronDown, ChevronRight, 
  MapPin, Building2, Layers, Folder, FolderOpen, 
  Camera as CameraIcon, DoorClosed, Radio, 
  AlertTriangle, ShieldAlert
} from "lucide-react";

type GroupingType = "hierarchy" | "site" | "type" | "status";

interface TreeNode {
  id: string;
  name: string;
  type: "organisation" | "site" | "building" | "floor" | "zone" | "camera" | "door" | "sensor";
  children?: TreeNode[];
  entityId?: string; // Reference to store entity ID
  status?: "normal" | "warning" | "alarm";
  isOffline?: boolean;
}

export const SurveillanceTree: React.FC = () => {
  const { cameras, fetchCameras } = useCameraStore();
  const { doors, fetchDoors } = useAccessControlStore();
  const { zones, sensors, activeAlarms, fetchZones, fetchSensors, fetchActiveAlarms } = useAlarmStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [grouping, setGrouping] = useState<GroupingType>("hierarchy");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "org-root": true // keep root open by default
  });
  
  // Favorites & Recents in state and local storage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("wardis-favs") || "[]");
    } catch {
      return [];
    }
  });

  const [recents, setRecents] = useState<{ id: string; type: "camera" | "door" | "sensor"; name: string; timestamp: number }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("wardis-recents") || "[]");
    } catch {
      return [];
    }
  });

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    cameraId: string;
    cameraName: string;
  } | null>(null);

  // Property Dialog State
  const [propertyDialog, setPropertyDialog] = useState<Camera | Door | Capteur | null>(null);

  // Load initial data
  useEffect(() => {
    fetchCameras().catch(() => {});
    fetchDoors().catch(() => {});
    fetchZones().catch(() => {});
    fetchSensors().catch(() => {});
    fetchActiveAlarms().catch(() => {});
  }, []);

  // Save favorites to local storage
  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const nextFavs = favorites.includes(id) 
      ? favorites.filter(f => f !== id) 
      : [...favorites, id];
    setFavorites(nextFavs);
    localStorage.setItem("wardis-favs", JSON.stringify(nextFavs));
  };

  // Add to recents
  const addToRecents = (id: string, type: "camera" | "door" | "sensor", name: string) => {
    const nextRecents = [
      { id, type, name, timestamp: Date.now() },
      ...recents.filter(r => r.id !== id)
    ].slice(0, 5); // Keep last 5
    setRecents(nextRecents);
    localStorage.setItem("wardis-recents", JSON.stringify(nextRecents));
  };

  const handleNodeClick = async (node: TreeNode) => {
    if (node.type === "camera" && node.entityId) {
      addToRecents(node.entityId, "camera", node.name);
      try {
        await emit("camera-selected", { cameraId: node.entityId });
      } catch (err) {
        console.error("Failed to emit camera-selected:", err);
      }
    } else if (node.type === "door" && node.entityId) {
      addToRecents(node.entityId, "door", node.name);
    } else if (node.type === "sensor" && node.entityId) {
      addToRecents(node.entityId, "sensor", node.name);
    } else {
      // Toggle expand/collapse
      setExpandedNodes(prev => ({
        ...prev,
        [node.id]: !prev[node.id]
      }));
    }
  };

  // Right click handler for context menu (only on cameras)
  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    if (node.type === "camera" && node.entityId) {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        cameraId: node.entityId,
        cameraName: node.name
      });
    }
  };

  // Close context menu on click elsewhere
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  // Check status of entities
  const getCameraStatus = (cam: Camera): "normal" | "warning" | "alarm" => {
    if (cam.statut === "inactive") return "warning";
    
    // Check alarm
    const inAlarm = activeAlarms.some(a => {
      const sensor = sensors.find(s => s.id === a.capteur_id);
      if (!sensor) return false;
      const camNameLower = cam.nom.toLowerCase();
      const sensorNameLower = sensor.nom.toLowerCase();
      const camTokens = camNameLower.split(/[\s_-]+/);
      return camTokens.some(tok => tok.length > 2 && sensorNameLower.includes(tok));
    });
    
    return inAlarm ? "alarm" : "normal";
  };

  const getDoorStatus = (door: Door): "normal" | "warning" | "alarm" => {
    // If door name is in alarm or triggered, we can flag it
    // Check if there is an active alarm associated with this door
    const inAlarm = activeAlarms.some(a => {
      const sensor = sensors.find(s => s.id === a.capteur_id);
      if (!sensor) return false;
      return sensor.nom.toLowerCase().includes(door.name.toLowerCase()) || 
             door.name.toLowerCase().includes(sensor.nom.toLowerCase());
    });
    if (inAlarm) return "alarm";
    return door.status === "open" ? "warning" : "normal"; // open door generates warnings or visual indications
  };

  const getSensorStatus = (sensor: Capteur): "normal" | "warning" | "alarm" => {
    const inAlarm = activeAlarms.some(a => a.capteur_id === sensor.id);
    if (inAlarm || sensor.statut === "declenche") return "alarm";
    return "normal";
  };

  // Helper to construct the tree based on grouping mode
  const treeData = useMemo(() => {
    // 1. Prepare raw items with statuses
    const cameraNodes: TreeNode[] = cameras.map(c => {
      const status = getCameraStatus(c);
      return {
        id: `cam-${c.id}`,
        name: c.nom,
        type: "camera",
        entityId: c.id,
        status,
        isOffline: c.statut === "inactive"
      };
    });

    const doorNodes: TreeNode[] = doors.map(d => {
      const status = getDoorStatus(d);
      return {
        id: `door-${d.id}`,
        name: d.name,
        type: "door",
        entityId: d.id,
        status
      };
    });

    const sensorNodes: TreeNode[] = sensors.map(s => {
      const status = getSensorStatus(s);
      return {
        id: `sensor-${s.id}`,
        name: s.nom,
        type: "sensor",
        entityId: s.id,
        status
      };
    });

    // Aggregate children status for parent nodes
    const aggregateStatus = (children: TreeNode[]): "normal" | "warning" | "alarm" => {
      let status: "normal" | "warning" | "alarm" = "normal";
      for (const child of children) {
        let childStatus = child.status || "normal";
        if (child.children) {
          childStatus = aggregateStatus(child.children);
        }
        if (childStatus === "alarm") return "alarm";
        if (childStatus === "warning") status = "warning";
      }
      return status;
    };

    if (grouping === "type") {
      const root: TreeNode = {
        id: "type-root",
        name: "Catégories",
        type: "organisation",
        children: [
          { id: "cat-cameras", name: "Vidéosurveillance (Caméras)", type: "zone", children: cameraNodes },
          { id: "cat-doors", name: "Contrôle d'accès (Portes)", type: "zone", children: doorNodes },
          { id: "cat-sensors", name: "Intrusion (Capteurs)", type: "zone", children: sensorNodes }
        ]
      };
      
      // Calculate parents status
      root.children?.forEach(c => {
        c.status = aggregateStatus(c.children || []);
      });
      root.status = aggregateStatus(root.children || []);
      return [root];
    }

    if (grouping === "status") {
      const alarmNodes = [...cameraNodes, ...doorNodes, ...sensorNodes].filter(n => n.status === "alarm");
      const warningNodes = [...cameraNodes, ...doorNodes, ...sensorNodes].filter(n => n.status === "warning");
      const normalNodes = [...cameraNodes, ...doorNodes, ...sensorNodes].filter(n => n.status === "normal");

      const root: TreeNode = {
        id: "status-root",
        name: "Statuts",
        type: "organisation",
        children: [
          { id: "stat-alarm", name: "En alarme", type: "zone", children: alarmNodes, status: "alarm" },
          { id: "stat-warning", name: "Avertissements / Hors ligne", type: "zone", children: warningNodes, status: "warning" },
          { id: "stat-normal", name: "En ligne / Normal", type: "zone", children: normalNodes, status: "normal" }
        ]
      };
      root.status = aggregateStatus(root.children || []);
      return [root];
    }

    if (grouping === "site") {
      // Group by site
      const siteMap: Record<string, { name: string; cameras: TreeNode[]; doors: TreeNode[] }> = {
        "hq-paris": { name: "HQ Paris", cameras: [], doors: [] },
        "secondary": { name: "Site Secondaire", cameras: [], doors: [] }
      };

      // Populate sites based on site_id or default assignments
      cameras.forEach(c => {
        const siteKey = c.site_id || "hq-paris";
        if (!siteMap[siteKey]) siteMap[siteKey] = { name: `Site: ${siteKey}`, cameras: [], doors: [] };
        const node = cameraNodes.find(n => n.entityId === c.id);
        if (node) siteMap[siteKey].cameras.push(node);
      });

      doors.forEach(d => {
        const siteKey = d.site_id || "hq-paris";
        if (!siteMap[siteKey]) siteMap[siteKey] = { name: `Site: ${siteKey}`, cameras: [], doors: [] };
        const node = doorNodes.find(n => n.entityId === d.id);
        if (node) siteMap[siteKey].doors.push(node);
      });

      const sites: TreeNode[] = Object.entries(siteMap).map(([id, s]) => {
        const children = [...s.cameras, ...s.doors];
        // Add sensors to paris
        if (id === "hq-paris") children.push(...sensorNodes);

        return {
          id: `site-${id}`,
          name: s.name,
          type: "site",
          children
        };
      });

      const root: TreeNode = {
        id: "site-root",
        name: "Sites",
        type: "organisation",
        children: sites
      };

      // Propagate statuses
      root.children?.forEach(s => {
        s.status = aggregateStatus(s.children || []);
      });
      root.status = aggregateStatus(root.children || []);

      return [root];
    }

    // Default Hierarchy: Organisation > Site > Bâtiment > Étage > Zone > Entities
    const zonesList: Record<string, TreeNode> = {
      "zone-accueil": { id: "zone-accueil", name: "Zone Accueil", type: "zone", children: [] },
      "zone-serveur": { id: "zone-serveur", name: "Zone Serveur", type: "zone", children: [] },
      "zone-quais": { id: "zone-quais", name: "Zone Quais", type: "zone", children: [] },
      "zone-bureau": { id: "zone-bureau", name: "Zone Bureau Direction", type: "zone", children: [] },
      "zone-misc": { id: "zone-misc", name: "Autres équipements", type: "zone", children: [] }
    };

    cameraNodes.forEach(c => {
      const name = c.name.toLowerCase();
      if (name.includes("accueil") || name.includes("lobby") || name.includes("entree")) {
        zonesList["zone-accueil"].children?.push(c);
      } else if (name.includes("serveur") || name.includes("server")) {
        zonesList["zone-serveur"].children?.push(c);
      } else if (name.includes("quai") || name.includes("dock") || name.includes("hangar")) {
        zonesList["zone-quais"].children?.push(c);
      } else if (name.includes("bureau") || name.includes("office") || name.includes("direction")) {
        zonesList["zone-bureau"].children?.push(c);
      } else {
        zonesList["zone-misc"].children?.push(c);
      }
    });

    doorNodes.forEach(d => {
      const name = d.name.toLowerCase();
      if (name.includes("lobby") || name.includes("entree") || name.includes("accueil")) {
        zonesList["zone-accueil"].children?.push(d);
      } else if (name.includes("serveur") || name.includes("server")) {
        zonesList["zone-serveur"].children?.push(d);
      } else if (name.includes("quai") || name.includes("dock")) {
        zonesList["zone-quais"].children?.push(d);
      } else {
        zonesList["zone-misc"].children?.push(d);
      }
    });

    sensorNodes.forEach(s => {
      const name = s.name.toLowerCase();
      if (name.includes("accueil") || name.includes("lobby")) {
        zonesList["zone-accueil"].children?.push(s);
      } else if (name.includes("serveur") || name.includes("server")) {
        zonesList["zone-serveur"].children?.push(s);
      } else if (name.includes("quai") || name.includes("dock")) {
        zonesList["zone-quais"].children?.push(s);
      } else {
        zonesList["zone-misc"].children?.push(s);
      }
    });

    const hqRdc: TreeNode = {
      id: "hq-rdc",
      name: "Rez-de-chaussée",
      type: "floor",
      children: [zonesList["zone-accueil"], zonesList["zone-serveur"]].filter(z => (z.children?.length || 0) > 0)
    };

    const hqFloor1: TreeNode = {
      id: "hq-floor1",
      name: "1er Étage",
      type: "floor",
      children: [zonesList["zone-bureau"]].filter(z => (z.children?.length || 0) > 0)
    };

    const hqBuilding: TreeNode = {
      id: "hq-building",
      name: "Bâtiment Principal",
      type: "building",
      children: [hqRdc, hqFloor1].filter(f => (f.children?.length || 0) > 0)
    };

    const warehouseRdc: TreeNode = {
      id: "warehouse-rdc",
      name: "Rez-de-chaussée",
      type: "floor",
      children: [zonesList["zone-quais"]].filter(z => (z.children?.length || 0) > 0)
    };

    const warehouseBuilding: TreeNode = {
      id: "warehouse-building",
      name: "Hangar Logistique",
      type: "building",
      children: [warehouseRdc].filter(f => (f.children?.length || 0) > 0)
    };

    const siteHq: TreeNode = {
      id: "site-hq",
      name: "HQ Paris",
      type: "site",
      children: [hqBuilding].filter(b => (b.children?.length || 0) > 0)
    };

    const siteWarehouse: TreeNode = {
      id: "site-warehouse",
      name: "Zone Entrepôts",
      type: "site",
      children: [warehouseBuilding].filter(b => (b.children?.length || 0) > 0)
    };

    const root: TreeNode = {
      id: "org-root",
      name: "Wardis Global Security",
      type: "organisation",
      children: [
        siteHq, 
        siteWarehouse, 
        { id: "site-misc", name: "Équipements Divers", type: "site" as const, children: [zonesList["zone-misc"]] }
      ].filter(s => (s.children?.length || 0) > 0)
    };

    const calcNodeStatus = (n: TreeNode) => {
      if (n.children && n.children.length > 0) {
        n.children.forEach(calcNodeStatus);
        n.status = aggregateStatus(n.children);
      }
    };
    calcNodeStatus(root);

    return [root];
  }, [cameras, doors, zones, sensors, activeAlarms, grouping]);

  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes;
    
    const result: TreeNode[] = [];
    for (const node of nodes) {
      const matchesName = node.name.toLowerCase().includes(query.toLowerCase());
      const filteredChildren = node.children ? filterTree(node.children, query) : undefined;
      const hasMatchingChildren = filteredChildren && filteredChildren.length > 0;
      
      if (matchesName || hasMatchingChildren) {
        result.push({
          ...node,
          children: filteredChildren
        });
      }
    }
    return result;
  };

  const filteredTreeData = useMemo(() => {
    if (!searchQuery) return treeData;
    
    const tempExpanded: Record<string, boolean> = {};
    const markExpanded = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        tempExpanded[node.id] = true;
        if (node.children) markExpanded(node.children);
      });
    };
    
    const filtered = filterTree(treeData, searchQuery);
    markExpanded(filtered);
    
    setTimeout(() => {
      setExpandedNodes(prev => ({ ...prev, ...tempExpanded }));
    }, 0);

    return filtered;
  }, [treeData, searchQuery]);

  const renderNodeName = (name: string) => {
    if (!searchQuery) return name;
    
    const index = name.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (index === -1) return name;
    
    const before = name.substring(0, index);
    const match = name.substring(index, index + searchQuery.length);
    const after = name.substring(index + searchQuery.length);
    
    return (
      <span>
        {before}
        <mark className="bg-control-cyan/40 text-control-text-bright rounded-xs px-0.5 font-bold">{match}</mark>
        {after}
      </span>
    );
  };

  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    if (!node.entityId) return;
    
    e.dataTransfer.setData("text/plain", node.entityId);
    e.dataTransfer.setData("wardis/entity-type", node.type === "camera" ? "camera" : node.type === "door" ? "door" : "sensor");
    
    if (node.type === "camera") {
      e.dataTransfer.setData("wardis/camera-id", node.entityId);
    } else if (node.type === "door") {
      e.dataTransfer.setData("wardis/door-id", node.entityId);
    } else if (node.type === "sensor") {
      e.dataTransfer.setData("wardis/sensor-id", node.entityId);
    }
    
    e.dataTransfer.effectAllowed = "move";
  };

  const handleViewLive = async (cameraId: string) => {
    addToRecents(cameraId, "camera", contextMenu?.cameraName || "");
    await emit("camera-selected", { cameraId });
  };

  const handleViewHistory = (cameraName: string) => {
    alert(`Chargement de l'historique d'enregistrement pour ${cameraName}...`);
  };

  const handleShowProperties = (entityId: string, type: "camera" | "door" | "sensor") => {
    let item: any = null;
    if (type === "camera") item = cameras.find(c => c.id === entityId);
    else if (type === "door") item = doors.find(d => d.id === entityId);
    else if (type === "sensor") item = sensors.find(s => s.id === entityId);
    
    if (item) setPropertyDialog(item);
  };

  const handleExportClip = (cameraName: string) => {
    alert(`Exportation d'un clip vidéo sur ${cameraName} initiée.`);
  };

  const getNodeIcon = (node: TreeNode) => {
    switch (node.type) {
      case "organisation":
        return <Building2 className="h-3.5 w-3.5 text-control-cyan shrink-0" />;
      case "site":
        return <MapPin className="h-3.5 w-3.5 text-control-cyan/80 shrink-0" />;
      case "building":
        return <Building2 className="h-3.5 w-3.5 text-control-text/70 shrink-0" />;
      case "floor":
        return <Layers className="h-3.5 w-3.5 text-control-text/60 shrink-0" />;
      case "zone":
        return expandedNodes[node.id] 
          ? <FolderOpen className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />
          : <Folder className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />;
      case "camera":
        return <CameraIcon className={`h-3.5 w-3.5 shrink-0 ${node.isOffline ? 'text-control-text/40' : 'text-control-cyan'}`} />;
      case "door":
        return <DoorClosed className="h-3.5 w-3.5 text-control-green/80 shrink-0" />;
      case "sensor":
        return <Radio className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />;
    }
  };

  const getStatusBadge = (status?: "normal" | "warning" | "alarm") => {
    if (status === "alarm") {
      return (
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-control-red/20 border border-control-red text-control-red animate-pulse">
          <ShieldAlert className="h-2.5 w-2.5" />
        </span>
      );
    }
    if (status === "warning") {
      return (
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-control-amber/20 border border-control-amber text-control-amber">
          <AlertTriangle className="h-2.5 w-2.5" />
        </span>
      );
    }
    return null;
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const isClickable = node.type === "camera" || node.type === "door" || node.type === "sensor";

    return (
      <div key={node.id} className="select-none font-mono">
        <div 
          onClick={() => handleNodeClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          draggable={isClickable}
          onDragStart={(e) => handleDragStart(e, node)}
          style={{ paddingLeft: `${depth * 10 + 4}px` }}
          className={`group flex items-center justify-between py-1 px-1.5 rounded-sm hover:bg-control-panel-light/30 transition-colors cursor-pointer text-[10px] ${
            isClickable ? "text-control-text" : "text-control-text-bright font-bold"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {!isClickable && hasChildren ? (
              <span className="text-control-text/40 hover:text-control-text-bright transition-colors shrink-0">
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </span>
            ) : (
              <span className="w-3 shrink-0" />
            )}
            
            {getNodeIcon(node)}
            
            <span className="truncate flex-1">
              {renderNodeName(node.name)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 shrink-0">
            {getStatusBadge(node.status)}

            {isClickable && node.entityId && (
              <button
                onClick={(e) => toggleFavorite(node.entityId!, e)}
                className={`p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-control-panel-light transition-all cursor-pointer ${
                  favorites.includes(node.entityId) ? "text-control-cyan opacity-100!" : "text-control-text/40 hover:text-control-text-bright"
                }`}
                title="Favoris"
              >
                <Star className="h-2.5 w-2.5 fill-current" />
              </button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="relative">
            <div 
              style={{ left: `${depth * 10 + 8}px` }} 
              className="absolute top-0 bottom-1.5 w-[1px] bg-control-border/40 pointer-events-none" 
            />
            <div className="mt-0.5 space-y-0.5">
              {node.children!.map(child => renderNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full select-none text-control-text font-mono relative">
      <div className="flex flex-col gap-2 mb-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-control-text/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search directory..."
            className="w-full bg-black border border-control-border text-control-text-bright text-[10px] pl-8 pr-2.5 py-1.5 rounded focus:border-control-cyan focus:outline-none placeholder-control-text/30"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] uppercase font-bold text-control-red hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center justify-between border-b border-control-border pb-1.5 gap-1.5">
          <span className="text-[8px] text-control-text/40 uppercase font-bold tracking-wider">Groupement:</span>
          <select
            value={grouping}
            onChange={(e) => setGrouping(e.target.value as GroupingType)}
            className="bg-control-panel-light/60 border border-control-border text-control-text-bright text-[9px] px-1.5 py-0.5 rounded cursor-pointer focus:outline-none"
          >
            <option value="hierarchy">Hiérarchique</option>
            <option value="site">Par Site</option>
            <option value="type">Par Type</option>
            <option value="status">Par Statut</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
        {favorites.length > 0 && (
          <div className="border border-control-cyan/20 bg-control-cyan/5 rounded p-2">
            <div className="text-[9px] text-control-cyan font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
              <Star className="h-3 w-3 fill-current text-control-cyan" />
              <span>Favoris ({favorites.length})</span>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {favorites.map(favId => {
                const cam = cameras.find(c => c.id === favId);
                const door = doors.find(d => d.id === favId);
                const sensor = sensors.find(s => s.id === favId);
                
                const item = cam || door || sensor;
                if (!item) return null;
                
                const type = cam ? "camera" : door ? "door" : "sensor";
                const name = cam ? cam.nom : door ? door.name : sensor ? sensor.nom : "";
                const isOffline = cam?.statut === "inactive";
                
                return (
                  <div
                    key={`fav-${favId}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", favId);
                      e.dataTransfer.setData("wardis/entity-type", type);
                      e.dataTransfer.setData(`wardis/${type}-id`, favId);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => {
                      if (type === "camera") handleViewLive(favId);
                      addToRecents(favId, type, name);
                    }}
                    onContextMenu={(e) => {
                      if (type === "camera") {
                        e.preventDefault();
                        setContextMenu({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          cameraId: favId,
                          cameraName: name
                        });
                      }
                    }}
                    className="flex items-center justify-between text-[9px] hover:bg-control-cyan/10 px-1 py-0.5 rounded cursor-pointer text-control-text-bright transition-all"
                  >
                    <span className="flex items-center gap-1 truncate">
                      {type === "camera" && <CameraIcon className={`h-2.5 w-2.5 ${isOffline ? 'text-control-text/40' : 'text-control-cyan'}`} />}
                      {type === "door" && <DoorClosed className="h-2.5 w-2.5 text-control-green" />}
                      {type === "sensor" && <Radio className="h-2.5 w-2.5 text-amber-400" />}
                      <span className="truncate">{name}</span>
                    </span>
                    <button
                      onClick={(e) => toggleFavorite(favId, e)}
                      className="text-control-cyan hover:text-control-red transition-colors"
                      title="Retirer"
                    >
                      <Star className="h-2.5 w-2.5 fill-current" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recents.length > 0 && (
          <div className="border border-control-border bg-control-panel-light/20 rounded p-2">
            <div className="text-[9px] text-control-text/60 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
              <History className="h-3 w-3 text-control-text/40" />
              <span>Récemment Consultés</span>
            </div>
            <div className="space-y-1">
              {recents.map(r => {
                const isOffline = r.type === "camera" && cameras.find(c => c.id === r.id)?.statut === "inactive";
                return (
                  <div
                    key={`recent-${r.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", r.id);
                      e.dataTransfer.setData("wardis/entity-type", r.type);
                      e.dataTransfer.setData(`wardis/${r.type}-id`, r.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => {
                      if (r.type === "camera") handleViewLive(r.id);
                    }}
                    onContextMenu={(e) => {
                      if (r.type === "camera") {
                        e.preventDefault();
                        setContextMenu({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          cameraId: r.id,
                          cameraName: r.name
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 text-[9px] hover:bg-control-panel-light/40 px-1 py-0.5 rounded cursor-pointer text-control-text/75 truncate transition-all"
                  >
                    {r.type === "camera" && <CameraIcon className={`h-2.5 w-2.5 shrink-0 ${isOffline ? 'text-control-text/40' : 'text-control-cyan'}`} />}
                    {r.type === "door" && <DoorClosed className="h-2.5 w-2.5 text-control-green shrink-0" />}
                    {r.type === "sensor" && <Radio className="h-2.5 w-2.5 text-amber-400 shrink-0" />}
                    <span className="truncate">{r.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1">
          {filteredTreeData.length === 0 ? (
            <div className="text-[10px] text-control-text/40 italic p-3 text-center uppercase">
              Aucun résultat correspondant
            </div>
          ) : (
            filteredTreeData.map(node => renderNode(node))
          )}
        </div>
      </div>

      {contextMenu?.visible && (
        <div 
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-[999] bg-control-panel border border-control-cyan/45 py-1.5 w-44 rounded shadow-2xl font-mono text-[9px] select-none uppercase tracking-wider"
        >
          <div className="px-2.5 py-1 border-b border-control-border text-control-cyan font-bold truncate text-[8px] max-w-full">
            {contextMenu.cameraName}
          </div>
          <button 
            onClick={() => handleViewLive(contextMenu.cameraId)}
            className="w-full text-left px-2.5 py-1.5 hover:bg-control-cyan hover:text-black font-bold text-control-text-bright flex items-center gap-1.5 transition-colors"
          >
            Voir en direct
          </button>
          <button 
            onClick={() => handleViewHistory(contextMenu.cameraName)}
            className="w-full text-left px-2.5 py-1.5 hover:bg-control-cyan hover:text-black font-bold text-control-text-bright flex items-center gap-1.5 transition-colors"
          >
            Voir l'historique
          </button>
          <button 
            onClick={() => handleShowProperties(contextMenu.cameraId, "camera")}
            className="w-full text-left px-2.5 py-1.5 hover:bg-control-cyan hover:text-black font-bold text-control-text-bright flex items-center gap-1.5 transition-colors"
          >
            Propriétés
          </button>
          <button 
            onClick={() => toggleFavorite(contextMenu.cameraId)}
            className="w-full text-left px-2.5 py-1.5 hover:bg-control-cyan hover:text-black font-bold text-control-text-bright flex items-center gap-1.5 transition-colors"
          >
            {favorites.includes(contextMenu.cameraId) ? "Retirer des favoris" : "Ajouter aux favoris"}
          </button>
          <button 
            onClick={() => handleExportClip(contextMenu.cameraName)}
            className="w-full text-left px-2.5 py-1.5 hover:bg-control-cyan/90 hover:text-black font-bold text-control-text-bright flex items-center gap-1.5 transition-colors"
          >
            Exporter un clip
          </button>
        </div>
      )}

      {propertyDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-xs font-mono">
          <div className="bg-control-panel border border-control-cyan/45 p-5 max-w-sm w-full rounded shadow-2xl flex flex-col gap-4 text-[10px]">
            <div className="flex items-center justify-between border-b border-control-border pb-1.5 text-xs text-control-cyan font-bold uppercase tracking-wider">
              <span>Fiche d'Équipement</span>
              <button 
                onClick={() => setPropertyDialog(null)}
                className="text-control-red hover:underline font-bold text-[9px]"
              >
                [ FERMER ]
              </button>
            </div>
            <div className="space-y-2 uppercase text-control-text-bright">
              <div className="flex justify-between border-b border-control-border/40 py-0.5">
                <span className="text-control-text/60">NOM:</span>
                <span className="font-bold">{propertyDialog.hasOwnProperty("nom") ? (propertyDialog as any).nom : (propertyDialog as any).name}</span>
              </div>
              <div className="flex justify-between border-b border-control-border/40 py-0.5">
                <span className="text-control-text/60">ID UNIQUE:</span>
                <span className="font-bold font-sans">{propertyDialog.id}</span>
              </div>
              <div className="flex justify-between border-b border-control-border/40 py-0.5">
                <span className="text-control-text/60">TYPE:</span>
                <span className="font-bold">
                  {propertyDialog.hasOwnProperty("url_rtsp") ? "CAMÉRA IP" : propertyDialog.hasOwnProperty("status") ? "CONTRÔLE ACCÈS" : "CAPTEUR INTRUSION"}
                </span>
              </div>
              {propertyDialog.hasOwnProperty("url_rtsp") && (
                <>
                  <div className="flex justify-between border-b border-control-border/40 py-0.5">
                    <span className="text-control-text/60">ADRESSE RTSP:</span>
                    <span className="font-bold font-sans">{(propertyDialog as any).url_rtsp}</span>
                  </div>
                  <div className="flex justify-between border-b border-control-border/40 py-0.5">
                    <span className="text-control-text/60">PTZ SUPPORTÉ:</span>
                    <span className="font-bold">{(propertyDialog as any).ptz_supported ? "OUI" : "NON"}</span>
                  </div>
                </>
              )}
              {propertyDialog.hasOwnProperty("status") && (
                <div className="flex justify-between border-b border-control-border/40 py-0.5">
                  <span className="text-control-text/60">STATUT PHYSIQUE:</span>
                  <span className={`font-bold ${(propertyDialog as any).status === "open" ? "text-control-green" : "text-control-text"}`}>
                    {(propertyDialog as any).status}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-control-border/40 py-0.5">
                <span className="text-control-text/60">DATE DE CRÉATION:</span>
                <span className="font-bold font-sans">{new Date(propertyDialog.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
