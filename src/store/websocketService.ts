import { useAuthStore } from "./authStore";
import { useAlarmStore, AlarmNotification, playAlarmSound } from "./alarmStore";
import { useEventStore, CorrelatedEvent } from "./eventStore";
import { useCameraStore } from "./cameraStore";
import { useVideoWallStore } from "./videoWallStore";
import { getApiBase } from "./config";
import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";

let socket: WebSocket | null = null;
let reconnectTimeout: number | null = null;

export const connectWebSocket = () => {
  const token = useAuthStore.getState().token;
  if (!token) {
    console.warn("WebSocket connect aborted: No auth token available");
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const apiBase = getApiBase(); // e.g. "http://localhost:8080"
  const wsUrl = apiBase.replace(/^http/, "ws") + `/events/ws?token=${encodeURIComponent(token)}`;

  console.log("Connecting to events WebSocket...", wsUrl);
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("Events WebSocket connected successfully");
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("WebSocket event received:", data);

      const eventType = data.event_type || "system.info";
      const timestamp = data.timestamp || data.created_at || new Date().toISOString();

      // 1. Process Event in EventStore
      const details = data.details || {};
      const payload = details.payload || {};
      
      const siteId = data.site_id || payload.site_id || details.site_id || details.door?.site_id;
      const zoneId = data.zone_id || payload.zone_id || details.alarm?.zone_id;
      const cameraId = data.camera_id || payload.camera_id || details.camera_id || details.correlation?.camera_id;
      const badgeNum = data.badge_number || payload.badge_number || details.badge_number || details.correlation?.badge_number;

      let message = data.message || "";
      if (!message) {
        if (eventType === "alarm.triggered") {
          const zoneObj = useAlarmStore.getState().zones.find(z => z.id === zoneId);
          const sensorObj = useAlarmStore.getState().sensors.find(s => s.id === data.capteur_id || payload.capteur_id);
          const zoneName = zoneObj ? zoneObj.nom : "Zone Inconnue";
          const sensorName = sensorObj ? sensorObj.nom : "Capteur Inconnu";
          message = `🚨 ALERTE SÉCURITÉ : ${sensorName} dans ${zoneName}`;
        } else if (eventType === "alarm.acknowledged") {
          const userMail = payload.username || "Opérateur";
          const reason = payload.reason || "sans motif";
          message = `✅ ALARME ACQUITTEE par ${userMail} (Motif: ${reason})`;
        } else if (eventType === "alarm.transferred") {
          const userMail = payload.username || "Opérateur";
          const recipient = payload.recipient || "un autre groupe";
          const reason = payload.reason || "sans motif";
          message = `➡️ ALARME TRANSFEREE à ${recipient} par ${userMail} (Motif: ${reason})`;
        } else if (eventType === "alarm.snoozed") {
          const userMail = payload.username || "Opérateur";
          const duration = payload.duration_minutes || 5;
          const reason = payload.reason || "sans motif";
          message = `⏳ ALARME REPORTEE de ${duration} minutes par ${userMail} (Motif: ${reason})`;
        } else if (eventType.startsWith("access.granted")) {
          message = `🔓 Accès AUTORISÉ : Badge #${badgeNum || "Inconnu"} à la porte`;
        } else if (eventType.startsWith("access.denied")) {
          message = `❌ Accès REFUSÉ : Badge #${badgeNum || "Inconnu"} à la porte`;
        } else if (eventType.startsWith("video.motion")) {
          message = `📹 Mouvement détecté sur la caméra`;
        } else {
          message = `Événement système : ${eventType}`;
        }
      }

      const newEvent: CorrelatedEvent = {
        id: data.id || Math.random().toString(),
        event_type: eventType,
        message,
        site_id: siteId,
        zone_id: zoneId,
        camera_id: cameraId,
        badge_number: badgeNum,
        timestamp,
        details
      };

      // Append event to eventStore
      useEventStore.setState((state) => {
        if (state.events.some(e => e.id === newEvent.id)) return state;
        return { events: [newEvent, ...state.events].slice(0, 200) };
      });

      // 2. Process Alarm triggers & actions in AlarmStore
      if (eventType === "alarm.triggered") {
        await useAlarmStore.getState().fetchActiveAlarms();
        await useAlarmStore.getState().fetchSensors();
        await useAlarmStore.getState().fetchZones();

        const zoneObj = useAlarmStore.getState().zones.find(z => z.id === zoneId);
        const sensorObj = useAlarmStore.getState().sensors.find(s => s.id === data.capteur_id || payload.capteur_id);

        const zoneName = zoneObj ? zoneObj.nom : "Zone Inconnue";
        const sensorName = sensorObj ? sensorObj.nom : "Capteur Inconnu";
        const sensorType = sensorObj ? sensorObj.type : "ouverture";

        let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
        if (sensorType === "mouvement") severity = "HIGH";
        else if (sensorType === "ouverture") severity = "MEDIUM";

        const notif: AlarmNotification = {
          id: payload.alarme_id || Math.random().toString(),
          zoneName,
          sensorName,
          severity,
          timestamp: new Date(timestamp).toLocaleTimeString()
        };

        useAlarmStore.setState({ notification: notif });

        if (!useAlarmStore.getState().muted) {
          playAlarmSound(severity);
        }

        try {
          const appWindow = getCurrentWindow();
          await appWindow.requestUserAttention(UserAttentionType.Critical);
        } catch (err) {
          console.warn("Tauri window flash not supported/allowed:", err);
        }

        if (Notification.permission === "granted") {
          new Notification(`Wardis : Alarme active`, {
            body: `${sensorName} déclenché dans ${zoneName}`,
            icon: "/icons/128x128.png"
          });
        }

        const cameras = useCameraStore.getState().cameras;
        const assocCam = cameras.find(c => c.zone_id === zoneId);
        if (assocCam) {
          console.log("Auto-assigning camera to video wall:", assocCam.nom);
          useVideoWallStore.getState().autoAssignCameraOnAlarm(assocCam.id);
        }
      } else if (eventType === "alarm.acknowledged" || eventType === "alarm.transferred" || eventType === "alarm.snoozed") {
        await useAlarmStore.getState().fetchActiveAlarms();
        await useAlarmStore.getState().fetchSensors();
        await useAlarmStore.getState().fetchZones();

        const alarmID = payload.alarme_id || data.alarme_id;
        const currentNotif = useAlarmStore.getState().notification;
        if (currentNotif && currentNotif.id === alarmID) {
          useAlarmStore.setState({ notification: null });
        }
      }
    } catch (err) {
      console.error("Failed to process WebSocket event:", err);
    }
  };

  socket.onerror = (err) => {
    console.error("Events WebSocket error:", err);
  };

  socket.onclose = () => {
    console.warn("Events WebSocket connection closed. Scheduling reconnect...");
    socket = null;
    
    if (!reconnectTimeout) {
      reconnectTimeout = window.setTimeout(() => {
        reconnectTimeout = null;
        connectWebSocket();
      }, 5000);
    }
  };
};

export const disconnectWebSocket = () => {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
};
