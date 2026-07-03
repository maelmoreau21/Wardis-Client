import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { Shield, ShieldAlert, Terminal, Eye, EyeOff, Loader2 } from "lucide-react";

export const Login: React.FC = () => {
  const { login, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Simulated terminal diagnostics logs on mount
  useEffect(() => {
    const diagnosticSteps = [
      "SYSTEM INITIATED: WARDIS NODE-V2.04",
      "ESTABLISHING HOST CONNECTION PROTOCOL...",
      "TARGET ACCESS NODE: http://localhost:8080",
      "STATUS: STANDBY - awaiting credentials..."
    ];

    diagnosticSteps.forEach((step, i) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${step}`]);
      }, (i + 1) * 350);
    });

    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] AUTH PROTOCOL REQUESTED FOR: ${email}`,
      `[${new Date().toLocaleTimeString()}] INITIATING CRYPTO HANDSHAKE...`
    ]);

    const success = await login(email, password);

    if (success) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] CRYPTO HANDSHAKE VALIDATED.`,
        `[${new Date().toLocaleTimeString()}] SESSION INITIALIZED. DIVERTING TO CONTROL DASHBOARD...`
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERR: AUTH PROTOCOL REJECTED BY HOST.`
      ]);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-control-bg text-control-text digital-grid flex items-center justify-center p-4 overflow-hidden crt-overlay">
      {/* Scanline effect */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-control-cyan/5 to-transparent pointer-events-none animate-scanline" />

      {/* Login Box */}
      <div className="relative w-full max-w-lg bg-control-panel/90 border border-control-border p-6 rounded-none shadow-2xl backdrop-blur-md brackets animate-glow">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-control-border pb-4 mb-6">
          <div className={`p-2 border ${error ? "border-control-red text-control-red bg-control-red/10 animate-pulse" : "border-control-cyan text-control-cyan bg-control-cyan/10"}`}>
            {error ? <ShieldAlert className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-control-text-bright font-bold tracking-widest text-sm md:text-base">
              WARDIS // SECURE NODE
            </h1>
            <p className="text-xs text-control-cyan font-semibold tracking-wider">
              OPERATOR INTERFACE v2.04
            </p>
          </div>
          <div className="ml-auto text-right text-xs">
            <span className="inline-block h-2 w-2 rounded-full bg-control-green animate-pulse mr-2"></span>
            <span className="text-control-text-bright font-semibold">GATEWAY READY</span>
          </div>
        </div>

        {/* Diagnostic Terminal View */}
        <div className="w-full bg-control-bg/95 border border-control-border/60 p-3 rounded-none mb-6 h-28 overflow-y-auto font-mono text-[10px] text-control-cyan/80 leading-relaxed">
          <div className="flex items-center gap-1 border-b border-control-border/30 pb-1 mb-2 text-control-text-bright/60">
            <Terminal className="h-3 w-3" />
            <span>SYS_DIAGNOSTICS.LOG</span>
          </div>
          {logs.map((log, idx) => (
            <div key={idx} className="whitespace-pre-wrap">
              {log}
            </div>
          ))}
          {loading && (
            <div className="text-control-amber animate-pulse">
              [{new Date().toLocaleTimeString()}] IN PROGRESS: Authenticating with security gateway...
            </div>
          )}
        </div>

        {/* Security Alert message */}
        {error && (
          <div className="flex items-start gap-2 bg-control-red/10 border border-control-red/40 p-3 text-xs text-control-red mb-6 font-mono">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">ACCESS DENIED:</span> {error}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-control-cyan mb-1.5">
              Operator Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@wardis.local"
                className="w-full bg-control-bg border border-control-border focus:border-control-cyan focus:outline-none px-3 py-2 text-sm text-control-text-bright font-mono transition-all rounded-none placeholder-control-text/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-control-cyan mb-1.5">
              Security Keycode
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-control-bg border border-control-border focus:border-control-cyan focus:outline-none px-3 py-2 pr-10 text-sm text-control-text-bright font-mono transition-all rounded-none placeholder-control-text/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2 text-control-text hover:text-control-cyan transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 relative flex items-center justify-center gap-2 border border-control-cyan bg-control-cyan/10 hover:bg-control-cyan/20 disabled:bg-control-bg disabled:border-control-border disabled:text-control-text/40 text-control-cyan font-bold tracking-widest text-xs py-3 px-4 transition-all cursor-pointer select-none rounded-none active:scale-[0.99] group overflow-hidden"
          >
            {/* Hover overlay sheen */}
            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/10 opacity-40 group-hover:animate-[shimmer_0.75s_ease-out]" />
            
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-control-amber" />
                <span className="text-control-amber">VERIFYING OPERATOR SEED...</span>
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span>INITIALIZE SECURITY PROTOCOL</span>
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-control-border/60 text-center font-mono text-[9px] text-control-text/50 uppercase tracking-widest leading-relaxed">
          <div>Authorized Personnel Only • IP logged for security audits</div>
          <div>Wardis System Integration Network © {new Date().getFullYear()}</div>
        </div>
      </div>
    </div>
  );
};
