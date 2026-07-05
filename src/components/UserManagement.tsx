import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore } from "../store/languageStore";
import { useCameraStore } from "../store/cameraStore";
import { useAccessControlStore } from "../store/accessControlStore";
import { getApiBase, safeFetch } from "../store/config";
import { 
  Users, UserPlus, ShieldAlert, Trash2, KeyRound, Lock, 
  Video, DoorOpen, History, Laptop, Power, RefreshCw, 
  Plus, ShieldCheck, FileSpreadsheet, MapPin 
} from "lucide-react";

interface SystemUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  mfa_enabled: boolean;
}

interface Permission {
  id: number;
  name: string;
  description: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  permissions?: Permission[];
}

interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  resource: string;
  resource_id?: string;
  status: string;
  details: Record<string, any>;
  ip_address: string;
  created_at: string;
}

interface ActiveSession {
  id: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  user_agent: string;
  is_active: boolean;
  created_at: string;
}

// Hardcoded seeded sites to support multi-site partitioning in UI
const defaultSites = [
  { id: "a0000000-0000-0000-0000-000000000001", name: "HQ Paris", description: "Paris Headquarters" }
];

export const UserManagement: React.FC = () => {
  const { token, user: currentUser } = useAuthStore();
  const { t, language } = useLanguageStore();
  const { cameras, fetchCameras } = useCameraStore();
  const { doors, fetchDoors } = useAccessControlStore();

  const [activeSubTab, setActiveSubTab] = useState<"users" | "roles" | "matrix" | "audit" | "sessions">("users");

  // Users State
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("operator");

  // Roles & System Permissions State
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);
  const [editingRolePerms, setEditingRolePerms] = useState<string[]>([]);

  // Entity overrides matrix
  const [entityPermissions, setEntityPermissions] = useState<Record<string, boolean>>({});

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [filterEmail, setFilterEmail] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterResource, setFilterResource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // Sessions State
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Status/Messages
  const [loading, setLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [matrixMsg, setMatrixMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [roleMsg, setRoleMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const apiBase = getApiBase();

  // ------------------ API calls ------------------

  const fetchUsers = async () => {
    try {
      const response = await safeFetch(`${apiBase}/api/users`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await safeFetch(`${apiBase}/api/roles`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch roles", e);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await safeFetch(`${apiBase}/api/permissions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPermissions(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch permissions", e);
    }
  };

  const fetchUserEntityPermissions = async (userId: string) => {
    try {
      const response = await safeFetch(`${apiBase}/api/users/${userId}/permissions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const mapping: Record<string, boolean> = {};
        if (Array.isArray(data)) {
          data.forEach((perm: any) => {
            mapping[`${perm.entity_id}:${perm.permission_name}`] = perm.allowed;
          });
        }
        setEntityPermissions(mapping);
      } else {
        setEntityPermissions({});
      }
    } catch (e) {
      console.error("Failed to load user permissions", e);
      setEntityPermissions({});
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const query = new URLSearchParams();
      if (filterEmail) query.append("email", filterEmail);
      if (filterAction) query.append("action", filterAction);
      if (filterResource) query.append("resource", filterResource);
      if (filterStatus) query.append("status", filterStatus);
      if (filterStart) query.append("start_time", new Date(filterStart).toISOString());
      if (filterEnd) query.append("end_time", new Date(filterEnd).toISOString());
      
      const response = await safeFetch(`${apiBase}/api/audit-logs?${query.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
        setAuditTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Failed to fetch audit logs", e);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await safeFetch(`${apiBase}/api/sessions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch active sessions", e);
    } finally {
      setSessionsLoading(false);
    }
  };

  // ------------------ Actions handlers ------------------

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    if (newPassword.length < 4) {
      setFormMsg({ type: "error", text: t("passwordLengthErr") });
      return;
    }

    setLoading(true);
    try {
      const response = await safeFetch(`${apiBase}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role_name: newRole
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create user");
      }

      setFormMsg({ type: "success", text: t("userCreatedSuccess") });
      setNewEmail("");
      setNewPassword("");
      setNewRole("operator");
      fetchUsers();
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Error creating user" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      alert("Cannot delete your own active operator account.");
      return;
    }

    if (!confirm(t("userDeleteConfirm"))) return;

    try {
      const response = await safeFetch(`${apiBase}/api/users/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        if (selectedUser?.id === userId) setSelectedUser(null);
        fetchUsers();
      }
    } catch (e) {
      console.error("Failed to delete user", e);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleMsg(null);

    if (!newRoleName) return;

    try {
      const response = await safeFetch(`${apiBase}/api/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newRoleName.toLowerCase(),
          description: newRoleDesc,
          permissions: newRolePerms
        })
      });

      if (response.ok) {
        setRoleMsg({ type: "success", text: "Rôle créé avec succès !" });
        setNewRoleName("");
        setNewRoleDesc("");
        setNewRolePerms([]);
        fetchRoles();
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create role");
      }
    } catch (err: any) {
      setRoleMsg({ type: "error", text: err.message || "Failed to create role" });
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;
    setRoleMsg(null);

    try {
      const response = await safeFetch(`${apiBase}/api/roles/${selectedRole.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          description: selectedRole.description,
          permissions: editingRolePerms
        })
      });

      if (response.ok) {
        setRoleMsg({ type: "success", text: "Privilèges du rôle sauvegardés !" });
        fetchRoles();
      } else {
        throw new Error("Failed to update role");
      }
    } catch (err: any) {
      setRoleMsg({ type: "error", text: err.message });
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!confirm(t("deleteRoleConfirm") || "Delete this role?")) return;

    try {
      const response = await safeFetch(`${apiBase}/api/roles/${roleId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        setSelectedRole(null);
        fetchRoles();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.error || "Failed to delete role");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePermission = (entityId: string, permissionName: string) => {
    const key = `${entityId}:${permissionName}`;
    setEntityPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setMatrixMsg(null);

    const permissionsPayload = Object.entries(entityPermissions).map(([key, allowed]) => {
      const [entityId, permissionName] = key.split(":");
      let entityType = "camera";
      if (doors.some(d => d.id === entityId)) {
        entityType = "door";
      } else if (defaultSites.some(s => s.id === entityId)) {
        entityType = "site";
      }
      
      return {
        entity_id: entityId,
        entity_type: entityType,
        permission_name: permissionName,
        allowed
      };
    });

    try {
      const response = await safeFetch(`${apiBase}/api/users/${selectedUser.id}/permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          entity_permissions: permissionsPayload
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save permissions");
      }

      setMatrixMsg({ type: "success", text: t("rightsSavedSuccess") });
    } catch (err) {
      setMatrixMsg({ type: "error", text: t("rightsSavedError") });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm(t("sessionRevokeConfirm"))) return;
    try {
      const response = await safeFetch(`${apiBase}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        fetchSessions();
      }
    } catch (e) {
      console.error("Failed to revoke session", e);
    }
  };

  const handleExportCSV = () => {
    if (auditLogs.length === 0) return;
    const headers = [
      language === "fr" ? "Date & Heure" : "Date & Time",
      language === "fr" ? "Utilisateur" : "Operator",
      "Action",
      language === "fr" ? "Ressource" : "Resource",
      language === "fr" ? "Statut" : "Status",
      "IP Address",
      language === "fr" ? "Détails" : "Details"
    ];
    
    const rows = auditLogs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.user_email,
      log.action,
      log.resource,
      log.status,
      log.ip_address,
      JSON.stringify(log.details).replace(/"/g, '""')
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wardis_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ------------------ Mount & Effects ------------------

  useEffect(() => {
    fetchUsers();
    fetchCameras();
    fetchDoors();
    fetchRoles();
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserEntityPermissions(selectedUser.id);
      setMatrixMsg(null);
    } else {
      setEntityPermissions({});
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedRole) {
      const activePermNames = (selectedRole.permissions || []).map(p => p.name);
      setEditingRolePerms(activePermNames);
      setRoleMsg(null);
    } else {
      setEditingRolePerms([]);
    }
  }, [selectedRole]);

  useEffect(() => {
    if (activeSubTab === "audit") {
      fetchAuditLogs();
    } else if (activeSubTab === "sessions") {
      fetchSessions();
    }
  }, [activeSubTab]);

  return (
    <div className="flex-1 flex flex-col gap-5 h-full overflow-hidden">
      {/* Sub tabs navigation */}
      <div className="flex border-b border-control-border bg-control-panel/40 p-1.5 gap-2 shrink-0 rounded-lg">
        <button
          onClick={() => setActiveSubTab("users")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeSubTab === "users"
              ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30 font-extrabold"
              : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
          }`}
        >
          <Users className="h-4 w-4" />
          {language === "fr" ? "Utilisateurs" : "Operators"}
        </button>

        <button
          onClick={() => setActiveSubTab("roles")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeSubTab === "roles"
              ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30 font-extrabold"
              : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
          }`}
        >
          <KeyRound className="h-4 w-4" />
          {t("customRolesTab")}
        </button>

        <button
          onClick={() => setActiveSubTab("matrix")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeSubTab === "matrix"
              ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30 font-extrabold"
              : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
          }`}
        >
          <Lock className="h-4 w-4" />
          Matrice des Droits
        </button>

        <button
          onClick={() => setActiveSubTab("audit")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeSubTab === "audit"
              ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30 font-extrabold"
              : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
          }`}
        >
          <History className="h-4 w-4" />
          {t("auditLogTab")}
        </button>

        <button
          onClick={() => setActiveSubTab("sessions")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeSubTab === "sessions"
              ? "bg-control-cyan/15 text-control-cyan border border-control-cyan/30 font-extrabold"
              : "text-control-text hover:bg-control-panel-light hover:text-control-text-bright border border-transparent"
          }`}
        >
          <Laptop className="h-4 w-4" />
          {t("activeSessionsTab")}
        </button>
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
        
        {/* 1. USERS TAB */}
        {activeSubTab === "users" && (
          <div className="grid xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-5 flex flex-col gap-5">
              {/* Creation Form */}
              <div className="wardis-panel p-5">
                <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-4">
                  <UserPlus className="h-4.5 w-4.5 text-control-cyan" />
                  <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                    {t("createUserTitle")}
                  </h3>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-control-text">
                      {t("emailOrUsernameLabel")}
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60"
                      placeholder="nom_utilisateur"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-control-text">
                      {t("passwordLabel")}
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-control-text">
                      {t("roleLabel")}
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60 cursor-pointer"
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.name}>
                          {r.name === "admin" ? t("roleAdmin") : r.name === "supervisor" ? t("roleSupervisor") : r.name === "operator" ? t("roleOperator") : r.name === "guest" ? t("roleGuest") : r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formMsg && (
                    <div
                      className={`p-3 rounded-lg text-xs font-semibold ${
                        formMsg.type === "success"
                          ? "bg-control-green/10 border border-control-green/20 text-control-green"
                          : "bg-control-red/10 border border-control-red/20 text-control-red"
                      }`}
                    >
                      {formMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-control-cyan text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer disabled:opacity-50"
                  >
                    <UserPlus className="h-4.5 w-4.5" />
                    {t("createUserTitle")}
                  </button>
                </form>
              </div>

              {/* User List Panel */}
              <div className="wardis-panel p-5">
                <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-3">
                  <Users className="h-4.5 w-4.5 text-control-cyan" />
                  <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                    {t("userListTitle")}
                  </h3>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                        selectedUser?.id === u.id
                          ? "bg-control-cyan/15 border-control-cyan/30"
                          : "bg-control-panel-light/35 border-control-border/60 hover:bg-control-panel-light/65"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-control-text-bright truncate">{u.email}</p>
                        <p className="text-[9px] text-control-text/70 uppercase tracking-wider font-bold mt-0.5">
                          {u.role === "admin" ? t("roleAdmin") : u.role === "supervisor" ? t("roleSupervisor") : u.role === "operator" ? t("roleOperator") : u.role === "guest" ? t("roleGuest") : u.role}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUser(u.id);
                        }}
                        className="p-1.5 rounded bg-control-red/10 border border-control-red/25 text-control-red hover:bg-control-red/20 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* User Detail & MFA status view */}
            <div className="xl:col-span-7 wardis-panel p-5 h-full">
              <div className="border-b border-control-border/60 pb-3 mb-4">
                <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                  Profil Sélectionné
                </h3>
              </div>
              {selectedUser ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-control-panel-light/30 border border-control-border/50 p-4 rounded-xl">
                    <div className="h-12 w-12 rounded-xl bg-control-cyan/15 flex items-center justify-center font-bold text-control-cyan text-lg border border-control-cyan/20">
                      {selectedUser.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-control-text-bright">{selectedUser.email}</h4>
                      <p className="text-[10px] text-control-text/70 mt-0.5">Rôle: <span className="text-control-cyan font-bold uppercase">{selectedUser.role}</span></p>
                    </div>
                  </div>

                  <div className="border border-control-border bg-control-bg/40 p-4 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-control-text-bright uppercase tracking-wider">Sécurité du Compte</h4>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span>Authentification à double facteur (2FA) :</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedUser.mfa_enabled ? "bg-control-green/10 text-control-green border border-control-green/20" : "bg-control-text/10 text-control-text/70"}`}>
                        {selectedUser.mfa_enabled ? "ACTIVÉ" : "INACTIF"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-control-text/60 gap-2 border border-dashed border-control-border/80 rounded-xl">
                  <p className="text-xs font-bold uppercase tracking-wider">Sélectionnez un utilisateur pour voir ses informations</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. ROLES TAB */}
        {activeSubTab === "roles" && (
          <div className="grid xl:grid-cols-12 gap-5 items-start">
            {/* Roles checklist left */}
            <div className="xl:col-span-5 flex flex-col gap-5">
              <div className="wardis-panel p-5">
                <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-4">
                  <Plus className="h-4.5 w-4.5 text-control-cyan" />
                  <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                    Créer un nouveau Rôle
                  </h3>
                </div>

                <form onSubmit={handleCreateRole} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-control-text">
                      Nom du Rôle
                    </label>
                    <input
                      type="text"
                      required
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60"
                      placeholder="ex: inspecteur"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold mb-1 text-control-text">
                      Description
                    </label>
                    <textarea
                      value={newRoleDesc}
                      onChange={(e) => setNewRoleDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60"
                      placeholder="Description du rôle..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text">
                      Permissions initiales
                    </label>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 border border-control-border/60 bg-control-bg/40 p-2 rounded-lg">
                      {permissions.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newRolePerms.includes(p.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewRolePerms(prev => [...prev, p.name]);
                              } else {
                                setNewRolePerms(prev => prev.filter(name => name !== p.name));
                              }
                            }}
                            className="accent-control-cyan h-3.5 w-3.5"
                          />
                          <span className="text-[10px] font-mono text-control-text-bright">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {roleMsg && (
                    <div
                      className={`p-3 rounded-lg text-xs font-semibold ${
                        roleMsg.type === "success"
                          ? "bg-control-green/10 border border-control-green/20 text-control-green"
                          : "bg-control-red/10 border border-control-red/20 text-control-red"
                      }`}
                    >
                      {roleMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-control-cyan text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer"
                  >
                    {t("createRoleBtn")}
                  </button>
                </form>
              </div>

              {/* Roles List */}
              <div className="wardis-panel p-5">
                <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-3">
                  <KeyRound className="h-4.5 w-4.5 text-control-cyan" />
                  <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                    Rôles Système Existants
                  </h3>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {roles.map((r) => {
                    const isSystemRole = ["admin", "supervisor", "operator", "guest"].includes(r.name);
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRole(r)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                          selectedRole?.id === r.id
                            ? "bg-control-cyan/15 border-control-cyan/30"
                            : "bg-control-panel-light/35 border-control-border/60 hover:bg-control-panel-light/65"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-control-text-bright truncate font-mono uppercase">{r.name}</p>
                          <p className="text-[10px] text-control-text/75 truncate mt-0.5">{r.description || "Aucune description"}</p>
                        </div>
                        {!isSystemRole && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRole(r.id);
                            }}
                            className="p-1.5 rounded bg-control-red/10 border border-control-red/25 text-control-red hover:bg-control-red/20 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Role Permissions Matrix right */}
            <div className="xl:col-span-7 wardis-panel p-5">
              <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
                <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                  {t("rolePermissionsTitle")}
                </h3>
                {selectedRole && (
                  <span className="font-mono text-xs font-bold text-control-cyan uppercase px-2 py-0.5 rounded bg-control-cyan/10 border border-control-cyan/20">
                    {selectedRole.name}
                  </span>
                )}
              </div>

              {!selectedRole ? (
                <div className="h-64 flex flex-col items-center justify-center text-control-text/60 gap-2 border border-dashed border-control-border/80 rounded-xl">
                  <ShieldAlert className="h-7 w-7 text-control-text/40" />
                  <p className="text-xs font-bold uppercase tracking-wider">Sélectionnez un rôle pour configurer ses permissions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-control-text leading-relaxed">
                    Configurez l'ensemble des autorisations accordées de manière globale aux utilisateurs associés au rôle <span className="font-mono font-bold text-control-text-bright">{selectedRole.name}</span>.
                  </div>

                  {["admin", "supervisor", "operator", "guest"].includes(selectedRole.name) && (
                    <div className="p-3 rounded-lg text-[10px] font-semibold bg-control-cyan/10 border border-control-cyan/20 text-control-cyan">
                      Ce rôle est un rôle système par défaut de Wardis. Ses permissions globales sont verrouillées et ne peuvent pas être altérées.
                    </div>
                  )}

                  <div className="border border-control-border/50 bg-control-bg/40 rounded-xl p-3 max-h-80 overflow-y-auto space-y-2">
                    {permissions.map((p) => {
                      const isChecked = editingRolePerms.includes(p.name);
                      const isLocked = ["admin", "supervisor", "operator", "guest"].includes(selectedRole.name);
                      return (
                        <div key={p.id} className="flex items-start justify-between border-b border-control-border/20 last:border-b-0 pb-2 last:pb-0 pt-2 first:pt-0">
                          <div>
                            <span className="text-xs font-mono font-bold text-control-text-bright">{p.name}</span>
                            <p className="text-[10px] text-control-text/60 mt-0.5">{p.description}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isLocked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingRolePerms(prev => [...prev, p.name]);
                              } else {
                                setEditingRolePerms(prev => prev.filter(n => n !== p.name));
                              }
                            }}
                            className="accent-control-cyan h-4.5 w-4.5 cursor-pointer disabled:opacity-50 mt-1"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {!["admin", "supervisor", "operator", "guest"].includes(selectedRole.name) && (
                    <button
                      onClick={handleUpdateRole}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-control-cyan text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer"
                    >
                      <ShieldCheck className="h-4.5 w-4.5" />
                      Sauvegarder les permissions du Rôle
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. RIGHTS MATRIX TAB */}
        {activeSubTab === "matrix" && (
          <div className="wardis-panel p-5">
            <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Lock className="h-4.5 w-4.5 text-control-cyan" />
                <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                  {t("userEntityPermissionsTitle")}
                </h3>
              </div>
              {selectedUser && (
                <span className="text-xs font-bold text-control-cyan bg-control-cyan/10 border border-control-cyan/20 px-2.5 py-0.5 rounded font-mono">
                  Opérateur: {selectedUser.email}
                </span>
              )}
            </div>

            {!selectedUser ? (
              <div className="h-80 flex flex-col items-center justify-center text-control-text/60 gap-3 border border-dashed border-control-border/80 rounded-xl">
                <ShieldAlert className="h-8 w-8 text-control-text/40" />
                <p className="text-xs font-bold uppercase tracking-wider">
                  Sélectionnez un opérateur dans l'onglet "Utilisateurs" pour éditer ses restrictions fines
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                {/* 1. Sites Partitioning */}
                <div>
                  <h4 className="text-[10px] font-bold text-control-text-bright uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-control-cyan" />
                    Cloisonnement des Sites
                  </h4>
                  <div className="space-y-2 border border-control-border/50 rounded-xl p-3 bg-control-bg/40 max-h-56 overflow-y-auto">
                    {defaultSites.map((s) => (
                      <div key={s.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-control-text-bright">{s.name}</p>
                          <span className="text-[9px] uppercase tracking-wider text-control-text/60">{s.description}</span>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!entityPermissions[`${s.id}:site:view`]}
                            onChange={() => handleTogglePermission(s.id, "site:view")}
                            className="accent-control-cyan h-4 w-4 rounded border-control-border bg-control-bg"
                          />
                          <span>Accès complet au site (Héritage)</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Cameras Specific overrides */}
                <div>
                  <h4 className="text-[10px] font-bold text-control-text-bright uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Video className="h-4 w-4 text-control-cyan" />
                    Sécurité des caméras (Restrictions Directes)
                  </h4>
                  <div className="space-y-2 border border-control-border/50 rounded-xl p-3 bg-control-bg/40 max-h-56 overflow-y-auto">
                    {cameras.length === 0 ? (
                      <p className="text-xs text-control-text/60">Aucune caméra disponible.</p>
                    ) : (
                      cameras.map((c) => (
                        <div key={c.id} className="flex items-center justify-between border-b border-control-border/20 last:border-b-0 pb-2 last:pb-0 pt-2 first:pt-0">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-control-text-bright truncate">{c.nom}</p>
                            <span className="text-[9px] uppercase tracking-wider text-control-text/60">{c.site_id ? "HQ Paris" : "Default Site"}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!entityPermissions[`${c.id}:camera:live`]}
                                onChange={() => handleTogglePermission(c.id, "camera:live")}
                                className="accent-control-cyan h-4 w-4 rounded border-control-border bg-control-bg"
                              />
                              {t("permissionViewLive")}
                            </label>
                            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!entityPermissions[`${c.id}:camera:archive`]}
                                onChange={() => handleTogglePermission(c.id, "camera:archive")}
                                className="accent-control-cyan h-4 w-4 rounded border-control-border bg-control-bg"
                              />
                              {t("permissionViewArchive")}
                            </label>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. Doors Specific overrides */}
                <div>
                  <h4 className="text-[10px] font-bold text-control-text-bright uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <DoorOpen className="h-4 w-4 text-control-cyan" />
                    Contrôle des accès (Restrictions Portes)
                  </h4>
                  <div className="space-y-2 border border-control-border/50 rounded-xl p-3 bg-control-bg/40 max-h-56 overflow-y-auto">
                    {doors.length === 0 ? (
                      <p className="text-xs text-control-text/60">Aucune porte disponible.</p>
                    ) : (
                      doors.map((d) => (
                        <div key={d.id} className="flex items-center justify-between border-b border-control-border/20 last:border-b-0 pb-2 last:pb-0 pt-2 first:pt-0">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-control-text-bright truncate">{d.name}</p>
                            <span className="text-[9px] uppercase tracking-wider text-control-text/60">{d.description || "Pas de description"}</span>
                          </div>
                          <div className="flex items-center">
                            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!entityPermissions[`${d.id}:door:unlock`]}
                                onChange={() => handleTogglePermission(d.id, "door:unlock")}
                                className="accent-control-cyan h-4 w-4 rounded border-control-border bg-control-bg"
                              />
                              {t("permissionUnlockDoor")}
                            </label>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {matrixMsg && (
                  <div
                    className={`p-3 rounded-lg text-xs font-semibold ${
                      matrixMsg.type === "success"
                        ? "bg-control-green/10 border border-control-green/20 text-control-green"
                        : "bg-control-red/10 border border-control-red/20 text-control-red"
                    }`}
                  >
                    {matrixMsg.text}
                  </div>
                )}

                <button
                  onClick={handleSavePermissions}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-control-cyan text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="h-4.5 w-4.5" />
                  {loading ? t("submitting") : t("saveRightsBtn")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. AUDIT LOG TAB */}
        {activeSubTab === "audit" && (
          <div className="wardis-panel p-5 flex flex-col gap-4">
            {/* Audit log filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 border-b border-control-border/40 pb-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-control-text/70 mb-1">Opérateur</label>
                <input
                  type="text"
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                  placeholder="nom_utilisateur"
                  className="w-full bg-control-bg border border-control-border rounded px-2.5 py-1.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/50"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-control-text/70 mb-1">Action</label>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="w-full bg-control-bg border border-control-border rounded px-2 py-1.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/50 cursor-pointer"
                >
                  <option value="">-- Toutes --</option>
                  <option value="login">login</option>
                  <option value="login_mfa">login_mfa</option>
                  <option value="logout">logout</option>
                  <option value="create_camera">create_camera</option>
                  <option value="update_camera">update_camera</option>
                  <option value="delete_camera">delete_camera</option>
                  <option value="export_video">export_video</option>
                  <option value="ptz_command">ptz_command</option>
                  <option value="acquit_alarm">acquit_alarm</option>
                  <option value="enable_mfa">enable_mfa</option>
                  <option value="disable_mfa">disable_mfa</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-control-text/70 mb-1">Ressource</label>
                <input
                  type="text"
                  value={filterResource}
                  onChange={(e) => setFilterResource(e.target.value)}
                  placeholder="camera / auth / door..."
                  className="w-full bg-control-bg border border-control-border rounded px-2.5 py-1.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/50"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-control-text/70 mb-1">Statut</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-control-bg border border-control-border rounded px-2 py-1.5 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/50 cursor-pointer"
                >
                  <option value="">-- Tous --</option>
                  <option value="success">success</option>
                  <option value="failed">failed</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-control-text/70 mb-1">Date Début</label>
                <input
                  type="datetime-local"
                  value={filterStart}
                  onChange={(e) => setFilterStart(e.target.value)}
                  className="w-full bg-control-bg border border-control-border rounded px-2 py-1 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/50 cursor-pointer"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-control-text/70 mb-1">Date Fin</label>
                  <input
                    type="datetime-local"
                    value={filterEnd}
                    onChange={(e) => setFilterEnd(e.target.value)}
                    className="w-full bg-control-bg border border-control-border rounded px-2 py-1 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/50 cursor-pointer"
                  />
                </div>
                <button
                  onClick={fetchAuditLogs}
                  className="h-8.5 rounded bg-control-cyan text-white px-3 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/95 cursor-pointer shrink-0"
                >
                  Filtrer
                </button>
              </div>
            </div>

            {/* Audit log Header actions */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-control-text font-semibold">
                Journal d'audit total : <span className="text-control-cyan font-bold font-mono">{auditTotal}</span> entrées
              </span>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 rounded border border-control-green/30 bg-control-green/5 text-control-green hover:bg-control-green/10 transition px-3 py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exporter (CSV)
              </button>
            </div>

            {/* Audit log Table */}
            <div className="overflow-x-auto">
              {auditLoading ? (
                <div className="py-8 text-center text-xs text-control-text/60">Chargement du journal d'audit...</div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-control-text/60">Aucun journal d'audit ne correspond aux filtres.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-control-border/40 text-[9px] uppercase tracking-wider text-control-text/70">
                      <th className="py-2.5 font-bold">{t("auditTime")}</th>
                      <th className="py-2.5 font-bold">{t("auditUser")}</th>
                      <th className="py-2.5 font-bold">{t("auditAction")}</th>
                      <th className="py-2.5 font-bold">{t("auditResource")}</th>
                      <th className="py-2.5 font-bold">{t("auditStatus")}</th>
                      <th className="py-2.5 font-bold">{t("auditIP")}</th>
                      <th className="py-2.5 font-bold">{t("auditDetails")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-control-border/20 text-control-text-bright leading-relaxed">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-control-panel-light/10">
                        <td className="py-2.5 whitespace-nowrap text-control-text/80">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-2.5 font-semibold">{log.user_email}</td>
                        <td className="py-2.5"><span className="font-mono text-[10px] text-control-cyan">{log.action}</span></td>
                        <td className="py-2.5 uppercase text-[10px]">{log.resource}</td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.status === "success" ? "bg-control-green/10 text-control-green" : "bg-control-red/10 text-control-red"}`}>
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-[10px]">{log.ip_address}</td>
                        <td className="py-2.5 max-w-[200px] truncate font-mono text-[9px] text-control-text/70" title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* 5. ACTIVE SESSIONS TAB */}
        {activeSubTab === "sessions" && (
          <div className="wardis-panel p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-control-border/60 pb-3">
              <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                Sessions Opérateurs Actives (Sécurité Système)
              </h3>
              <button
                onClick={fetchSessions}
                disabled={sessionsLoading}
                className="p-1.5 rounded hover:bg-control-panel-light transition cursor-pointer text-control-text hover:text-control-cyan border border-control-border"
              >
                <RefreshCw className={`h-4 w-4 ${sessionsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              {sessionsLoading ? (
                <p className="text-xs text-control-text/60 py-4 text-center">Chargement des sessions...</p>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-control-text/60 py-4 text-center">Aucune session active détectée sur la passerelle.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-control-border/40 text-[9px] uppercase tracking-wider text-control-text/70">
                      <th className="py-2.5 font-bold">Opérateur</th>
                      <th className="py-2.5 font-bold">{t("sessionIP")}</th>
                      <th className="py-2.5 font-bold">{t("sessionUA")}</th>
                      <th className="py-2.5 font-bold">{t("sessionCreated")}</th>
                      <th className="py-2.5 font-bold text-right">Contrôle à distance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-control-border/20 text-control-text-bright">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-control-panel-light/10">
                        <td className="py-3 font-semibold">{s.user_email}</td>
                        <td className="py-3 font-mono font-semibold">{s.ip_address}</td>
                        <td className="py-3 max-w-[220px] truncate text-control-text/80" title={s.user_agent}>
                          {s.user_agent || "Client Inconnu"}
                        </td>
                        <td className="py-3 text-control-text/90">
                          {new Date(s.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleRevokeSession(s.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border border-control-red/25 bg-control-red/10 text-control-red hover:bg-control-red/15 transition cursor-pointer"
                          >
                            <Power className="h-3 w-3" />
                            <span>Interrompre Session</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
