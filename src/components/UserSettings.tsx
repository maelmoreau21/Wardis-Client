import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore } from "../store/languageStore";
import { getApiBase, safeFetch } from "../store/config";
import { ShieldCheck, Lock, Globe, Moon, Sun, UserCheck, Smartphone, Laptop, Power, RefreshCw } from "lucide-react";

interface UserSettingsProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

interface Session {
  id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
}

export const UserSettings: React.FC<UserSettingsProps> = ({ theme, onToggleTheme }) => {
  const { user, token } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // MFA state
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaUri, setMfaUri] = useState<string | null>(null);
  const [mfaSetupActive, setMfaSetupActive] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaStatusMsg, setMfaStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchSessions = async () => {
    if (!token) return;
    setSessionsLoading(true);
    try {
      const apiBase = getApiBase();
      const response = await safeFetch(`${apiBase}/api/auth/me/sessions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSetupMfa = async () => {
    setMfaStatusMsg(null);
    try {
      const apiBase = getApiBase();
      const response = await safeFetch(`${apiBase}/api/auth/mfa/setup`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMfaSecret(data.secret);
        setMfaUri(data.qr_code);
        setMfaSetupActive(true);
      } else {
        throw new Error("Failed to initialize MFA setup");
      }
    } catch (err: any) {
      setMfaStatusMsg({ type: "error", text: err.message || "Failed to setup MFA" });
    }
  };

  const handleEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaStatusMsg(null);
    if (!mfaCode) return;

    try {
      const apiBase = getApiBase();
      const response = await safeFetch(`${apiBase}/api/auth/mfa/enable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ code: mfaCode })
      });

      if (response.ok) {
        setMfaStatusMsg({ type: "success", text: t("rightsSavedSuccess") });
        setMfaSetupActive(false);
        setMfaCode("");
        setMfaSecret(null);
        setMfaUri(null);
        // Update user state locally
        if (user) {
          const updatedUser = { ...user, mfa_enabled: true };
          sessionStorage.setItem("wardis_user", JSON.stringify(updatedUser));
          useAuthStore.setState({ user: updatedUser });
        }
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "MFA activation failed");
      }
    } catch (err: any) {
      setMfaStatusMsg({ type: "error", text: err.message || t("mfaCodeErr") });
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm(language === "fr" ? "Désactiver le double facteur (2FA) ?" : "Disable Two-Factor Auth (2FA)?")) return;
    setMfaStatusMsg(null);

    try {
      const apiBase = getApiBase();
      const response = await safeFetch(`${apiBase}/api/auth/mfa/disable`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        setMfaStatusMsg({ type: "success", text: language === "fr" ? "MFA désactivé avec succès" : "MFA disabled successfully" });
        if (user) {
          const updatedUser = { ...user, mfa_enabled: false };
          sessionStorage.setItem("wardis_user", JSON.stringify(updatedUser));
          useAuthStore.setState({ user: updatedUser });
        }
      } else {
        throw new Error("Failed to disable MFA");
      }
    } catch (err: any) {
      setMfaStatusMsg({ type: "error", text: err.message || "Failed to disable MFA" });
    }
  };

  const handleRevokeSession = async (id: string) => {
    if (!confirm(t("sessionRevokeConfirm"))) return;
    try {
      const apiBase = getApiBase();
      const response = await safeFetch(`${apiBase}/api/auth/me/sessions/${id}`, {
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

  useEffect(() => {
    fetchSessions();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (newPassword.length < 4) {
      setStatusMsg({ type: "error", text: t("passwordLengthErr") });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: "error", text: t("passwordMismatch") });
      return;
    }

    setLoading(true);
    try {
      const apiBase = getApiBase();
      const response = await safeFetch(`${apiBase}/api/auth/me/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (!response.ok) {
        throw new Error("Password change failed");
      }

      setStatusMsg({ type: "success", text: t("passwordSuccess") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatusMsg({ type: "error", text: t("passwordError") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full py-2">
      {/* Profile summary card */}
      <div className="wardis-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-control-cyan/15 flex items-center justify-center font-bold text-control-cyan text-2xl border border-control-cyan/20">
            {(user?.email || "OP").substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-control-text-bright tracking-tight">
              {user?.email || "operator@wardis.com"}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase tracking-wider text-control-cyan font-bold bg-control-cyan/10 px-2.5 py-0.5 border border-control-cyan/20 rounded-md">
                {user?.role || "OPERATOR"}
              </span>
              <span className="text-xs text-control-text/70 flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5" />
                ID: {user?.id}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Password update panel */}
        <div className="wardis-panel p-6">
          <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-5">
            <Lock className="h-4.5 w-4.5 text-control-cyan" />
            <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
              {t("changePasswordTitle")}
            </h3>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
                {t("currentPassword")}
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
                {t("newPassword")}
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
                {t("confirmPassword")}
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60"
                placeholder="••••••••"
              />
            </div>

            {statusMsg && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold ${
                  statusMsg.type === "success"
                    ? "bg-control-green/10 border border-control-green/20 text-control-green"
                    : "bg-control-red/10 border border-control-red/20 text-control-red"
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-control-cyan text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="h-4.5 w-4.5" />
              {loading ? t("submitting") : t("updatePasswordBtn")}
            </button>
          </form>
        </div>

        {/* Global Settings Toggle Panel */}
        <div className="wardis-panel p-6 flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-5">
              <Globe className="h-4.5 w-4.5 text-control-cyan" />
              <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                {t("languageLabel")}
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLanguage("fr")}
                className={`flex-1 rounded-lg border py-3 text-xs font-bold uppercase tracking-wider cursor-pointer transition ${
                  language === "fr"
                    ? "bg-control-cyan border-control-cyan text-white"
                    : "bg-control-panel border-control-border text-control-text hover:bg-control-panel-light"
                }`}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`flex-1 rounded-lg border py-3 text-xs font-bold uppercase tracking-wider cursor-pointer transition ${
                  language === "en"
                    ? "bg-control-cyan border-control-cyan text-white"
                    : "bg-control-panel border-control-border text-control-text hover:bg-control-panel-light"
                }`}
              >
                English
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-5">
              {theme === "dark" ? <Moon className="h-4.5 w-4.5 text-control-amber" /> : <Sun className="h-4.5 w-4.5 text-control-cyan" />}
              <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                {t("themeLabel")}
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { if (theme !== "light") onToggleTheme(); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-3 text-xs font-bold uppercase tracking-wider cursor-pointer transition ${
                  theme === "light"
                    ? "bg-control-cyan border-control-cyan text-white"
                    : "bg-control-panel border-control-border text-control-text hover:bg-control-panel-light"
                }`}
              >
                <Sun className="h-4 w-4" />
                {t("themeToggleLight")}
              </button>
              <button
                type="button"
                onClick={() => { if (theme !== "dark") onToggleTheme(); }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-3 text-xs font-bold uppercase tracking-wider cursor-pointer transition ${
                  theme === "dark"
                    ? "bg-control-cyan border-control-cyan text-white"
                    : "bg-control-panel border-control-border text-control-text hover:bg-control-panel-light"
                }`}
              >
                <Moon className="h-4 w-4" />
                {t("themeToggleDark")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MFA Setup Panel */}
      <div className="wardis-panel p-6">
        <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-5">
          <Smartphone className="h-4.5 w-4.5 text-control-cyan" />
          <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
            {t("mfaTitle")}
          </h3>
        </div>

        <div className="grid gap-6 md:grid-cols-12 items-start">
          <div className="md:col-span-7 space-y-4">
            <p className="text-xs text-control-text leading-relaxed">
              {user?.mfa_enabled ? t("mfaStatusActive") : t("mfaStatusInactive")}
            </p>

            {mfaStatusMsg && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold ${
                  mfaStatusMsg.type === "success"
                    ? "bg-control-green/10 border border-control-green/20 text-control-green"
                    : "bg-control-red/10 border border-control-red/20 text-control-red"
                }`}
              >
                {mfaStatusMsg.text}
              </div>
            )}

            {!user?.mfa_enabled && !mfaSetupActive && (
              <button
                onClick={handleSetupMfa}
                className="rounded-lg bg-control-cyan text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer"
              >
                {t("mfaEnableBtn")}
              </button>
            )}

            {user?.mfa_enabled && (
              <button
                onClick={handleDisableMfa}
                className="rounded-lg border border-control-red/25 bg-control-red/10 text-control-red hover:bg-control-red/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                {t("mfaDisableBtn")}
              </button>
            )}
          </div>

          {mfaSetupActive && mfaSecret && (
            <div className="md:col-span-5 border border-control-border bg-control-bg/40 p-4 rounded-xl space-y-4">
              <div className="text-[10px] text-control-text/70 leading-normal">
                {t("mfaSetupDesc")}
              </div>

              {/* Display secret key */}
              <div className="bg-control-panel-light p-2.5 border border-control-border rounded-lg text-center">
                <span className="font-mono text-xs font-bold tracking-widest text-control-text-bright">
                  {mfaSecret}
                </span>
              </div>

              {/* Provide direct click to open URI link */}
              {mfaUri && (
                <div className="text-center">
                  <a
                    href={mfaUri}
                    className="text-[10px] text-control-cyan hover:underline font-semibold"
                  >
                    Ouvrir dans l'application d'authentification
                  </a>
                </div>
              )}

              <form onSubmit={handleEnableMfa} className="space-y-3">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-bold mb-1 text-control-text">
                    {t("mfaVerifyCodeLabel")}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-center font-mono font-bold tracking-widest text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60"
                    placeholder="123456"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-control-cyan text-white py-2 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer"
                >
                  Activer
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Active Sessions Panel */}
      <div className="wardis-panel p-6">
        <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Laptop className="h-4.5 w-4.5 text-control-cyan" />
            <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
              {t("activeSessionsTab")}
            </h3>
          </div>
          <button
            onClick={fetchSessions}
            disabled={sessionsLoading}
            className="p-1 rounded hover:bg-control-panel-light transition cursor-pointer text-control-text hover:text-control-cyan"
          >
            <RefreshCw className={`h-4 w-4 ${sessionsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          {sessions.length === 0 ? (
            <p className="text-xs text-control-text/60 py-2">Aucune session active trouvée.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-control-border/40 text-[9px] uppercase tracking-wider text-control-text/70">
                  <th className="py-2.5 font-bold">{t("sessionIP")}</th>
                  <th className="py-2.5 font-bold">{t("sessionUA")}</th>
                  <th className="py-2.5 font-bold">{t("sessionCreated")}</th>
                  <th className="py-2.5 font-bold text-right">{t("actionsLabel")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control-border/20 text-control-text-bright">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-control-panel-light/10">
                    <td className="py-3 font-mono font-semibold">{s.ip_address}</td>
                    <td className="py-3 max-w-[200px] truncate" title={s.user_agent}>
                      {s.user_agent || "Client inconnu"}
                    </td>
                    <td className="py-3 text-control-text/90">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleRevokeSession(s.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border border-control-red/20 bg-control-red/5 text-control-red hover:bg-control-red/10 transition cursor-pointer"
                      >
                        <Power className="h-3 w-3" />
                        <span>{t("sessionRevokeBtn")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
};
