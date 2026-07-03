# Wardis Client

Wardis Client is a modern control-room themed desktop application built with **Tauri v2**, **React**, **TypeScript**, **Tailwind CSS**, and **Zustand**. It provides interfaces for managing security operations (access control, video live-view, alarms, and real-time events feed).

---

## 🛠️ Build Prerequisites

To compile the application locally, you must set up the development environment matching your operating system.

### 🪟 Windows Setup
1. **Node.js**: Install [Node.js (LTS version)](https://nodejs.org/).
2. **Rust**: Install Rust using [rustup](https://rustup.rs/).
3. **C++ Build Tools**: Install Visual Studio Build Tools. Select the **Desktop development with C++** workload.
4. **NSIS (for `.exe` installers)**:
   - NSIS is automatically downloaded and configured by Tauri when running a build.
5. **WiX Toolset (for `.msi` installers)**:
   - Make sure you install [WiX Toolset v3](https://wixtoolset.org/) (specifically WiX v3.11/v3.14) and add it to your System PATH environment variables.

### 🐧 Linux Setup (Debian/Ubuntu)
1. **Node.js**: Install Node.js (LTS).
2. **Rust**: Install Rust using `rustup`:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **System Dependencies**: Run the following command to install required compilation libraries (WebKit2GTK, GTK3, Ayatana AppIndicator, etc.):
   ```bash
   sudo apt-get update
   sudo apt-get install -y \
     libwebkit2gtk-4.1-dev \
     build-essential \
     curl \
     wget \
     file \
     libssl-dev \
     libgtk-3-dev \
     libayatana-appindicator3-dev \
     librsvg2-dev \
     patchelf \
     xdg-utils
   ```

---

## 🚀 Local Development

First, install the Node.js packages:
```bash
npm install
```

To run the application in development mode with hot-reloading:
```bash
npm run dev
# In another terminal (or let Tauri manage it):
npm run tauri dev
```

---

## 📦 Building Executables Locally

When you trigger a production build, Tauri compiles the frontend, runs the Rust builder, and packs the final installation binaries inside `src-tauri/target/release/bundle/`.

### Compile on Windows (Produces `.exe` and `.msi`)
To generate Windows installers:
```bash
npm run tauri build
```
This builds both targets defined in `tauri.conf.json`:
- **NSIS Installer (`.exe`)**: located in `src-tauri/target/release/bundle/nsis/`
- **WiX Installer (`.msi`)**: located in `src-tauri/target/release/bundle/msi/`

### Compile on Linux (Produces `.deb` and `.AppImage`)
To generate Linux packages:
```bash
npm run tauri build
```
This builds both targets defined in `tauri.conf.json`:
- **Debian Package (`.deb`)**: located in `src-tauri/target/release/bundle/deb/`
- **AppImage (`.AppImage`)**: located in `src-tauri/target/release/bundle/appimage/`

---

## 🚀 Automated CI/CD (GitHub Actions)

A GitHub Actions workflow is preconfigured in `.github/workflows/build.yml`.

- **Triggers**:
  - Automatically runs on any pull request or push to `main`/`master`.
  - Runs on any tag matching `v*` (e.g., `v1.0.0`).
- **Functionality**:
  - Builds Windows executable packages (`.exe` and `.msi`) using `windows-latest`.
  - Builds Linux packages (`.deb` and `.AppImage`) using `ubuntu-22.04`.
  - Creates a **Draft Release** in the GitHub Repository, attaching the generated files automatically.

---

## 💾 Installation Guide

### Windows
- **Standard Installer (`.exe`)**: Double-click the generated `.exe` installer. Follow the setup wizard to install Wardis Client to your user profile directory.
- **Enterprise MSI (`.msi`)**: Double-click the `.msi` installer. This format is ideal for automated network-wide silent deployments:
  ```cmd
  msiexec /i Wardis_0.1.0_x64_en-US.msi /qn
  ```

### Linux
- **Debian/Ubuntu Package (`.deb`)**: Install using `dpkg` or `apt`:
  ```bash
  sudo dpkg -i wardis-client_0.1.0_amd64.deb
  # If there are missing dependencies:
  sudo apt-get install -f
  ```
- **AppImage (`.AppImage`)**: The AppImage runs as a standalone executable without installation:
  ```bash
  chmod +x Wardis_0.1.0_amd64.AppImage
  ./Wardis_0.1.0_amd64.AppImage
  ```
