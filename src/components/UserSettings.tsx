import React, { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore } from "../store/languageStore";
import { getApiBase, safeFetch } from "../store/config";
import { ShieldCheck, Lock, Globe, Moon, Sun, UserCheck } from "lucide-react";

interface UserSettingsProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const UserSettings: React.FC<UserSettingsProps> = ({ theme, onToggleTheme }) => {
  const { user, token } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    </div>
  );
};
