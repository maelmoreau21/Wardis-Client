import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore } from "../store/languageStore";
import { useCameraStore } from "../store/cameraStore";
import { useAccessControlStore } from "../store/accessControlStore";
import { getApiBase, safeFetch } from "../store/config";
import { Users, UserPlus, ShieldAlert, Trash2, KeyRound, Lock, Video, DoorOpen } from "lucide-react";

interface SystemUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export const UserManagement: React.FC = () => {
  const { token, user: currentUser } = useAuthStore();
  const { t } = useLanguageStore();
  const { cameras, fetchCameras } = useCameraStore();
  const { doors, fetchDoors } = useAccessControlStore();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  
  // New User Form State
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");

  // Entity overrides state: key is `entityId:permissionName`, value is boolean
  const [entityPermissions, setEntityPermissions] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [matrixMsg, setMatrixMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const apiBase = getApiBase();

  const fetchUsers = async () => {
    try {
      const response = await safeFetch(`${apiBase}/api/users`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    }
  };

  const fetchUserEntityPermissions = async (userId: string) => {
    try {
      const response = await safeFetch(`${apiBase}/api/users/${userId}/permissions`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Convert array of database entities to local state dictionary
        // Data format expected: Array<{ entity_id: string, permission_name: string, allowed: boolean }>
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

  useEffect(() => {
    fetchUsers();
    fetchCameras();
    fetchDoors();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserEntityPermissions(selectedUser.id);
      setMatrixMsg(null);
    } else {
      setEntityPermissions({});
    }
  }, [selectedUser]);

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
      setNewRole("user");
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

    if (!confirm(t("userDeleteConfirm"))) {
      return;
    }

    try {
      const response = await safeFetch(`${apiBase}/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        if (selectedUser?.id === userId) {
          setSelectedUser(null);
        }
        fetchUsers();
      }
    } catch (e) {
      console.error("Failed to delete user", e);
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

    // Convert entityPermissions map to database payload
    const permissionsPayload = Object.entries(entityPermissions).map(([key, allowed]) => {
      const [entityId, permissionName] = key.split(":");
      const entityType = cameras.some(c => c.id === entityId) ? "camera" : "door";
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

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="grid xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Users List & Create Forms */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          {/* User Creation Form */}
          <div className="wardis-panel p-6">
            <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-5">
              <UserPlus className="h-4.5 w-4.5 text-control-cyan" />
              <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                {t("createUserTitle")}
              </h3>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
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
                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
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
                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
                  {t("roleLabel")}
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60 cursor-pointer"
                >
                  <option value="user">{t("roleOperator")}</option>
                  <option value="admin">{t("roleAdmin")}</option>
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
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-control-cyan text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="h-4.5 w-4.5" />
                {t("createUserTitle")}
              </button>
            </form>
          </div>

          {/* User List Panel */}
          <div className="wardis-panel p-6">
            <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-4">
              <Users className="h-4.5 w-4.5 text-control-cyan" />
              <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                {t("userListTitle")}
              </h3>
            </div>

            <div className="overflow-y-auto max-h-[300px] space-y-2 pr-1">
              {users.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                    selectedUser?.id === u.id
                      ? "bg-control-cyan/10 border-control-cyan/30"
                      : "bg-control-panel-light/35 border-control-border/60 hover:bg-control-panel-light/65"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-control-text-bright truncate">{u.email}</p>
                    <p className="text-[10px] text-control-text/70 uppercase tracking-wider font-semibold mt-0.5">
                      {u.role === "admin" ? t("roleAdmin") : t("roleOperator")}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUser(u.id);
                    }}
                    className="p-1.5 rounded-lg border border-control-red/25 bg-control-red/10 text-control-red hover:bg-control-red/15 transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Permissions Mapping Grid */}
        <div className="xl:col-span-7 wardis-panel p-6">
          <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4.5 w-4.5 text-control-cyan" />
              <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                {t("userEntityPermissionsTitle")}
              </h3>
            </div>
            {selectedUser && (
              <span className="text-xs font-bold text-control-cyan bg-control-cyan/10 border border-control-cyan/20 px-2 py-0.5 rounded">
                {selectedUser.email}
              </span>
            )}
          </div>

          {!selectedUser ? (
            <div className="h-80 flex flex-col items-center justify-center text-control-text/60 gap-3 border border-dashed border-control-border/80 rounded-xl">
              <ShieldAlert className="h-8 w-8 text-control-text/40" />
              <p className="text-xs font-bold uppercase tracking-wider">
                Sélectionnez un utilisateur pour éditer ses droits
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {/* Cameras specific matrix */}
              <div>
                <h4 className="text-[10px] font-bold text-control-text-bright uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-control-cyan" />
                  Sécurité des caméras
                </h4>
                <div className="space-y-2 border border-control-border/50 rounded-xl p-3 bg-control-bg/40 max-h-56 overflow-y-auto">
                  {cameras.length === 0 ? (
                    <p className="text-xs text-control-text/60">Aucune caméra disponible.</p>
                  ) : (
                    cameras.map((c) => (
                      <div key={c.id} className="flex items-center justify-between border-b border-control-border/20 last:border-b-0 pb-2 last:pb-0 pt-2 first:pt-0">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-control-text-bright truncate">{c.nom}</p>
                          <span className="text-[9px] uppercase tracking-wider text-control-text/60">{c.site_id ? "HQ" : "Default Site"}</span>
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

              {/* Doors specific matrix */}
              <div>
                <h4 className="text-[10px] font-bold text-control-text-bright uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <DoorOpen className="h-4 w-4 text-control-cyan" />
                  Contrôle des accès (Portes)
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

      </div>
    </div>
  );
};
