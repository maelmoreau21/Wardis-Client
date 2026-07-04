# Wardis Client 🖥️

Wardis est un système de gestion vidéo (VMS) et de contrôle d'accès de niveau industriel, conçu pour offrir une alternative moderne, performante et hautement disponible aux solutions propriétaires majeures comme Genetec.

Ce dépôt contient la partie **Client UI** de l'application, développée avec Tauri et React.

## 🛠️ Pile Technique
* **Framework Desktop :** Tauri (v2) écrit en Rust, garantissant une application native, légère et ultra-sécurisée sans la lourdeur d'Electron.
* **Frontend :** React, TypeScript et Tailwind CSS pour une interface utilisateur moderne et fluide.
* **Gestion d'État :** Zustand pour des stores globaux légers et réactifs (caméras, alarmes, accès).
* **Compatibilité :** Cross-platform (Windows et Linux).

## ✨ Fonctionnalités implémentées
* **LiveView Basse Latence :** Intégration du protocole WebRTC (WHEP) pour afficher les flux vidéo en direct avec une latence inférieure à 500ms.
* **Gestion Multi-Écrans :** Possibilité pour l'opérateur de détacher un flux vidéo en direct dans une fenêtre native indépendante de Tauri pour l'affichage sur des murs d'images ou configurations multi-moniteurs.
* **Cartographie SVG Interactive :** Importation de plans de masse de bâtiments avec positionnement dynamique des caméras et des portes. Clignotement rouge en temps réel lors de la détection d'une alarme ou d'une intrusion.
* **Contrôle PTZ :** Support des joysticks USB physiques via l'API Gamepad pour piloter les caméras motorisées en direct.

## 🚀 CI/CD & Distribution
* **GitHub Actions :** Pipeline automatisé déclenché lors de la création d'un tag de version (ex: `v1.0.0`). Compile automatiquement les livrables natifs pour **Windows (`.exe`)** et **Linux (`.deb`)** et les attache directement dans les Releases GitHub.

---

## ⚖️ Licence & Propriété Intellectuelle

**PROPRIETARY & SOURCE-AVAILABLE LICENSE**

Copyright (c) 2026 Maël Moreau. Tous droits réservés.

Le code source présent dans ce dépôt est public uniquement à des fins de consultation, de démonstration technique et d'audit. 
* **Exploitation commerciale :** Strictement interdite. Seul l'auteur original (Maël Moreau) détient le droit exclusif d'exploiter ce logiciel à des fins commerciales, lucratives ou professionnelles.
* **Forks et Modifications :** En cas de fork ou de dérivation autorisée par la plateforme GitHub, le crédit complet à l'auteur original doit être maintenu de manière visible dans l'ensemble du code et des documentations.
* **Utilisation tierce :** Aucune licence d'utilisation, de distribution ou de modification gratuite n'est accordée aux tiers sans l'accord écrit explicite de l'auteur.