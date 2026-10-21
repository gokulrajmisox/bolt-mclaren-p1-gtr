# BOLT · McLaren P1 GTR Digital Twin & Telemetry OS

An enterprise-grade, high-fidelity 3D digital twin, interactive engineering Bill of Materials (BOM) explorer, and telemetry operating system for the **McLaren P1 GTR**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-r165-black?logo=three.js)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)

---

## ⚡ Highlights & Key Features

- **High-Fidelity 3D Viewport**: Real-time WebGL rendering of the McLaren P1 GTR in an industrial underground bunker environment with ACESFilmic tone mapping, PBR clearcoat shaders, and contact shadows.
- **Cinematic Prologue & Transition**: Hardware-accelerated full-screen video intros with seamless audio controls and keyboard bypass (<kbd>Enter</kbd>).
- **Aurora Glass Login Portal**: Modern glassmorphic 3D tilt card authentication interface with interactive ambient particle physics.
- **Interactive CAD Exploded View**: Explodes and expands structural vehicle subassemblies (MonoCage chassis, 800V hybrid battery pack, twin-turbo V8, aero wing, carbon-ceramic brakes) with custom directional delta vectors.
- **Camera Perspective Presets**: Instant dynamic camera transitions across Front Nose, Side Aero Profile, Top-Down Aerial, Cockpit Interior, Rear Wing & Diffuser, and Orbit.
- **Engineering Bill of Materials (BOM)**: Real-time inventory status, RFID tracking, suppliers, unit costs, thermal tolerances, and ESG sustainability metrics (SDG 9 & SDG 12).
- **Simulated ACID Database Engine**: PostgreSQL-inspired storage engine with Write-Ahead Logging (WAL), MVCC visibility maps, two-phase commit (2PC) validation, and multi-select batch stock operations.
- **Procedural Web Audio Engine**: Synthesized engine rev acceleration soundscapes, gearshifts, and tactile interface feedback.

---

## 🛠️ Technology Stack

- **Core Framework**: React 18 & Vite
- **3D Graphics Engine**: Three.js, React Three Fiber (`@react-three/fiber`), and Drei (`@react-three/drei`)
- **Animation & Transitions**: Framer Motion
- **Styling & Design System**: Tailwind CSS & Apple-style Liquid Glass FX
- **Iconography**: Lucide React
- **Audio Synthesis**: Native Web Audio API procedural synthesis

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm` or `yarn` / `pnpm`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/gokulrajmisox/bolt-mclaren-p1-gtr.git
   cd bolt-mclaren-p1-gtr
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

### Default Credentials
- **Username**: `admin`
- **Password**: `admin`

---

## 📜 Build for Production

To generate an optimized production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 📄 License

This project is licensed under the MIT License.
