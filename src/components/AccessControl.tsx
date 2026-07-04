import React, { useEffect, useState, useMemo } from "react";
import { useAccessControlStore, Door } from "../store/accessControlStore";
import { useAuthStore } from "../store/authStore";
import { 
  Lock, 
  Unlock, 
  Search, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertCircle,
  Building,
  Key,
  Shield,
  Clock
} from "lucide-react";

// Standard Site Name Mapping
const SITE_NAMES: Record<string, string> = {
  "a0000000-0000-0000-0000-000000000001": "HQ Paris"
};

const getSiteName = (siteId?: string) => {
  if (!siteId) return "Unassigned Site";
  return SITE_NAMES[siteId] || `Site ${siteId.substring(0, 8)}`;
};

export const AccessControl: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    doors, 
    logs, 
    loading, 
    error, 
    fetchDoors, 
    openDoor, 
    closeDoor, 
    fetchAccessLogs,
    clearError 
  } = useAccessControlStore();

  const [activeSubTab, setActiveSubTab] = useState<"doors" | "history">("doors");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  
  // History Filters
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterDoorId, setFilterDoorId] = useState<string>("all");
  const [filterBadge, setFilterBadge] = useState<string>("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    fetchDoors();
    if (isAdmin) {
      fetchAccessLogs();
    }
  }, [fetchDoors, fetchAccessLogs, isAdmin]);

  const handleRefresh = async () => {
    await fetchDoors();
    if (isAdmin) {
      await fetchAccessLogs();
    }
  };

  const handleToggleDoor = async (door: Door) => {
    if (!isAdmin) return;
    try {
      if (door.status === "open") {
        await closeDoor(door.id);
      } else {
        await openDoor(door.id);
      }
    } catch (e) {
      console.error("Failed to toggle door status", e);
    }
  };

  // Get unique sites from doors list
  const sitesList = useMemo(() => {
    const ids = new Set<string>();
    doors.forEach(d => {
      if (d.site_id) ids.add(d.site_id);
    });
    return Array.from(ids).map(id => ({
      id,
      name: getSiteName(id)
    }));
  }, [doors]);

  // Filter doors
  const filteredDoors = useMemo(() => {
    if (selectedSiteId === "all") return doors;
    return doors.filter(d => d.site_id === selectedSiteId);
  }, [doors, selectedSiteId]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Date Filter
      if (filterDate) {
        const logDateStr = new Date(log.created_at).toISOString().split("T")[0];
        if (logDateStr !== filterDate) return false;
      }
      // 2. Door Filter
      if (filterDoorId !== "all" && log.door_id !== filterDoorId) {
        return false;
      }
      // 3. Badge Filter
      if (filterBadge && !log.badge_number.toLowerCase().includes(filterBadge.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, filterDate, filterDoorId, filterBadge]);

  // Helper to map door ID to name
  const doorNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    doors.forEach(d => {
      map[d.id] = d.name;
    });
    return map;
  }, [doors]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-control-panel/30 border border-control-border relative overflow-hidden">
      
      {/* Control bar / Sub-Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-control-border bg-control-panel/40 p-3 gap-3 shrink-0">
        
        {/* Sub tabs */}
        <div className="flex gap-2 text-xs font-mono">
          <button
            onClick={() => setActiveSubTab("doors")}
            className={`px-3 py-1.5 border transition-all uppercase tracking-wider font-bold cursor-pointer ${
              activeSubTab === "doors"
                ? "border-control-cyan text-control-cyan bg-control-cyan/5"
                : "border-control-border text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35"
            }`}
          >
            Doors Status & Controls
          </button>
          
          <button
            onClick={() => {
              if (!isAdmin) {
                // Show notification / do nothing
                return;
              }
              setActiveSubTab("history");
            }}
            disabled={!isAdmin}
            className={`px-3 py-1.5 border transition-all uppercase tracking-wider font-bold flex items-center gap-1.5 ${
              !isAdmin ? "opacity-40 cursor-not-allowed border-control-border text-control-text/40" :
              activeSubTab === "history"
                ? "border-control-cyan text-control-cyan bg-control-cyan/5"
                : "border-control-border text-control-text/60 hover:text-control-text hover:bg-control-panel-light/35 cursor-pointer"
            }`}
            title={!isAdmin ? "Requires Admin privileges" : undefined}
          >
            Access Logs History
            {!isAdmin && (
              <span className="text-[8px] px-1 bg-control-red/10 border border-control-red/30 text-control-red font-mono scale-90">
                LOCKED
              </span>
            )}
          </button>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-control-red font-mono px-3 py-1 border border-control-red/20 bg-control-red/5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
              <button 
                onClick={clearError} 
                className="ml-1 text-control-text hover:text-control-text-bright cursor-pointer"
              >
                [X]
              </button>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 text-control-cyan text-xs py-1.5 px-3.5 tracking-wider cursor-pointer font-bold transition-all hover:border-control-cyan/60 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>SYNC GATEWAY</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeSubTab === "doors" ? (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* Site Selector Sidebar */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-control-border bg-control-panel/20 p-4 shrink-0 font-mono text-xs">
            <div className="flex items-center gap-1.5 text-control-cyan font-bold uppercase tracking-wider mb-4 border-b border-control-border/40 pb-2">
              <Building className="h-4 w-4" />
              <span>Sites Directory</span>
            </div>
            
            <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
              <button
                onClick={() => setSelectedSiteId("all")}
                className={`w-full text-left px-3 py-2 border transition-all uppercase tracking-wider font-semibold whitespace-nowrap md:whitespace-normal cursor-pointer ${
                  selectedSiteId === "all"
                    ? "border-control-cyan/40 bg-control-cyan/10 text-control-cyan"
                    : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/30"
                }`}
              >
                [+] All Sites ({doors.length})
              </button>
              
              {sitesList.map((site) => {
                const count = doors.filter(d => d.site_id === site.id).length;
                return (
                  <button
                    key={site.id}
                    onClick={() => setSelectedSiteId(site.id)}
                    className={`w-full text-left px-3 py-2 border transition-all uppercase tracking-wider font-semibold whitespace-nowrap md:whitespace-normal cursor-pointer ${
                      selectedSiteId === site.id
                        ? "border-control-cyan/40 bg-control-cyan/10 text-control-cyan"
                        : "border-transparent text-control-text/60 hover:text-control-text hover:bg-control-panel-light/30"
                    }`}
                  >
                    // {site.name} ({count})
                  </button>
                );
              })}
            </div>

            <div className="hidden md:block mt-6 p-3 border border-control-border bg-control-panel-light/10 text-[10px] text-control-text/50 leading-relaxed">
              <div className="font-bold text-control-cyan/60 uppercase mb-1">Subsystem Telemetry</div>
              Access controller is operational. Direct socket connections are listening to badge reader triggers. Remote actions require signed authorization keys.
            </div>
          </div>

          {/* Doors Grid View */}
          <div className="flex-1 p-4 overflow-y-auto min-h-0">
            {filteredDoors.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-control-border border-dashed">
                <AlertCircle className="h-10 w-10 text-control-text/30 mb-2" />
                <div className="text-sm font-bold uppercase text-control-text-bright">No Doors Detected</div>
                <div className="text-xs text-control-text/60 font-mono mt-1">
                  Ensure the access-control service is fully deployed and synced.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDoors.map((door) => {
                  const isOpen = door.status === "open";
                  return (
                    <div 
                      key={door.id}
                      className="bg-control-panel border border-control-border rounded-xl overflow-hidden p-4 flex flex-col justify-between min-h-[160px] relative group shadow-sm hover:border-control-cyan/45 transition-all duration-200"
                    >
                      {/* Top status indicator line */}
                      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
                        isOpen ? "bg-control-green animate-pulse" : "bg-control-amber"
                      }`} />

                      <div>
                        {/* Door Header */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider font-mono">
                            {door.name}
                          </h3>
                          <div className={`flex items-center gap-1 text-[9px] px-2 py-0.5 border font-mono font-bold ${
                            isOpen 
                              ? "bg-control-green/10 border-control-green text-control-green" 
                              : "bg-control-amber/10 border-control-amber text-control-amber"
                          }`}>
                            {isOpen ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            <span className="uppercase">{door.status}</span>
                          </div>
                        </div>

                        {/* Door Metadata */}
                        <div className="mt-2 text-[10px] font-mono text-control-text/80 space-y-1">
                          <div>
                            <span className="text-control-cyan/70 font-semibold uppercase">Site:</span> {getSiteName(door.site_id)}
                          </div>
                          {door.description && (
                            <p className="text-control-text/60 mt-1 italic line-clamp-2">
                              "{door.description}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Remote Toggle Action */}
                      <div className="mt-4 pt-3 border-t border-control-border/40 flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-control-text/40">
                          ID: {door.id.substring(0, 8)}...
                        </span>
                        
                        <button
                          onClick={() => handleToggleDoor(door)}
                          disabled={!isAdmin || loading}
                          className={`flex items-center gap-1 text-[11px] font-bold font-mono tracking-wider px-3 py-1.5 border transition-all ${
                            !isAdmin
                              ? "bg-control-panel-light/30 border-control-border text-control-text/40 cursor-not-allowed opacity-55"
                              : isOpen
                                ? "bg-control-amber/5 border-control-amber/60 hover:border-control-amber hover:bg-control-amber/15 text-control-amber cursor-pointer"
                                : "bg-control-green/5 border-control-green/60 hover:border-control-green hover:bg-control-green/15 text-control-green cursor-pointer"
                          }`}
                          title={!isAdmin ? "Access Control commands require Operator Admin authority" : undefined}
                        >
                          {isOpen ? (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              <span>REMOTE LOCK</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3.5 w-3.5" />
                              <span>REMOTE UNLOCK</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Access History Logs view (Admin only) */
        <div className="flex-1 flex flex-col min-h-0 p-4 font-mono text-xs">
          
          {/* Table Filters Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-control-panel/20 border border-control-border p-3 mb-4">
            
            {/* Date Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Filter By Date</span>
              </label>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-control-bg border border-control-border text-control-text-bright p-2 text-xs focus:border-control-cyan focus:outline-none placeholder-control-text/30"
              />
            </div>

            {/* Door Selector Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1">
                <Key className="h-3 w-3" />
                <span>Filter By Door</span>
              </label>
              <select
                value={filterDoorId}
                onChange={(e) => setFilterDoorId(e.target.value)}
                className="bg-control-bg border border-control-border text-control-text-bright p-2 text-xs focus:border-control-cyan focus:outline-none"
              >
                <option value="all">ALL TERMINAL DOORS</option>
                {doors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({getSiteName(d.site_id)})
                  </option>
                ))}
              </select>
            </div>

            {/* Badge Search Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-control-cyan uppercase font-bold tracking-wider flex items-center gap-1">
                <Search className="h-3 w-3" />
                <span>Filter By Badge #</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={filterBadge}
                  onChange={(e) => setFilterBadge(e.target.value)}
                  placeholder="Enter Badge Hex / String..."
                  className="w-full bg-control-bg border border-control-border text-control-text-bright p-2 pr-8 text-xs focus:border-control-cyan focus:outline-none placeholder-control-text/30"
                />
                <Filter className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-control-text/40" />
              </div>
            </div>

          </div>

          {/* Logs Table Area */}
          <div className="flex-1 border border-control-border bg-control-panel/10 overflow-auto min-h-0">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-control-panel-light z-10 border-b border-control-border">
                <tr className="text-[10px] text-control-cyan uppercase font-bold tracking-widest">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Terminal / Door</th>
                  <th className="p-3">Site Location</th>
                  <th className="p-3">Badge Number</th>
                  <th className="p-3">Operator ID</th>
                  <th className="p-3 text-right">Access Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control-border/30">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-control-text/40">
                      NO ACCESS LOGS MATCHING THE ACTIVE FILTER CRITERIA
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isGranted = log.access_type === "granted";
                    const formattedTime = new Date(log.created_at).toLocaleString();
                    const doorName = log.door_id ? (doorNameMap[log.door_id] || `Door ${log.door_id.substring(0, 8)}`) : "N/A";
                    const siteName = getSiteName(log.site_id || undefined);

                    return (
                      <tr 
                        key={log.id} 
                        className="hover:bg-control-panel-light/20 transition-colors"
                      >
                        <td className="p-3 text-control-text-bright whitespace-nowrap flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-control-text/40" />
                          <span>{formattedTime}</span>
                        </td>
                        <td className="p-3 font-semibold text-control-text-bright uppercase">
                          {doorName}
                        </td>
                        <td className="p-3 text-control-text/80">
                          {siteName}
                        </td>
                        <td className="p-3 font-mono text-control-cyan">
                          {log.badge_number}
                        </td>
                        <td className="p-3 text-control-text/60">
                          {log.user_id ? log.user_id.substring(0, 8) : "—"}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold border ${
                            isGranted 
                              ? "bg-control-green/10 border-control-green/30 text-control-green" 
                              : "bg-control-red/10 border-control-red/30 text-control-red"
                          }`}>
                            {isGranted ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                <span>ACCESS GRANTED</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" />
                                <span>ACCESS DENIED {log.denied_reason ? `(${log.denied_reason})` : ""}</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer info */}
          <div className="flex justify-between items-center mt-3 text-[10px] text-control-text/50">
            <div>
              SHOWING {filteredLogs.length} OF {logs.length} LOGGED ATTEMPT(S)
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-control-cyan/40" />
              <span>CRYPTOGRAPHICALLY SIGNED TRANSACTION RECORD</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
