import React, { useState, useEffect, useRef, useMemo } from "react";
import { useCameraStore } from "../store/cameraStore";
import { useLanguageStore } from "../store/languageStore";
import { useAuthStore } from "../store/authStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import { 
  Play, Pause, SkipForward, SkipBack, FastForward, Rewind, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, 
  Search, Plus, Trash2, Bookmark, Download, ShieldCheck, Lock, 
  Compass, Tv, Video, ArrowLeftRight
} from "lucide-react";

type LayoutType = "1x1" | "2x2" | "3x3";

interface VideoBookmark {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: number; // offset in seconds from base (e.g. 0 to 86400)
  name: string;
  note: string;
  dateStr: string;
}

interface ExportTask {
  id: string;
  cameraName: string;
  startTime: number;
  endTime: number;
  operator: string;
  motif: string;
  integrityHash: string;
  dateStr: string;
  status: "completed" | "processing";
  progress: number;
}

export const Investigation: React.FC = () => {
  const { cameras, fetchCameras, loading } = useCameraStore();
  const { t } = useLanguageStore();
  const { user } = useAuthStore();
  const { tabs, activeTabId } = useWorkspaceStore();

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const params = activeTab?.params;

  // Active Layout and Camera Assignments
  const [layout, setLayout] = useState<LayoutType>("2x2");
  const [slotAssignments, setSlotAssignments] = useState<(string | null)[]>(Array(9).fill(null));
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);

  // Playback Control States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isSynchronized, setIsSynchronized] = useState<boolean>(true);
  
  // Base Date for timeline (e.g. today)
  const baseDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Time cursors per slot (in seconds from midnight, default to 12:00:00 / 43200s)
  const [slotTimehead, setSlotTimehead] = useState<number[]>(Array(9).fill(43200));

  // Zoom scale: "day" (1px = 120s), "hour" (1px = 10s), "minute" (1px = 1s)
  const [timelineZoom, setTimelineZoom] = useState<"day" | "hour" | "minute">("hour");
  
  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>(() => {
    try {
      const saved = localStorage.getItem("wardis-bookmarks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [newBookmarkName, setNewBookmarkName] = useState("");
  const [newBookmarkNote, setNewBookmarkNote] = useState("");
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);

  // Export States
  const [exportInPoint, setExportInPoint] = useState<number | null>(42600); // 11:50
  const [exportOutPoint, setExportOutPoint] = useState<number | null>(43800); // 12:10
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOperatorName, setExportOperatorName] = useState(user?.email || "operator");
  const [exportMotif, setExportMotif] = useState("");
  const [exportWatermark, setExportWatermark] = useState(true);
  const [exportsList, setExportsList] = useState<ExportTask[]>([]);

  // Search filter for cameras
  const [cameraSearch, setCameraSearch] = useState("");

  // PTZ states for active camera
  const [ptzZoomLevel, setPtzZoomLevel] = useState(1);
  const [ptzFocus, setPtzFocus] = useState(50);
  const [ptzIris, setPtzIris] = useState(50);
  const [isPatrolling, setIsPatrolling] = useState(false);
  
  // Simulated lock state (Operator 4 has lock on some cameras)
  const [ptzLockedByOther] = useState<{ [cameraId: string]: string }>({
    "cam-ptz-lock": "OP_04 (Salle Centrale)"
  });

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingTimeline = useRef(false);
  const dragStartX = useRef(0);
  const dragStartTimehead = useRef(0);

  // Fetch cameras on mount
  useEffect(() => {
    fetchCameras().catch(() => {});
  }, [fetchCameras]);

  // Intercept workspace tab parameters to seek nearest camera to access event timestamp
  useEffect(() => {
    if (params?.cameraId && params?.timestamp) {
      const targetCamId = params.cameraId;
      const targetTimeStr = params.timestamp;

      const dateObj = new Date(targetTimeStr);
      if (!isNaN(dateObj.getTime())) {
        // Convert to seconds from midnight local time
        const secondsFromMidnight = dateObj.getHours() * 3600 + dateObj.getMinutes() * 60 + dateObj.getSeconds();

        // 1. Find if already assigned
        let slotIdx = slotAssignments.indexOf(targetCamId);
        if (slotIdx === -1) {
          slotIdx = selectedSlotIndex;
          setSlotAssignments(prev => {
            const next = [...prev];
            next[slotIdx] = targetCamId;
            return next;
          });
        }

        // 2. Seek time
        setSlotTimehead(prev => {
          const next = [...prev];
          next[slotIdx] = secondsFromMidnight;
          return next;
        });

        // 3. Focus slot
        setSelectedSlotIndex(slotIdx);

        // 4. Pause simulation so operator can see frame
        setIsPlaying(false);
      }
    }
  }, [params]);

  // Pre-fill slots with active cameras initially
  useEffect(() => {
    if (cameras.length > 0) {
      const activeCams = cameras.filter(c => c.statut === "active");
      const assignments = [...slotAssignments];
      for (let i = 0; i < getSlotCount(layout); i++) {
        if (activeCams[i] && assignments[i] === null) {
          assignments[i] = activeCams[i].id;
        }
      }
      setSlotAssignments(assignments);
    }
  }, [cameras, layout]);

  // Tick timer for simulated video playback
  useEffect(() => {
    let lastTime = performance.now();
    let animFrame: number;

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        const secondsToAdd = delta * playbackSpeed;
        
        setSlotTimehead(prev => {
          const next = [...prev];
          
          if (isSynchronized) {
            // Apply same time to all slots, loop back at 24h (86400s)
            const currentSelectedTime = next[selectedSlotIndex] || 43200;
            let targetTime = (currentSelectedTime + secondsToAdd) % 86400;
            if (targetTime < 0) targetTime = 86400 + targetTime;
            
            return next.map(() => targetTime);
          } else {
            // Apply only to selected slot
            let targetTime = (next[selectedSlotIndex] + secondsToAdd) % 86400;
            if (targetTime < 0) targetTime = 86400 + targetTime;
            next[selectedSlotIndex] = targetTime;
            return next;
          }
        });
      }

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [isPlaying, playbackSpeed, isSynchronized, selectedSlotIndex]);

  // Active Camera ID & Name Helpers
  const activeCameraId = slotAssignments[selectedSlotIndex];
  const activeCamera = useMemo(() => {
    return cameras.find(c => c.id === activeCameraId);
  }, [cameras, activeCameraId]);

  const activeTimehead = slotTimehead[selectedSlotIndex];

  // Helper to format time (seconds to HH:MM:SS)
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getSlotCount = (l: LayoutType) => {
    if (l === "1x1") return 1;
    if (l === "2x2") return 4;
    return 9;
  };

  // Zoom logic details
  const zoomFactor = useMemo(() => {
    if (timelineZoom === "day") return 120; // 1px = 120s (2 minutes)
    if (timelineZoom === "hour") return 10;  // 1px = 10s
    return 1.5;                              // 1px = 1.5s (high precision)
  }, [timelineZoom]);

  // Drag timeline handlers
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    isDraggingTimeline.current = true;
    dragStartX.current = e.clientX;
    dragStartTimehead.current = activeTimehead;
  };

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTimeline.current) return;
    const diffX = e.clientX - dragStartX.current;
    const timeDelta = -diffX * zoomFactor;
    
    let newTime = dragStartTimehead.current + timeDelta;
    if (newTime < 0) newTime = 0;
    if (newTime > 86400) newTime = 86400;

    setSlotTimehead(prev => {
      const next = [...prev];
      if (isSynchronized) {
        return next.map(() => newTime);
      } else {
        next[selectedSlotIndex] = newTime;
        return next;
      }
    });
  };

  const handleTimelineMouseUpOrLeave = () => {
    isDraggingTimeline.current = false;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineContainerRef.current) return;
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const centerOffset = width / 2;

    const timeDelta = (clickX - centerOffset) * zoomFactor;
    let newTime = activeTimehead + timeDelta;
    if (newTime < 0) newTime = 0;
    if (newTime > 86400) newTime = 86400;

    setSlotTimehead(prev => {
      const next = [...prev];
      if (isSynchronized) {
        return next.map(() => newTime);
      } else {
        next[selectedSlotIndex] = newTime;
        return next;
      }
    });
  };

  // Add a safety bookmark
  const handleAddBookmark = () => {
    if (!newBookmarkName.trim() || !activeCameraId) return;
    
    const newB: VideoBookmark = {
      id: `bookmark-${Date.now()}`,
      cameraId: activeCameraId,
      cameraName: activeCamera?.nom || "Caméra",
      timestamp: activeTimehead,
      name: newBookmarkName.trim(),
      note: newBookmarkNote.trim(),
      dateStr: new Date().toLocaleDateString()
    };

    const updated = [...bookmarks, newB];
    setBookmarks(updated);
    localStorage.setItem("wardis-bookmarks", JSON.stringify(updated));
    setNewBookmarkName("");
    setNewBookmarkNote("");
    setShowBookmarkModal(false);
  };

  const handleDeleteBookmark = (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem("wardis-bookmarks", JSON.stringify(updated));
  };

  // Handle Export Simulation
  const handleStartExport = () => {
    if (exportInPoint === null || exportOutPoint === null || exportInPoint >= exportOutPoint || !activeCameraId) return;

    const taskId = `export-${Date.now()}`;
    const newExport: ExportTask = {
      id: taskId,
      cameraName: activeCamera?.nom || "Caméra",
      startTime: exportInPoint,
      endTime: exportOutPoint,
      operator: exportOperatorName,
      motif: exportMotif || "Investigation Standard",
      integrityHash: "Generating...",
      dateStr: new Date().toLocaleString(),
      status: "processing",
      progress: 0
    };

    setExportsList(prev => [newExport, ...prev]);
    setShowExportModal(false);
    setExportMotif("");

    // Simulate progress
    let prog = 0;
    const interval = setInterval(() => {
      prog += 10;
      setExportsList(prev => 
        prev.map(item => {
          if (item.id === taskId) {
            if (prog >= 100) {
              clearInterval(interval);
              // Calculate custom deterministic hash to simulate chain of custody SHA-256
              const fakeHash = "SHA256-" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join("");
              return { ...item, progress: 100, status: "completed", integrityHash: fakeHash };
            }
            return { ...item, progress: prog };
          }
          return item;
        })
      );
    }, 400);
  };

  // Drag and Drop from Sidebar tree to grid slot
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, slotIdx: number) => {
    e.preventDefault();
    const camId = e.dataTransfer.getData("wardis/camera-id") || e.dataTransfer.getData("text/plain");
    if (camId) {
      setSlotAssignments(prev => {
        const next = [...prev];
        next[slotIdx] = camId;
        return next;
      });
      setSelectedSlotIndex(slotIdx);
    }
  };

  // Filtered cameras based on search input
  const filteredCameras = useMemo(() => {
    return cameras.filter(c => c.nom.toLowerCase().includes(cameraSearch.toLowerCase()));
  }, [cameras, cameraSearch]);

  // Bookmarks matching the search
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter(b => 
      b.name.toLowerCase().includes(bookmarkSearch.toLowerCase()) || 
      b.note.toLowerCase().includes(bookmarkSearch.toLowerCase()) ||
      b.cameraName.toLowerCase().includes(bookmarkSearch.toLowerCase())
    );
  }, [bookmarks, bookmarkSearch]);

  // Pre-configured colored timeline events (blue=continuous, orange=motion, red=alarm)
  const timelineSegments = useMemo(() => {
    return [
      // 08:00 - 10:00 Motion
      { start: 28800, end: 36000, type: "motion" },
      // 10:00 - 10:30 Alarm
      { start: 36000, end: 37800, type: "alarm" },
      // 10:30 - 14:00 Continuous
      { start: 37800, end: 50400, type: "continuous" },
      // 14:00 - 14:15 Alarm
      { start: 50400, end: 51300, type: "alarm" },
      // 14:15 - 18:00 Motion
      { start: 51300, end: 64800, type: "motion" },
      // 18:00 - 22:00 Continuous
      { start: 64800, end: 79200, type: "continuous" }
    ];
  }, []);

  // Check locking state
  const activeLockOperator = activeCameraId ? ptzLockedByOther[activeCameraId] : null;

  return (
    <div className="flex h-full w-full bg-control-bg text-control-text font-mono text-xs overflow-hidden select-none">
      
      {/* LEFT PANEL: Directory / Bookmarks / Exports */}
      <div className="w-80 bg-control-panel border-r border-control-border flex flex-col shrink-0">
        
        {/* Search & Tree Section */}
        <div className="p-3 border-b border-control-border flex flex-col gap-2">
          <div className="text-[10px] text-control-text/60 uppercase font-bold tracking-widest">
            {t("taskCameraConfig" as any) || "Répertoire des Caméras"}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-control-text/40" />
            <input
              type="text"
              placeholder="Rechercher caméras..."
              value={cameraSearch}
              onChange={(e) => setCameraSearch(e.target.value)}
              className="w-full bg-control-panel-light border border-control-border rounded pl-8 pr-3 py-1.5 text-xs text-control-text placeholder-control-text/40 focus:outline-none focus:border-control-cyan transition-colors"
            />
          </div>

          {/* Draggable Camera List */}
          <div className="max-h-40 overflow-y-auto mt-2 space-y-1 pr-1 border border-control-border/40 bg-control-bg/25 rounded p-1.5">
            {loading ? (
              <div className="text-[10px] text-center text-control-text/40 py-2">Chargement...</div>
            ) : filteredCameras.length === 0 ? (
              <div className="text-[10px] text-center text-control-text/40 py-2">Aucune caméra</div>
            ) : (
              filteredCameras.map((cam) => {
                const isAssigned = slotAssignments.includes(cam.id);
                return (
                  <div
                    key={cam.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("wardis/camera-id", cam.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={`flex items-center justify-between p-1.5 rounded cursor-grab hover:bg-control-cyan/15 hover:border-control-cyan/30 border border-transparent transition-all group ${isAssigned ? "text-control-cyan font-bold bg-control-cyan/5 border-control-cyan/20" : ""}`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <Video className="h-3 w-3 text-control-text/60 group-hover:text-control-cyan shrink-0" />
                      {cam.nom}
                    </span>
                    <span className={`text-[8px] px-1 border rounded shrink-0 ${cam.ptz_supported ? "border-control-cyan text-control-cyan bg-control-cyan/5" : "border-control-border text-control-text/40"}`}>
                      {cam.ptz_supported ? "PTZ" : "FIX"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BOOKMARKS (SIGNETS) SECTION */}
        <div className="flex-1 min-h-0 flex flex-col border-b border-control-border">
          <div className="p-3 bg-control-panel-light/30 border-b border-control-border flex items-center justify-between">
            <span className="text-[10px] text-control-text/60 uppercase font-bold tracking-widest flex items-center gap-1">
              <Bookmark className="h-3.5 w-3.5 text-control-cyan" />
              Signets d'Investigation
            </span>
            <button
              onClick={() => {
                if (activeCameraId) setShowBookmarkModal(true);
              }}
              disabled={!activeCameraId}
              className={`p-1 border border-control-border rounded hover:bg-control-cyan hover:text-black cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none`}
              title="Ajouter un signet à l'instant actuel"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div className="p-2 border-b border-control-border/60">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 h-3 w-3 text-control-text/40" />
              <input
                type="text"
                placeholder="Filtrer les notes de signets..."
                value={bookmarkSearch}
                onChange={(e) => setBookmarkSearch(e.target.value)}
                className="w-full bg-control-panel-light border border-control-border rounded pl-7 pr-3 py-1 text-[10px] text-control-text placeholder-control-text/40 focus:outline-none focus:border-control-cyan transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredBookmarks.length === 0 ? (
              <div className="text-[10px] text-center text-control-text/40 italic py-4">
                Aucun signet créé. Cliquez sur le bouton "+" ci-dessus pour marquer un instant.
              </div>
            ) : (
              filteredBookmarks.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    // Find if camera is in grid, if not assign to selected slot
                    const slotIdx = slotAssignments.indexOf(b.cameraId);
                    const targetSlot = slotIdx !== -1 ? slotIdx : selectedSlotIndex;
                    if (slotIdx === -1) {
                      setSlotAssignments(prev => {
                        const next = [...prev];
                        next[targetSlot] = b.cameraId;
                        return next;
                      });
                    }
                    setSelectedSlotIndex(targetSlot);
                    
                    // Jump playhead
                    setSlotTimehead(prev => {
                      const next = [...prev];
                      if (isSynchronized) {
                        return next.map(() => b.timestamp);
                      } else {
                        next[targetSlot] = b.timestamp;
                        return next;
                      }
                    });
                  }}
                  className="p-2 border border-control-border bg-control-panel-light/20 hover:border-control-cyan/40 rounded transition-colors cursor-pointer group relative"
                >
                  <div className="flex justify-between items-center text-[10px] text-control-text-bright font-bold">
                    <span className="truncate pr-4 text-control-cyan">{b.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBookmark(b.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-control-red transition-all cursor-pointer absolute right-2 top-2 p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-[9px] text-control-text/50 mt-0.5 flex justify-between">
                    <span className="truncate">{b.cameraName}</span>
                    <span className="font-mono text-control-text/80">{formatTime(b.timestamp)}</span>
                  </div>
                  {b.note && (
                    <div className="text-[9px] text-control-text/70 mt-1 italic border-l border-control-border/60 pl-1.5 line-clamp-2">
                      {b.note}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* EXPORTS QUEUE / PROOF CHAIN */}
        <div className="h-44 shrink-0 flex flex-col bg-control-panel-light/10">
          <div className="p-2 border-b border-control-border flex items-center justify-between bg-control-panel/40">
            <span className="text-[10px] text-control-text/60 uppercase font-bold tracking-widest flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-control-green animate-pulse" />
              Chaîne de Preuve (Exports)
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {exportsList.length === 0 ? (
              <div className="text-[10px] text-center text-control-text/30 italic py-4">
                Aucun export en cours. Sélectionnez des points IN/OUT sur la timeline.
              </div>
            ) : (
              exportsList.map((exp) => (
                <div key={exp.id} className="p-2 border border-control-border/60 bg-control-panel/40 rounded text-[9px] space-y-1">
                  <div className="flex justify-between items-center text-control-text-bright font-bold">
                    <span className="truncate">{exp.cameraName}</span>
                    <span className={`${exp.status === "completed" ? "text-control-green" : "text-control-cyan animate-pulse"}`}>
                      {exp.status === "completed" ? "Prêt" : `${exp.progress}%`}
                    </span>
                  </div>
                  <div className="text-control-text/60 flex justify-between">
                    <span>{formatTime(exp.startTime)} - {formatTime(exp.endTime)}</span>
                    <span>OP: {exp.operator}</span>
                  </div>
                  {exp.status === "completed" ? (
                    <div className="font-mono text-[8px] bg-black/40 border border-control-border/40 p-1 rounded text-control-green truncate select-all" title="Copier le certificat d'intégrité SHA-256">
                      {exp.integrityHash}
                    </div>
                  ) : (
                    <div className="w-full bg-control-border/40 h-1 rounded overflow-hidden mt-1">
                      <div className="bg-control-cyan h-full transition-all duration-300" style={{ width: `${exp.progress}%` }} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* CENTER WORKSPACE: Grid & Timeline */}
      <div className="flex-1 flex flex-col overflow-hidden bg-control-bg">
        
        {/* TOP CONTROLS: Grid selectors & Sync switches */}
        <div className="h-12 border-b border-control-border bg-control-panel flex items-center justify-between px-4 shrink-0">
          
          {/* Synchronized playback switches */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSynchronized(!isSynchronized)}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg font-bold text-[10px] uppercase transition-all cursor-pointer ${isSynchronized ? "bg-control-cyan/15 text-control-cyan border-control-cyan/45 shadow-[0_0_10px_rgba(0,240,255,0.08)]" : "border-control-border text-control-text hover:bg-control-panel-light"}`}
            >
              <ArrowLeftRight className={`h-3.5 w-3.5 ${isSynchronized ? "animate-pulse" : ""}`} />
              <span>Lecture Synchronisée</span>
            </button>
            <span className="text-[10px] text-control-text/40 border-l border-control-border pl-3">
              Actuel : <span className="text-control-text-bright font-bold">{formatTime(activeTimehead)}</span>
            </span>
          </div>

          {/* Grid Size Selectors */}
          <div className="flex items-center gap-1.5 bg-control-panel-light/30 border border-control-border/60 p-1 rounded-lg">
            {(["1x1", "2x2", "3x3"] as LayoutType[]).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setLayout(g);
                  setSelectedSlotIndex(0);
                }}
                className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${layout === g ? "bg-control-cyan text-black" : "text-control-text hover:bg-control-panel-light"}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* WORKSPACE MAIN CANVAS: Grid Layout */}
        <div className="flex-1 min-h-0 relative p-4 flex gap-4">
          
          {/* Main Grid View */}
          <div className="flex-1 min-w-0 relative">
            <div className={`h-full w-full grid gap-2.5 ${layout === "1x1" ? "grid-cols-1 grid-rows-1" : layout === "2x2" ? "grid-cols-2 grid-rows-2" : "grid-cols-3 grid-rows-3"}`}>
              {Array.from({ length: getSlotCount(layout) }).map((_, idx) => {
                const isSelected = selectedSlotIndex === idx;
                const camId = slotAssignments[idx];
                const cam = cameras.find(c => c.id === camId);
                const timehead = slotTimehead[idx] || 43200;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedSlotIndex(idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`relative rounded-xl border overflow-hidden flex flex-col bg-black transition-all ${isSelected ? "border-control-cyan ring-1 ring-control-cyan/40 shadow-[0_0_15px_rgba(0,240,255,0.1)]" : "border-control-border hover:border-control-border-bright"}`}
                  >
                    
                    {/* Slot Header overlay */}
                    <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-10 bg-black/65 backdrop-blur-sm border border-control-border/30 rounded-lg p-1.5 text-[10px]">
                      <span className="font-bold flex items-center gap-1 text-control-text-bright truncate max-w-[130px]">
                        <Video className="h-3.5 w-3.5 text-control-cyan shrink-0" />
                        {cam ? cam.nom : `Slot de Lecture ${idx + 1}`}
                      </span>
                      <span className="text-[9px] font-mono text-control-cyan shrink-0">
                        {formatTime(timehead)}
                      </span>
                    </div>

                    {/* Camera playback simulation viewport */}
                    {cam ? (
                      <div className="flex-1 w-full h-full relative group flex items-center justify-center overflow-hidden">
                        
                        {/* Fake Stream Drawing using pure CSS & Canvas simulated pattern */}
                        <div className="absolute inset-0 bg-neutral-900 flex flex-col items-center justify-center">
                          {/* Noise pattern simulation */}
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,_rgba(255,0,0,0.06),_rgba(0,255,0,0.02),_rgba(0,0,255,0.06))] bg-[size:100%_4px,_6px_100%] opacity-20 pointer-events-none" />
                          
                          {/* Camera timestamp visual watermarking */}
                          <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-[9px] font-mono border border-control-border/20 text-neutral-300">
                            {baseDate.toLocaleDateString()} {formatTime(timehead)}
                          </div>
                          
                          {/* Playback speed indicator overlay */}
                          {playbackSpeed !== 1 && (
                            <div className="absolute top-12 right-3 bg-control-cyan/15 border border-control-cyan/45 text-control-cyan font-bold px-2 py-0.5 rounded text-[8px]">
                              {playbackSpeed > 1 ? `RAPIDE x${playbackSpeed}` : `LENT x${playbackSpeed}`}
                            </div>
                          )}

                          {/* Recording status flag */}
                          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/70 px-2 py-1 border border-control-border/30 rounded text-[9px]">
                            <span className="h-2 w-2 rounded-full bg-control-cyan animate-pulse" />
                            <span className="text-[8px] text-control-text/70 uppercase">ARCHIVE</span>
                          </div>

                          {/* Security camera live layout representation */}
                          <div className="text-center select-none pointer-events-none space-y-1">
                            <Tv className="h-8 w-8 text-control-text/20 mx-auto animate-pulse" />
                            <div className="text-[10px] text-control-text/60 font-bold uppercase tracking-widest">{cam.nom}</div>
                            <div className="text-[9px] text-control-text/30 font-mono">1920x1080 @ 30FPS // H.264 Archive</div>
                          </div>
                        </div>

                        {/* Joystick HUD Overlay if selected & PTZ enabled */}
                        {isSelected && cam.ptz_supported && (
                          <div className="absolute top-12 left-3 z-30">
                            {activeLockOperator ? (
                              <div className="flex items-center gap-1.5 bg-control-red/20 border border-control-red/50 text-control-red text-[8px] px-2 py-1 rounded-md shadow-md animate-pulse">
                                <Lock className="h-3 w-3 shrink-0" />
                                <span>Verrouillé par : {activeLockOperator}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-control-green/20 border border-control-green/50 text-control-green text-[8px] px-2 py-0.5 rounded-md">
                                <span>PTZ Dispo</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Visual overlay indicator when timeline scrub or speed */}
                        {!isPlaying && (
                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center pointer-events-none">
                            <span className="bg-black/80 border border-control-border/40 rounded-lg p-3 text-[10px] flex items-center gap-2">
                              <Pause className="h-4 w-4 text-control-cyan" />
                              <span>PAUSE</span>
                            </span>
                          </div>
                        )}

                        {/* Drag swap target helper */}
                        <div className="absolute inset-0 border-2 border-dashed border-control-cyan/40 bg-control-cyan/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                          <span className="bg-black/90 text-control-cyan text-[10px] px-2.5 py-1.5 border border-control-cyan/45 rounded-lg uppercase tracking-wider font-bold">
                            Glisser ici pour assigner
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 w-full h-full flex flex-col items-center justify-center gap-2 bg-neutral-950 text-neutral-600 border border-dashed border-control-border/60 m-2 rounded-lg">
                        <Plus className="h-6 w-6 text-control-text/20" />
                        <span className="text-[10px] uppercase tracking-wider text-control-text/40">Glissez une caméra ici</span>
                      </div>
                    )}

                    {/* Slot footer toolbar */}
                    {cam && (
                      <div className="h-7 shrink-0 bg-neutral-950 border-t border-control-border/30 flex items-center justify-between px-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSlotAssignments(prev => {
                              const next = [...prev];
                              next[idx] = null;
                              return next;
                            });
                          }}
                          className="hover:text-control-red p-1 cursor-pointer transition-colors"
                          title="Vider le slot"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExportInPoint(timehead);
                            }}
                            className="text-[8px] bg-control-panel-light border border-control-border px-1.5 py-0.5 rounded text-control-cyan hover:bg-control-cyan/15 cursor-pointer font-bold"
                          >
                            SET IN
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExportOutPoint(timehead);
                            }}
                            className="text-[8px] bg-control-panel-light border border-control-border px-1.5 py-0.5 rounded text-control-cyan hover:bg-control-cyan/15 cursor-pointer font-bold"
                          >
                            SET OUT
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDE: PTZ Overlay Controller HUD */}
          {activeCamera && activeCamera.ptz_supported && (
            <div className="w-56 shrink-0 bg-control-panel border border-control-border rounded-xl p-3.5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-control-border/60 pb-2">
                <span className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Compass className="h-4 w-4" />
                  PTZ Archivé
                </span>
                <span className="text-[8px] uppercase px-1 border border-control-cyan bg-control-cyan/5 text-control-cyan font-bold rounded">
                  Actif
                </span>
              </div>

              {/* LOCK STATE MESSAGE */}
              {activeLockOperator && (
                <div className="p-2 bg-control-red/10 border border-control-red/35 rounded-lg text-control-red text-[8px] leading-relaxed flex flex-col gap-1">
                  <div className="font-bold flex items-center gap-1">
                    <Lock className="h-3 w-3 shrink-0" />
                    CONFLIT DE CONTRÔLE
                  </div>
                  <p>Cette caméra est verrouillée par l'opérateur {activeLockOperator}. Vos commandes sont bridées.</p>
                </div>
              )}

              {/* Joystick Grid Layout */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[8px] text-control-text/40 uppercase tracking-widest font-bold">Directional Joystick</div>
                <div className="relative w-28 h-28 bg-control-panel-light border border-control-border rounded-full flex items-center justify-center shadow-inner">
                  {/* Outer Compass Compass lines */}
                  <div className="absolute inset-2 rounded-full border border-dashed border-control-border/30 pointer-events-none" />
                  
                  {/* Compass buttons */}
                  <button
                    disabled={!!activeLockOperator}
                    className="absolute top-1 hover:text-control-cyan disabled:opacity-20 cursor-pointer p-1"
                    title="Haut"
                  >
                    <ChevronUp className="h-5 w-5" />
                  </button>
                  <button
                    disabled={!!activeLockOperator}
                    className="absolute bottom-1 hover:text-control-cyan disabled:opacity-20 cursor-pointer p-1"
                    title="Bas"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                  <button
                    disabled={!!activeLockOperator}
                    className="absolute left-1 hover:text-control-cyan disabled:opacity-20 cursor-pointer p-1"
                    title="Gauche"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    disabled={!!activeLockOperator}
                    className="absolute right-1 hover:text-control-cyan disabled:opacity-20 cursor-pointer p-1"
                    title="Droite"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  {/* Inner Joystick circle */}
                  <div className="w-10 h-10 rounded-full bg-control-panel border border-control-cyan/40 hover:border-control-cyan flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg">
                    <div className="w-3.5 h-3.5 rounded-full bg-control-cyan" />
                  </div>
                </div>
              </div>

              {/* Zoom & Iris sliders */}
              <div className="space-y-3">
                
                {/* Zoom */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] uppercase text-control-text/60">
                    <span>Niveau de Zoom</span>
                    <span className="text-control-cyan font-bold">x{ptzZoomLevel.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.1"
                    value={ptzZoomLevel}
                    onChange={(e) => {
                      if (!activeLockOperator) setPtzZoomLevel(parseFloat(e.target.value));
                    }}
                    disabled={!!activeLockOperator}
                    className="w-full accent-control-cyan h-1 bg-control-border rounded-lg appearance-none disabled:opacity-30"
                  />
                </div>

                {/* Focus */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] uppercase text-control-text/60">
                    <span>Mise au Point (Focus)</span>
                    <span className="text-control-text-bright">{ptzFocus}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ptzFocus}
                    onChange={(e) => {
                      if (!activeLockOperator) setPtzFocus(parseInt(e.target.value));
                    }}
                    disabled={!!activeLockOperator}
                    className="w-full accent-control-cyan h-1 bg-control-border rounded-lg appearance-none disabled:opacity-30"
                  />
                </div>

                {/* Iris */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] uppercase text-control-text/60">
                    <span>Ouverture (Iris)</span>
                    <span className="text-control-text-bright">{ptzIris}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ptzIris}
                    onChange={(e) => {
                      if (!activeLockOperator) setPtzIris(parseInt(e.target.value));
                    }}
                    disabled={!!activeLockOperator}
                    className="w-full accent-control-cyan h-1 bg-control-border rounded-lg appearance-none disabled:opacity-30"
                  />
                </div>
              </div>

              {/* Presets Grid */}
              <div className="space-y-2">
                <div className="text-[8px] text-control-text/40 uppercase tracking-widest font-bold">Presets Préréglés</div>
                <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <button
                      key={idx}
                      disabled={!!activeLockOperator}
                      onClick={() => {
                        if (!activeLockOperator) {
                          // Simulate jump
                          setPtzZoomLevel(1 + idx * 0.8);
                        }
                      }}
                      className="py-1 bg-control-panel-light hover:bg-control-cyan hover:text-black border border-control-border hover:border-transparent rounded font-bold cursor-pointer disabled:opacity-20 disabled:pointer-events-none transition-all"
                    >
                      Preset {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patrol triggers */}
              <div className="space-y-2 mt-auto">
                <button
                  disabled={!!activeLockOperator}
                  onClick={() => setIsPatrolling(!isPatrolling)}
                  className={`w-full py-1.5 border rounded font-bold text-[9px] uppercase transition-all cursor-pointer ${isPatrolling ? "bg-control-red/25 border-control-red text-control-red animate-pulse" : "border-control-cyan text-control-cyan hover:bg-control-cyan/15 disabled:opacity-20"}`}
                >
                  {isPatrolling ? "STOP PATROUILLE" : "LANCER PATROUILLE"}
                </button>
              </div>

            </div>
          )}
        </div>

        {/* BOTTOM SECTION: Playback controls & Timeline ruler */}
        <div className="h-52 border-t border-control-border bg-control-panel flex flex-col shrink-0 overflow-hidden">
          
          {/* PLAYBACK HUD BAR */}
          <div className="h-12 border-b border-control-border/60 bg-control-panel-light/35 flex items-center justify-between px-6 shrink-0">
            
            {/* Speed triggers */}
            <div className="flex items-center gap-1">
              {([0.25, 0.5, 1, 2, 4, 8, 16] as number[]).map((sp) => (
                <button
                  key={sp}
                  onClick={() => setPlaybackSpeed(sp)}
                  className={`px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-colors ${playbackSpeed === sp ? "bg-control-cyan text-black" : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright"}`}
                >
                  x{sp}
                </button>
              ))}
            </div>

            {/* Playhead buttons */}
            <div className="flex items-center gap-3">
              
              {/* Back frame */}
              <button
                onClick={() => {
                  setSlotTimehead(prev => {
                    const next = [...prev];
                    const target = Math.max(0, (next[selectedSlotIndex] || 43200) - 1);
                    if (isSynchronized) return next.map(() => target);
                    next[selectedSlotIndex] = target;
                    return next;
                  });
                }}
                className="p-2 border border-control-border rounded-lg text-control-text hover:text-control-cyan hover:bg-control-panel-light cursor-pointer"
                title="Image par image arrière (-1s)"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              {/* Rewind Fast */}
              <button
                onClick={() => {
                  setIsPlaying(true);
                  setPlaybackSpeed(-4);
                }}
                className={`p-2 border rounded-lg cursor-pointer ${isPlaying && playbackSpeed < 0 ? "bg-control-cyan/15 text-control-cyan border-control-cyan/45" : "border-control-border text-control-text hover:text-control-cyan hover:bg-control-panel-light"}`}
                title="Retour rapide (x-4)"
              >
                <Rewind className="h-4 w-4" />
              </button>

              {/* Play / Pause Toggle */}
              <button
                onClick={() => {
                  setIsPlaying(!isPlaying);
                  setPlaybackSpeed(1);
                }}
                className={`p-3 rounded-full cursor-pointer transition-all ${isPlaying ? "bg-control-cyan text-black" : "border border-control-cyan text-control-cyan bg-control-cyan/5 hover:bg-control-cyan/15"}`}
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>

              {/* Fast Forward */}
              <button
                onClick={() => {
                  setIsPlaying(true);
                  setPlaybackSpeed(4);
                }}
                className={`p-2 border rounded-lg cursor-pointer ${isPlaying && playbackSpeed > 1 ? "bg-control-cyan/15 text-control-cyan border-control-cyan/45" : "border-control-border text-control-text hover:text-control-cyan hover:bg-control-panel-light"}`}
                title="Avance rapide (x4)"
              >
                <FastForward className="h-4 w-4" />
              </button>

              {/* Forward frame */}
              <button
                onClick={() => {
                  setSlotTimehead(prev => {
                    const next = [...prev];
                    const target = Math.min(86400, (next[selectedSlotIndex] || 43200) + 1);
                    if (isSynchronized) return next.map(() => target);
                    next[selectedSlotIndex] = target;
                    return next;
                  });
                }}
                className="p-2 border border-control-border rounded-lg text-control-text hover:text-control-cyan hover:bg-control-panel-light cursor-pointer"
                title="Image par image avant (+1s)"
              >
                <SkipForward className="h-4 w-4" />
              </button>

            </div>

            {/* Export and Bookmark shortcuts */}
            <div className="flex items-center gap-3">
              <button
                disabled={exportInPoint === null || exportOutPoint === null}
                onClick={() => {
                  if (activeCameraId) setShowExportModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-control-cyan text-black hover:bg-control-cyan-light disabled:opacity-30 disabled:pointer-events-none rounded-lg font-bold text-[10px] uppercase cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exporter MP4</span>
              </button>
            </div>

          </div>

          {/* TIMELINE SCALE SELECTOR & LEGEND */}
          <div className="h-8 border-b border-control-border/60 bg-control-panel flex items-center justify-between px-6 text-[9px]">
            <div className="flex gap-4 items-center">
              <span className="text-control-text/40 uppercase font-bold tracking-wider">Légende :</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-4 bg-blue-600 rounded" />
                <span className="text-control-text/70">Continu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-4 bg-amber-500 rounded" />
                <span className="text-control-text/70">Mouvement</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-4 bg-red-600 rounded animate-pulse" />
                <span className="text-control-text/70">Alarme</span>
              </div>
            </div>

            {/* Scale Zoom Controls */}
            <div className="flex items-center gap-2">
              <span className="text-control-text/40 uppercase font-bold tracking-wider mr-1">Échelle :</span>
              {(["day", "hour", "minute"] as const).map((z) => (
                <button
                  key={z}
                  onClick={() => setTimelineZoom(z)}
                  className={`px-2 py-0.5 border rounded cursor-pointer transition-colors uppercase ${timelineZoom === z ? "bg-control-cyan border-transparent text-black font-bold" : "border-control-border text-control-text/60 hover:text-control-text"}`}
                >
                  {z === "day" ? "Jour" : z === "hour" ? "Heure" : "Minute"}
                </button>
              ))}
            </div>
          </div>

          {/* INTERACTIVE TIMELINE RULER */}
          <div 
            ref={timelineContainerRef}
            onMouseDown={handleTimelineMouseDown}
            onMouseMove={handleTimelineMouseMove}
            onMouseUp={handleTimelineMouseUpOrLeave}
            onMouseLeave={handleTimelineMouseUpOrLeave}
            onClick={handleTimelineClick}
            className="flex-1 w-full relative bg-neutral-950/80 cursor-ew-resize overflow-hidden"
          >
            {/* Timeline center line cursor */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-control-cyan z-20 shadow-[0_0_10px_rgba(0,240,255,0.7)] pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-control-cyan text-black px-1.5 py-0.5 text-[8px] font-bold rounded-b-md z-30 pointer-events-none shadow-md">
              {formatTime(activeTimehead)}
            </div>

            {/* In / Out Point Flags */}
            {exportInPoint !== null && (
              <div 
                className="absolute top-0 bottom-0 border-l border-control-cyan/70 bg-control-cyan/10 pointer-events-none z-10"
                style={{
                  left: `calc(50% + ${(exportInPoint - activeTimehead) / zoomFactor}px)`
                }}
              >
                <span className="absolute top-4 left-1 bg-control-cyan/20 border border-control-cyan text-control-cyan text-[8px] font-bold px-1 rounded">IN</span>
              </div>
            )}

            {exportOutPoint !== null && (
              <div 
                className="absolute top-0 bottom-0 border-r border-control-cyan/70 bg-control-cyan/10 pointer-events-none z-10"
                style={{
                  left: `calc(50% + ${(exportOutPoint - activeTimehead) / zoomFactor}px)`
                }}
              >
                <span className="absolute top-4 right-1 bg-control-cyan/20 border border-control-cyan text-control-cyan text-[8px] font-bold px-1 rounded">OUT</span>
              </div>
            )}

            {/* Visual Highlight of selected export segment */}
            {exportInPoint !== null && exportOutPoint !== null && (
              <div
                className="absolute top-0 bottom-0 bg-control-cyan/5 pointer-events-none z-0"
                style={{
                  left: `calc(50% + ${(exportInPoint - activeTimehead) / zoomFactor}px)`,
                  width: `${(exportOutPoint - exportInPoint) / zoomFactor}px`
                }}
              />
            )}

            {/* Bookmark Visual Pins */}
            {bookmarks.map((bm) => {
              if (bm.cameraId !== activeCameraId) return null;
              const offsetPx = (bm.timestamp - activeTimehead) / zoomFactor;
              return (
                <div
                  key={bm.id}
                  className="absolute top-8 h-4 w-4 text-control-cyan/90 cursor-pointer pointer-events-none flex items-center justify-center hover:scale-125 transition-transform"
                  style={{
                    left: `calc(50% + ${offsetPx}px)`,
                    transform: "translateX(-50%)"
                  }}
                  title={`Signet: ${bm.name}`}
                >
                  <Bookmark className="h-3.5 w-3.5 fill-current text-control-cyan" />
                </div>
              );
            })}

            {/* Custom timeline track drawing (Colored segments & Ruler marks) */}
            <div className="absolute inset-0 select-none pointer-events-none">
              
              {/* Colored Segments */}
              {timelineSegments.map((seg, sidx) => {
                const segStartPx = (seg.start - activeTimehead) / zoomFactor;
                const segWidthPx = (seg.end - seg.start) / zoomFactor;
                
                let bgClass = "bg-blue-600/30 border-blue-500/50";
                if (seg.type === "motion") bgClass = "bg-amber-500/25 border-amber-500/40";
                if (seg.type === "alarm") bgClass = "bg-red-600/30 border-red-500/60";

                return (
                  <div
                    key={sidx}
                    className={`absolute bottom-2 top-2 border-t border-b ${bgClass}`}
                    style={{
                      left: `calc(50% + ${segStartPx}px)`,
                      width: `${segWidthPx}px`
                    }}
                  />
                );
              })}

              {/* Major Hour Ticks & Labels */}
              {Array.from({ length: 48 }).map((_, hIdx) => {
                // Ticks every 30 minutes
                const tickTime = hIdx * 1800; 
                const tickOffsetPx = (tickTime - activeTimehead) / zoomFactor;

                const isHour = tickTime % 3600 === 0;
                const tickLabel = `${Math.floor(tickTime / 3600).toString().padStart(2, "0")}:${((tickTime % 3600) / 60).toString().padStart(2, "0")}`;

                return (
                  <div
                    key={hIdx}
                    className="absolute bottom-0 flex flex-col items-center justify-end h-8"
                    style={{
                      left: `calc(50% + ${tickOffsetPx}px)`,
                      transform: "translateX(-50%)"
                    }}
                  >
                    {isHour && (
                      <span className="text-[8px] text-control-text/40 font-mono mb-1">{tickLabel}</span>
                    )}
                    <div className={`w-0.5 bg-control-border ${isHour ? "h-3 bg-control-text/45" : "h-1.5 bg-control-border/40"}`} />
                  </div>
                );
              })}

            </div>
          </div>
        </div>

      </div>

      {/* BOOKMARK ADDITION MODAL */}
      {showBookmarkModal && (
        <div className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-control-panel border border-control-border rounded-xl w-full max-w-sm p-5 flex flex-col gap-4 font-mono shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-control-border pb-2.5">
              <span className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Bookmark className="h-4 w-4" />
                Nouveau Signet
              </span>
              <button
                onClick={() => setShowBookmarkModal(false)}
                className="text-control-text/60 hover:text-control-text cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] uppercase text-control-text/50">Titre du signet</label>
                <input
                  type="text"
                  placeholder="Ex: Intrusion suspecte, Livraison..."
                  value={newBookmarkName}
                  onChange={(e) => setNewBookmarkName(e.target.value)}
                  className="w-full bg-control-panel-light border border-control-border rounded p-2 text-xs text-control-text focus:outline-none focus:border-control-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase text-control-text/50">Notes libres / Description</label>
                <textarea
                  placeholder="Détails additionnels pour les enquêteurs..."
                  value={newBookmarkNote}
                  onChange={(e) => setNewBookmarkNote(e.target.value)}
                  rows={3}
                  className="w-full bg-control-panel-light border border-control-border rounded p-2 text-xs text-control-text focus:outline-none focus:border-control-cyan resize-none"
                />
              </div>

              <div className="p-2 border border-control-border/60 bg-control-bg/40 rounded text-[9px] text-control-text/60">
                <div className="flex justify-between">
                  <span>Caméra :</span>
                  <span className="text-control-text-bright font-bold">{activeCamera?.nom}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Instant :</span>
                  <span className="text-control-cyan font-bold">{formatTime(activeTimehead)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleAddBookmark}
                disabled={!newBookmarkName.trim()}
                className="flex-1 py-2 bg-control-cyan hover:bg-control-cyan-light disabled:opacity-30 disabled:pointer-events-none text-black font-bold uppercase tracking-widest transition-all cursor-pointer text-center rounded text-xs"
              >
                Enregistrer
              </button>
              <button
                onClick={() => setShowBookmarkModal(false)}
                className="px-4 py-2 border border-control-border hover:bg-control-panel-light text-control-text font-bold uppercase tracking-wider transition-all cursor-pointer rounded text-xs"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT OPTIONS DIALOG */}
      {showExportModal && (
        <div className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-control-panel border border-control-border rounded-xl w-full max-w-sm p-5 flex flex-col gap-4 font-mono shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between border-b border-control-border pb-2.5">
              <span className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                Paramètres d'Exportation
              </span>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-control-text/60 hover:text-control-text cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="p-3 border border-control-cyan/20 bg-control-cyan/5 rounded-lg text-[9px] text-control-text/80 space-y-1">
                <div className="font-bold text-control-cyan uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 shrink-0" />
                  Garantie de Chaîne de Preuve
                </div>
                <p>L'export génère un sceau cryptographique garantissant l'intégrité de la preuve pour exploitation judiciaire.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase text-control-text/50">Opérateur enquêteur</label>
                <input
                  type="text"
                  value={exportOperatorName}
                  onChange={(e) => setExportOperatorName(e.target.value)}
                  className="w-full bg-control-panel-light border border-control-border rounded p-2 text-xs text-control-text focus:outline-none focus:border-control-cyan"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase text-control-text/50">Motif de l'export / Enquête</label>
                <input
                  type="text"
                  placeholder="Ex: Signalement Police, Suspicion Vol..."
                  value={exportMotif}
                  onChange={(e) => setExportMotif(e.target.value)}
                  className="w-full bg-control-panel-light border border-control-border rounded p-2 text-xs text-control-text focus:outline-none focus:border-control-cyan"
                />
              </div>

              <div className="flex items-center justify-between p-2 border border-control-border/60 bg-control-bg/40 rounded-lg">
                <span className="text-[9px] uppercase text-control-text/70">Incruster horodatage / GPS</span>
                <input
                  type="checkbox"
                  checked={exportWatermark}
                  onChange={(e) => setExportWatermark(e.target.checked)}
                  className="accent-control-cyan h-4 w-4 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[9px] border border-control-border/40 p-2 rounded bg-neutral-950/40">
                <div>
                  <span className="text-control-text/50 block uppercase">Point IN</span>
                  <span className="font-bold text-control-text-bright">{exportInPoint !== null ? formatTime(exportInPoint) : "--:--:--"}</span>
                </div>
                <div>
                  <span className="text-control-text/50 block uppercase">Point OUT</span>
                  <span className="font-bold text-control-text-bright">{exportOutPoint !== null ? formatTime(exportOutPoint) : "--:--:--"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleStartExport}
                disabled={exportInPoint === null || exportOutPoint === null || !exportOperatorName.trim()}
                className="flex-1 py-2 bg-control-cyan hover:bg-control-cyan-light disabled:opacity-30 disabled:pointer-events-none text-black font-bold uppercase tracking-widest transition-all cursor-pointer text-center rounded text-xs"
              >
                Générer l'export
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 border border-control-border hover:bg-control-panel-light text-control-text font-bold uppercase tracking-wider transition-all cursor-pointer rounded text-xs"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
