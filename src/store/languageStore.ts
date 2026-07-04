import { create } from "zustand";

export type Language = "fr" | "en";

export const translations = {
  fr: {
    // Login Screen
    supervisionPlatform: "Plateforme de Supervision",
    clearMode: "Mode clair",
    darkMode: "Mode sombre",
    securitySuite: "Security Suite",
    brandingDescription: "Supervision centralisée et performante. Pilotez vos flux vidéo en direct, contrôlez les accès physiques et traitez les alertes de sécurité depuis une console unifiée, simple et efficace.",
    surveillance: "Surveillance",
    surveillanceDesc: "Flux vidéo en temps réel à faible latence.",
    access: "Accès",
    accessDesc: "Contrôle à distance des portes et lecteurs.",
    alerts: "Alertes",
    alertsDesc: "Notifications instantanées des anomalies.",
    authTitle: "Authentification",
    authDesc: "Veuillez renseigner vos identifiants.",
    activeService: "Service actif",
    inactiveService: "Service inactif",
    checkingService: "Vérification...",
    serverUrlLabel: "Adresse du serveur",
    usernameLabel: "Identifiant",
    usernamePlaceholder: "Nom d'utilisateur",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "••••••••••••",
    submitting: "Validation en cours...",
    loginButton: "Se connecter",
    authFooter: "Console réservée au personnel autorisé",
    errorInvalidPasswordLength: "Longueur de mot de passe invalide (minimum 4 caractères).",
    errorInvalidIdentifierFormat: "Format d'identifiant invalide (minimum 3 caractères).",
    errorInvalidCredentials: "Nom d'utilisateur ou mot de passe incorrect.",
    errorInternalServer: "Erreur interne du serveur.",
    errorConnectionFailed: "Impossible de se connecter à la passerelle de sécurité.",
    
    // Dashboard Navigation & Shell
    dashboardTitle: "Supervision",
    overviewTab: "Vue d’ensemble",
    liveTab: "Surveillance",
    accessTab: "Accès",
    alertsTab: "Alertes",
    eventsTab: "Événements",
    mapTab: "Carte",
    themeToggleLight: "Thème Clair",
    themeToggleDark: "Thème Sombre",
    themeToggleLightLabel: "Thème Clair",
    themeToggleDarkLabel: "Thème Sombre",
    logoutButton: "Déconnexion",
    headerSubtitle: "Console de supervision Wardis",
    systemStable: "Système stable",
    activeAlertsCount: "{{count}} alerte(s)",
    lastActivity: "Dernière activité :",
    operatorId: "ID OP: {{id}}",
    
    // Dashboard Content & Status Panel
    activeCameras: "Caméras actives",
    camerasSynced: "flux vidéo synchronisés",
    doors: "Portes",
    doorsStatusDesc: "ouvertes / configurées",
    activeAlerts: "Alertes actives",
    alertsPriority: "à acquitter en priorité",
    serviceStatus: "État des services",
    latency: "Latence: {{latency}}ms",
    generalStatus: "État général du système",
    statusStable: "stable",
    natsServer: "Serveur NATS",
    natsConnected: "connecté",
    accessGateway: "Passerelle d'accès",
    gatewayOnline: "en ligne",
    videoServer: "Serveur d'enregistrement vidéo",
    serverActive: "actif",
    systemJournal: "Journal système",
    
    // Log items / events
    dashboardReady: "Tableau de bord prêt",
    accessSystemReady: "Système d’accès prêt et à l’écoute",
    videoSyncOk: "Synchronisation vidéo OK",
    intrusionZonesArmed: "Zones d’intrusion armées",
    eventStreamStable: "Flux d’événements stable",
    noCriticalAlerts: "Aucune alerte critique détectée",
    tabLogged: "Onglet : {{label}}"
  },
  en: {
    // Login Screen
    supervisionPlatform: "Supervision Platform",
    clearMode: "Light mode",
    darkMode: "Dark mode",
    securitySuite: "Security Suite",
    brandingDescription: "Centralized and powerful supervision. Stream live video, control physical access, and process security alerts from a unified, simple, and efficient console.",
    surveillance: "Surveillance",
    surveillanceDesc: "Real-time video streams with low latency.",
    access: "Access",
    accessDesc: "Remote control of doors and readers.",
    alerts: "Alerts",
    alertsDesc: "Instant notifications of anomalies.",
    authTitle: "Authentication",
    authDesc: "Please enter your credentials.",
    activeService: "Service active",
    inactiveService: "Service inactive",
    checkingService: "Checking...",
    serverUrlLabel: "Server address",
    usernameLabel: "Username",
    usernamePlaceholder: "Username",
    passwordLabel: "Password",
    passwordPlaceholder: "••••••••••••",
    submitting: "Validating...",
    loginButton: "Sign in",
    authFooter: "Console reserved for authorized personnel",
    errorInvalidPasswordLength: "Invalid password length (minimum 4 characters).",
    errorInvalidIdentifierFormat: "Invalid identifier format (minimum 3 characters).",
    errorInvalidCredentials: "Invalid username or password.",
    errorInternalServer: "Internal server error.",
    errorConnectionFailed: "Failed to connect to the security gateway.",
    
    // Dashboard Navigation & Shell
    dashboardTitle: "Supervision",
    overviewTab: "Overview",
    liveTab: "Surveillance",
    accessTab: "Access",
    alertsTab: "Alerts",
    eventsTab: "Events",
    mapTab: "Map",
    themeToggleLight: "Light Theme",
    themeToggleDark: "Dark Theme",
    themeToggleLightLabel: "Light Theme",
    themeToggleDarkLabel: "Dark Theme",
    logoutButton: "Sign Out",
    headerSubtitle: "Wardis supervision console",
    systemStable: "System stable",
    activeAlertsCount: "{{count}} alert(s)",
    lastActivity: "Last activity:",
    operatorId: "OP ID: {{id}}",
    
    // Dashboard Content & Status Panel
    activeCameras: "Active cameras",
    camerasSynced: "video streams synced",
    doors: "Doors",
    doorsStatusDesc: "open / configured",
    activeAlerts: "Active alerts",
    alertsPriority: "to acknowledge first",
    serviceStatus: "Service status",
    latency: "Latency: {{latency}}ms",
    generalStatus: "General system status",
    statusStable: "stable",
    natsServer: "NATS Server",
    natsConnected: "connected",
    accessGateway: "Access Gateway",
    gatewayOnline: "online",
    videoServer: "Video recording server",
    serverActive: "active",
    systemJournal: "System journal",
    
    // Log items / events
    dashboardReady: "Dashboard ready",
    accessSystemReady: "Access system ready and listening",
    videoSyncOk: "Video sync OK",
    intrusionZonesArmed: "Intrusion zones armed",
    eventStreamStable: "Event stream stable",
    noCriticalAlerts: "No critical alerts detected",
    tabLogged: "Tab: {{label}}"
  }
};

export type TranslationKey = keyof typeof translations.fr;

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: (typeof window !== "undefined" ? localStorage.getItem("wardis-lang") as Language : "fr") || "fr",
  setLanguage: (lang) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("wardis-lang", lang);
    }
    set({ language: lang });
  },
  t: (key, variables) => {
    const lang = get().language;
    let translation = translations[lang][key] || translations["fr"][key] || String(key);
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        translation = translation.replace(new RegExp(`{{${k}}}`, "g"), String(v));
      });
    }
    return translation;
  }
}));
