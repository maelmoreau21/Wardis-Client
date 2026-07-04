import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { Shield, ShieldAlert, Eye, EyeOff, Camera, DoorOpen, BellRing, Moon, Sun } from "lucide-react";

interface LoginProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Login: React.FC<LoginProps> = ({ theme, onToggleTheme }) => {
  const { login, loading, error, clearError } = useAuthStore();
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("wardis-server-url") || "http://localhost:8080");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !serverUrl) return;

    await login(serverUrl, email, password);
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
                Plateforme de Supervision
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center gap-2 rounded-full border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-control-text transition cursor-pointer"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-control-amber" /> : <Moon className="h-3.5 w-3.5 text-control-cyan" />}
                {theme === "dark" ? "Mode clair" : "Mode sombre"}
              </button>
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
                Supervision centralisée et performante. Pilotez vos flux vidéo en direct, contrôlez les accès physiques et traitez les alertes de sécurité depuis une console unifiée, simple et efficace.
              </p>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="wardis-card p-4 hover:border-control-cyan/30">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-control-cyan/10 text-control-cyan">
                <Camera className="h-4 w-4" />
              </div>
              <div className="mt-3 text-xs font-bold text-control-text-bright uppercase tracking-wider">Surveillance</div>
              <p className="mt-1 text-xs text-control-text leading-relaxed">Flux vidéo en temps réel à faible latence.</p>
            </div>
            
            <div className="wardis-card p-4 hover:border-control-cyan/30">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-control-cyan/10 text-control-cyan">
                <DoorOpen className="h-4 w-4" />
              </div>
              <div className="mt-3 text-xs font-bold text-control-text-bright uppercase tracking-wider">Accès</div>
              <p className="mt-1 text-xs text-control-text leading-relaxed">Contrôle à distance des portes et lecteurs.</p>
            </div>
            
            <div className="wardis-card p-4 hover:border-control-cyan/30">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-control-cyan/10 text-control-cyan">
                <BellRing className="h-4 w-4" />
              </div>
              <div className="mt-3 text-xs font-bold text-control-text-bright uppercase tracking-wider">Alertes</div>
              <p className="mt-1 text-xs text-control-text leading-relaxed">Notifications instantanées des anomalies.</p>
            </div>
          </div>
        </div>

        {/* Right Login Form Side */}
        <div className="lg:col-span-5 wardis-panel p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-control-text-bright tracking-tight">Authentification</h2>
                <p className="mt-1 text-xs text-control-text">Veuillez renseigner vos identifiants.</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-control-green/20 bg-control-green/5 px-3 py-1 text-[10px] font-semibold text-control-green">
                <span className="h-1.5 w-1.5 rounded-full bg-control-green animate-pulse" />
                Service actif
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-control-red/20 bg-control-red/5 p-3.5 text-xs text-control-red font-semibold">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-control-cyan">
                  Adresse du serveur
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
                  Identifiant
                </label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin ou operator"
                  className="wardis-input w-full px-3 py-2.5 text-sm outline-none transition focus:border-control-cyan"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-control-cyan">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
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
                  <>Validation en cours...</>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Se connecter
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center text-[10px] uppercase tracking-wider text-control-text/50">
            Console réservée au personnel autorisé
          </div>
        </div>
      </div>
    </div>
  );
};
