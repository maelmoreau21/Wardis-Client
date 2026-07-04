import React, { useEffect, useState } from "react";
import { useCameraStore, type Camera } from "../store/cameraStore";
import { useAuthStore } from "../store/authStore";
import { useLanguageStore } from "../store/languageStore";
import { getApiBase, safeFetch } from "../store/config";
import { Video, Plus, Trash2, Edit, Scan } from "lucide-react";

interface DiscoveredCamera {
  ip: string;
  port: number;
  endpoint_url: string;
  device_token: string;
  model: string;
  stream_url: string;
  main_stream_url: string;
  sub_stream_url: string;
  ptz_supported: boolean;
  profile_token: string;
}

export const CameraConfig: React.FC = () => {
  const { token, user } = useAuthStore();
  const { t } = useLanguageStore();
  const { cameras, fetchCameras } = useCameraStore();

  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [editing, setEditing] = useState(false);

  // Form State
  const [nom, setNom] = useState("");
  const [urlRtsp, setUrlRtsp] = useState("");
  const [mainStreamUrl, setMainStreamUrl] = useState("");
  const [subStreamUrl, setSubStreamUrl] = useState("");
  const [statut, setStatut] = useState<"active" | "inactive">("active");
  const [ptzSupported, setPtzSupported] = useState(false);

  // Discovery State
  const [discoveryUser, setDiscoveryUser] = useState("admin");
  const [discoveryPass, setDiscoveryPass] = useState("");
  const [discoveryTimeout] = useState(5);
  const [discoveredCameras, setDiscoveredCameras] = useState<DiscoveredCamera[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryMsg, setDiscoveryMsg] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);

  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase = getApiBase();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleEditCamera = (camera: Camera) => {
    setSelectedCamera(camera);
    setNom(camera.nom);
    setUrlRtsp(camera.url_rtsp);
    setMainStreamUrl(camera.main_stream_url);
    setSubStreamUrl(camera.sub_stream_url);
    setStatut(camera.statut);
    setPtzSupported(camera.ptz_supported);
    setEditing(true);
    setFormMsg(null);
  };

  const handleResetForm = () => {
    setSelectedCamera(null);
    setNom("");
    setUrlRtsp("");
    setMainStreamUrl("");
    setSubStreamUrl("");
    setStatut("active");
    setPtzSupported(false);
    setEditing(false);
    setFormMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setLoading(true);
    setFormMsg(null);

    const payload = {
      nom,
      url_rtsp: urlRtsp,
      main_stream_url: mainStreamUrl,
      sub_stream_url: subStreamUrl,
      statut,
      ptz_supported: ptzSupported
    };

    try {
      const url = editing && selectedCamera 
        ? `${apiBase}/cameras/${selectedCamera.id}` 
        : `${apiBase}/cameras`;
      const method = editing ? "PUT" : "POST";

      const response = await safeFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Failed to save camera settings");
      }

      setFormMsg({ 
        type: "success", 
        text: editing ? "Caméra mise à jour avec succès" : "Caméra enregistrée avec succès" 
      });
      
      handleResetForm();
      fetchCameras();
    } catch (err: any) {
      setFormMsg({ type: "error", text: err.message || "Erreur de sauvegarde" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCamera = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Voulez-vous vraiment supprimer cette caméra ? Cette action supprimera tous ses enregistrements associés.")) {
      return;
    }

    try {
      const response = await safeFetch(`${apiBase}/cameras/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchCameras();
        if (selectedCamera?.id === id) {
          handleResetForm();
        }
      } else {
        alert("Erreur de suppression");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setDiscovering(true);
    setDiscoveryMsg({ type: "info", text: "Lancement du scan UDP WS-Discovery..." });
    setDiscoveredCameras([]);

    try {
      const response = await safeFetch(`${apiBase}/cameras/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          username: discoveryUser,
          password: discoveryPass,
          timeout_seconds: discoveryTimeout
        })
      });

      if (!response.ok) {
        throw new Error("WS-Discovery scan failed");
      }

      const data = await response.json();
      setDiscoveredCameras(data || []);
      setDiscoveryMsg({ 
        type: "success", 
        text: `${data?.length || 0} caméras détectées sur le réseau local.` 
      });
    } catch (err: any) {
      setDiscoveryMsg({ type: "error", text: "Scan échoué. Aucun périphérique ONVIF détecté." });
    } finally {
      setDiscovering(false);
    }
  };

  const handleSelectDiscovered = (dc: DiscoveredCamera) => {
    setNom(`${dc.model || "Caméra ONVIF"} (${dc.ip})`);
    setUrlRtsp(dc.stream_url || "");
    setMainStreamUrl(dc.main_stream_url || dc.stream_url || "");
    setSubStreamUrl(dc.sub_stream_url || "");
    setPtzSupported(dc.ptz_supported);
    setStatut("active");
    setEditing(false);
    // Focus or scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex-1 flex flex-col gap-6">
      
      <div className="grid xl:grid-cols-12 gap-6 items-start">
        
        {/* Left: Camera List */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          <div className="wardis-panel p-6">
            <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Video className="h-4.5 w-4.5 text-control-cyan" />
                <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                  Caméras Configurer
                </h3>
              </div>
              <span className="text-xs font-bold text-control-text/70">
                {cameras.length} enregistrées
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-control-border text-control-text/60 uppercase text-[9px] tracking-wider">
                    <th className="py-2.5 font-bold">Nom / Site</th>
                    <th className="py-2.5 font-bold">RTSP / Stream Principal</th>
                    <th className="py-2.5 font-bold">PTZ</th>
                    <th className="py-2.5 font-bold">Statut</th>
                    {isAdmin && <th className="py-2.5 font-bold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-control-border/30">
                  {cameras.map((c) => (
                    <tr key={c.id} className="hover:bg-control-panel-light/30 transition">
                      <td className="py-3 font-semibold text-control-text-bright">
                        <div>{c.nom}</div>
                        <span className="text-[9px] text-control-text/50 uppercase tracking-wider">
                          {c.site_id ? "HQ Paris" : "Site Principal"}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[10px] text-control-text/80 truncate max-w-xs">
                        {c.main_stream_url || c.url_rtsp}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          c.ptz_supported 
                            ? "bg-control-cyan/10 text-control-cyan border border-control-cyan/20" 
                            : "bg-control-panel-light text-control-text/55"
                        }`}>
                          {c.ptz_supported ? "OUI" : "NON"}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`flex items-center gap-1.5 text-[10px] font-bold ${
                          c.statut === "active" ? "text-control-green" : "text-control-red"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            c.statut === "active" ? "bg-control-green animate-pulse" : "bg-control-red"
                          }`} />
                          {c.statut === "active" ? "ACTIF" : "INACTIF"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => handleEditCamera(c)}
                              className="p-1.5 border border-control-border bg-control-panel-light hover:bg-control-panel-light/80 text-control-text-bright rounded-lg cursor-pointer transition"
                              title="Modifier"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCamera(c.id)}
                              className="p-1.5 border border-control-red/25 bg-control-red/10 hover:bg-control-red/15 text-control-red rounded-lg cursor-pointer transition"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Add/Edit & Discovery Form */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          {/* Add/Edit Panel */}
          <div className="wardis-panel p-6">
            <div className="flex items-center justify-between border-b border-control-border/60 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Plus className="h-4.5 w-4.5 text-control-cyan" />
                <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                  {editing ? "Modifier la Caméra" : "Ajouter une Caméra"}
                </h3>
              </div>
              {editing && (
                <button
                  onClick={handleResetForm}
                  className="text-[10px] text-control-text/75 uppercase tracking-wider hover:text-control-text-bright cursor-pointer"
                >
                  Annuler
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
                  Nom de la caméra
                </label>
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60"
                  placeholder="Caméra Hall Entrée"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
                  URL RTSP Source (Ingestion)
                </label>
                <input
                  type="text"
                  required
                  value={urlRtsp}
                  onChange={(e) => setUrlRtsp(e.target.value)}
                  className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60 font-mono text-[11px]"
                  placeholder="rtsp://admin:password@192.168.1.50:554/stream1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
                    Stream Principal (WHEP/HLS)
                  </label>
                  <input
                    type="text"
                    required
                    value={mainStreamUrl}
                    onChange={(e) => setMainStreamUrl(e.target.value)}
                    className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60 font-mono text-[11px]"
                    placeholder="rtsp://192.168.1.50:554/h264"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold mb-1.5 text-control-text/90">
                    Stream Secondaire (Sub-Stream)
                  </label>
                  <input
                    type="text"
                    value={subStreamUrl}
                    onChange={(e) => setSubStreamUrl(e.target.value)}
                    className="w-full bg-control-bg border border-control-border rounded-lg px-3 py-2 text-xs text-control-text-bright focus:outline-none focus:border-control-cyan/60 font-mono text-[11px]"
                    placeholder="rtsp://192.168.1.50:554/mjpeg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-b border-control-border/40">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ptzSupported}
                    onChange={(e) => setPtzSupported(e.target.checked)}
                    className="accent-control-cyan h-4 w-4 rounded border-control-border bg-control-bg"
                  />
                  Caméra PTZ (Pan-Tilt-Zoom)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-control-text/70">
                    Ingestion :
                  </span>
                  <select
                    value={statut}
                    onChange={(e) => setStatut(e.target.value as any)}
                    className="bg-control-bg border border-control-border rounded px-2 py-1 text-xs text-control-text-bright cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
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

              {isAdmin && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-control-cyan text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-control-cyan/90 cursor-pointer disabled:opacity-50"
                >
                  <Video className="h-4.5 w-4.5" />
                  {loading ? t("submitting") : editing ? "Enregistrer les modifications" : "Créer la caméra"}
                </button>
              )}
            </form>
          </div>

          {/* Discovery Panel */}
          <div className="wardis-panel p-6">
            <div className="flex items-center gap-2 border-b border-control-border/60 pb-3 mb-5">
              <Scan className="h-4.5 w-4.5 text-control-cyan" />
              <h3 className="text-sm font-bold text-control-text-bright uppercase tracking-wider">
                Détection Automatique ONVIF
              </h3>
            </div>

            <form onSubmit={handleDiscover} className="space-y-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-bold mb-1 text-control-text/90">
                    Utilisateur ONVIF
                  </label>
                  <input
                    type="text"
                    value={discoveryUser}
                    onChange={(e) => setDiscoveryUser(e.target.value)}
                    className="w-full bg-control-bg border border-control-border rounded-lg px-2.5 py-1.5 text-xs text-control-text-bright focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider font-bold mb-1 text-control-text/90">
                    Mot de passe ONVIF
                  </label>
                  <input
                    type="password"
                    value={discoveryPass}
                    onChange={(e) => setDiscoveryPass(e.target.value)}
                    className="w-full bg-control-bg border border-control-border rounded-lg px-2.5 py-1.5 text-xs text-control-text-bright focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {discoveryMsg && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold ${
                    discoveryMsg.type === "success"
                      ? "bg-control-green/10 border border-control-green/20 text-control-green"
                      : discoveryMsg.type === "error"
                      ? "bg-control-red/10 border border-control-red/20 text-control-red"
                      : "bg-control-cyan/10 border border-control-cyan/20 text-control-cyan"
                  }`}
                >
                  {discoveryMsg.text}
                </div>
              )}

              {isAdmin && (
                <button
                  type="submit"
                  disabled={discovering}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-control-cyan bg-control-cyan/10 text-control-cyan hover:bg-control-cyan/25 px-4 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
                >
                  {discovering ? (
                    <>
                      <div className="h-3 w-3 border border-control-cyan border-t-transparent rounded-full animate-spin" />
                      Recherche en cours...
                    </>
                  ) : (
                    <>
                      <Scan className="h-4 w-4" />
                      Lancer la détection (UDP Multicast)
                    </>
                  )}
                </button>
              )}
            </form>

            {/* List of Discovered Cameras */}
            {discoveredCameras.length > 0 && (
              <div className="mt-4 border border-control-border/60 rounded-xl overflow-hidden divide-y divide-control-border/30 bg-control-bg/40 max-h-60 overflow-y-auto">
                {discoveredCameras.map((dc, index) => (
                  <div key={index} className="p-3 flex items-center justify-between text-xs hover:bg-control-panel-light/20 transition">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-control-text-bright truncate">{dc.model || "Caméra Générique"}</div>
                      <div className="text-[10px] font-mono text-control-text/75">{dc.ip}:{dc.port}</div>
                    </div>
                    <button
                      onClick={() => handleSelectDiscovered(dc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-control-cyan text-white text-[10px] font-bold uppercase tracking-wider hover:bg-control-cyan/95 transition cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      Importer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
