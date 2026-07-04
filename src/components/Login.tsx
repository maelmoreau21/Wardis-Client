import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { Shield, ShieldAlert, Eye, EyeOff, Loader2, Camera, DoorOpen, BellRing, Moon, Sun } from "lucide-react";

interface LoginProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Login: React.FC<LoginProps> = ({ theme, onToggleTheme }) => {
  const { login, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const diagnosticSteps = [
      "Connexion au serveur Wardis prête",
      "Vérification de la plateforme en cours",
      "Préparation des flux vidéo et accès",
      "Prêt à ouvrir la supervision"
    ];

    diagnosticSteps.forEach((step, i) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} • ${step}`]);
      }, (i + 1) * 250);
    });

    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} • Authentification demandée`, `${new Date().toLocaleTimeString()} • Vérification en cours...`]);

    const success = await login(email, password);

    if (success) {
      setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} • Session validée`, `${new Date().toLocaleTimeString()} • Ouverture du tableau de bord...`]);
    } else {
      setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} • Échec d'authentification`]);
    }
  };

  return (
    <div className="relative min-h-screen w-full wardis-shell digital-grid flex items-center justify-center p-4 overflow-hidden crt-overlay">
      <div className="absolute inset-0 bg-gradient-to-br from-control-cyan/10 via-transparent to-control-green/10" />

      <div className="relative w-full max-w-6xl grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="wardis-panel rounded-[28px] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full wardis-chip px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-control-cyan">
              <Shield className="h-3.5 w-3.5" />
              Accès sécurisé
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-2 rounded-full wardis-chip px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-control-text"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {theme === "dark" ? "Mode clair" : "Mode sombre"}
            </button>
          </div>

          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="wardis-orb flex h-11 w-11 items-center justify-center rounded-2xl text-white">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold text-control-text-bright">Wardis</h1>
                  <p className="text-sm text-control-cyan">Security Operations Suite</p>
                </div>
              </div>
              <p className="mt-4 max-w-md text-sm leading-6 text-control-text">
                Une vue claire et rapide sur vos caméras, portes et alertes pour piloter votre sécurité avec précision et efficacité.
              </p>
            </div>
            <div className="rounded-full wardis-chip px-3 py-1 text-xs font-semibold text-control-text-bright">
              v0.0.1
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="wardis-card rounded-2xl p-4">
              <Camera className="h-5 w-5 text-control-cyan" />
              <div className="mt-3 text-sm font-semibold text-control-text-bright">Surveillance</div>
              <p className="mt-1 text-xs text-control-text">Flux vidéo fluides et supervision rapide.</p>
            </div>
            <div className="wardis-card rounded-2xl p-4">
              <DoorOpen className="h-5 w-5 text-control-cyan" />
              <div className="mt-3 text-sm font-semibold text-control-text-bright">Contrôle d’accès</div>
              <p className="mt-1 text-xs text-control-text">Gestion simple des portes et badges.</p>
            </div>
            <div className="wardis-card rounded-2xl p-4">
              <BellRing className="h-5 w-5 text-control-cyan" />
              <div className="mt-3 text-sm font-semibold text-control-text-bright">Alertes</div>
              <p className="mt-1 text-xs text-control-text">Détection et suivi prioritaires.</p>
            </div>
          </div>
        </div>

        <div className="wardis-panel rounded-[28px] p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-control-text-bright">Connexion</h2>
              <p className="mt-1 text-sm text-control-text">Accédez au tableau de bord opérateur.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-control-green/20 bg-control-green/10 px-3 py-1 text-xs font-semibold text-control-green">
              <span className="h-2 w-2 rounded-full bg-control-green" />
              En ligne
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-control-border bg-control-panel-light p-3 font-mono text-[11px] leading-6 text-control-text">
            <div className="mb-2 border-b border-control-border/70 pb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-control-text-bright">
              Journal système
            </div>
            {logs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap text-control-text">
                {log}
              </div>
            ))}
            {loading && <div className="text-control-amber">Connexion en cours...</div>}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-control-red/30 bg-control-red/10 p-3 text-sm text-control-red">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-control-cyan">
                Adresse e-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@wardis.local"
                className="wardis-input w-full rounded-2xl px-3 py-2.5 text-sm outline-none transition focus:border-control-cyan"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-control-cyan">
                Code d’accès
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="wardis-input w-full rounded-2xl px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-control-cyan"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-control-text transition hover:text-control-cyan"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="wardis-button flex w-full items-center justify-center gap-2 rounded-2xl border border-control-cyan/20 px-4 py-3 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Vérification...</>
              ) : (
                <><Shield className="h-4 w-4" /> Se connecter</>
              )}
            </button>
          </form>

          <div className="mt-5 text-center text-[11px] uppercase tracking-[0.2em] text-control-text/70">
            Personnel autorisé uniquement • Journalisé pour l’audit
          </div>
        </div>
      </div>
    </div>
  );
};
