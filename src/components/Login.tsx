import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { safeFetch } from "../store/config";
import { Shield, ShieldAlert, Eye, EyeOff, Camera, DoorOpen, BellRing, Moon, Sun, Globe } from "lucide-react";
import { useLanguageStore } from "../store/languageStore";

interface LoginProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Login: React.FC<LoginProps> = ({ theme, onToggleTheme }) => {
  const { login, loginMfa, loading, error, clearError, mfaRequired, setMfaState } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("wardis-server-url") || "http://localhost:8080");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isServerActive, setIsServerActive] = useState<boolean | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode) return;
    await loginMfa(mfaCode);
  };

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  useEffect(() => {
    let active = true;
    if (!serverUrl.trim()) {
      setIsServerActive(false);
      return;
    }

    const checkHealth = async () => {
      let normalized = serverUrl.trim();
      if (!/^https?:\/\//i.test(normalized)) {
        normalized = "http://" + normalized;
      }
      try {
        const parsed = new URL(normalized);
        const apiBase = parsed.port ? normalized : `${parsed.protocol}//${parsed.hostname}:8080`;
        
        const response = await safeFetch(`${apiBase}/health`, { method: "GET" });
        if (response.ok && active) {
          setIsServerActive(true);
        } else if (active) {
          setIsServerActive(false);
        }
      } catch {
        if (active) {
          setIsServerActive(false);
        }
      }
    };

    setIsServerActive(null);
    checkHealth();

    const interval = setInterval(checkHealth, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [serverUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !serverUrl) return;

    await login(serverUrl, email, password);
  };

  const getTranslatedError = (err: string | null): string => {
    if (!err) return "";
    const lower = err.toLowerCase();
    if (lower.includes("password length")) {
      return t("errorInvalidPasswordLength");
    }
    if (lower.includes("identifier format")) {
      return t("errorInvalidIdentifierFormat");
    }
    if (lower.includes("invalid email or password") || lower.includes("credentials")) {
      return t("errorInvalidCredentials");
    }
    if (lower.includes("internal server error")) {
      return t("errorInternalServer");
    }
    if (lower.includes("connection to security gateway failed")) {
      return t("errorConnectionFailed");
    }
    return err;
  };

  return (
    <div className="relative min-h-screen w-full wardis-shell flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden">
      {/* Background soft glowing lights */}
      <div className="absolute inset-0 bg-gradient-to-tr from-control-cyan/5 via-transparent to-control-green/5 pointer-events-none" />

      <div className="relative w-full max-w-5xl grid gap-6 lg:grid-cols-12 items-stretch">
        
        {/* Left Branding Side */}
        <div className="lg:col-span-7 wardis-panel p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 rounded-full border border-control-cyan/15 bg-control-cyan/5 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-control-cyan">
                <Shield className="h-3.5 w-3.5" />
                {t("supervisionPlatform")}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
                  className="flex items-center gap-2 rounded-full border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-control-text transition cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5 text-control-cyan" />
                  {language === "fr" ? "EN" : "FR"}
                </button>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex items-center gap-2 rounded-full border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-control-text transition cursor-pointer"
                >
                  {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-control-amber" /> : <Moon className="h-3.5 w-3.5 text-control-cyan" />}
                  {theme === "dark" ? t("clearMode") : t("darkMode")}
                </button>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-control-cyan text-white shadow-lg shadow-control-cyan/20">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-control-text-bright tracking-tight">Wardis</h1>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-control-cyan">Security Suite</p>
                </div>
              </div>
              
              <p className="mt-5 max-w-md text-sm leading-relaxed text-control-text">
                {t("brandingDescription")}
              </p>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="wardis-card p-4 hover:border-control-cyan/30">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-control-cyan/10 text-control-cyan">
                <Camera className="h-4 w-4" />
              </div>
              <div className="mt-3 text-xs font-bold text-control-text-bright uppercase tracking-wider">{t("surveillance")}</div>
              <p className="mt-1 text-xs text-control-text leading-relaxed">{t("surveillanceDesc")}</p>
            </div>
            
            <div className="wardis-card p-4 hover:border-control-cyan/30">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-control-cyan/10 text-control-cyan">
                <DoorOpen className="h-4 w-4" />
              </div>
              <div className="mt-3 text-xs font-bold text-control-text-bright uppercase tracking-wider">{t("access")}</div>
              <p className="mt-1 text-xs text-control-text leading-relaxed">{t("accessDesc")}</p>
            </div>
            
            <div className="wardis-card p-4 hover:border-control-cyan/30">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-control-cyan/10 text-control-cyan">
                <BellRing className="h-4 w-4" />
              </div>
              <div className="mt-3 text-xs font-bold text-control-text-bright uppercase tracking-wider">{t("alerts")}</div>
              <p className="mt-1 text-xs text-control-text leading-relaxed">{t("alertsDesc")}</p>
            </div>
          </div>
        </div>

        {/* Right Login Form Side */}
        <div className="lg:col-span-5 wardis-panel p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-control-text-bright tracking-tight">
                  {mfaRequired ? t("mfaRequiredTitle") : t("authTitle")}
                </h2>
                <p className="mt-1 text-xs text-control-text">
                  {mfaRequired ? t("mfaRequiredDesc") : t("authDesc")}
                </p>
              </div>
              {isServerActive === true && (
                <div className="flex items-center gap-1.5 rounded-full border border-control-green/20 bg-control-green/5 px-3 py-1 text-[10px] font-semibold text-control-green">
                  <span className="h-1.5 w-1.5 rounded-full bg-control-green animate-pulse" />
                  {t("activeService")}
                </div>
              )}
              {isServerActive === false && (
                <div className="flex items-center gap-1.5 rounded-full border border-control-red/20 bg-control-red/5 px-3 py-1 text-[10px] font-semibold text-control-red">
                  <span className="h-1.5 w-1.5 rounded-full bg-control-red" />
                  {t("inactiveService")}
                </div>
              )}
              {isServerActive === null && (
                <div className="flex items-center gap-1.5 rounded-full border border-control-amber/20 bg-control-amber/5 px-3 py-1 text-[10px] font-semibold text-control-amber">
                  <span className="h-1.5 w-1.5 rounded-full bg-control-amber animate-pulse" />
                  {t("checkingService")}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-control-red/20 bg-control-red/5 p-3.5 text-xs text-control-red font-semibold">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{getTranslatedError(error)}</span>
              </div>
            )}

            {mfaRequired ? (
              <form onSubmit={handleMfaSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-control-cyan">
                    {t("mfaVerifyCodeLabel")}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder={t("mfaVerifyCodePlaceholder")}
                    className="wardis-input w-full px-3 py-3 text-sm outline-none transition focus:border-control-cyan tracking-[0.4em] text-center font-mono font-bold text-base"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="wardis-button flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
                >
                  {loading ? t("submitting") : t("mfaRequiredButton")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMfaState(false, null);
                    setMfaCode("");
                  }}
                  className="w-full text-center text-xs font-semibold text-control-text/70 hover:text-control-cyan transition mt-2 cursor-pointer"
                >
                  {t("mfaCancelButton")}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-control-cyan">
                    {t("serverUrlLabel")}
                  </label>
                  <input
                    type="text"
                    required
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="http://localhost:8080"
                    className="wardis-input w-full px-3 py-2.5 text-sm outline-none transition focus:border-control-cyan"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-control-cyan">
                    {t("usernameLabel")}
                  </label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("usernamePlaceholder")}
                    className="wardis-input w-full px-3 py-2.5 text-sm outline-none transition focus:border-control-cyan"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-control-cyan">
                    {t("passwordLabel")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("passwordPlaceholder")}
                      className="wardis-input w-full px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-control-cyan"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-control-text hover:text-control-cyan transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="wardis-button flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
                >
                  {loading ? (
                    <>{t("submitting")}</>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      {t("loginButton")}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="mt-8 text-center text-[10px] uppercase tracking-wider text-control-text/50">
            {t("authFooter")}
          </div>
        </div>
      </div>
    </div>
  );
};
