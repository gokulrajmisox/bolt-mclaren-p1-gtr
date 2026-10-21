import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  useGLTF, 
  OrbitControls, 
  Html, 
  ContactShadows, 
  Grid, 
  Environment, 
  Cloud,
  Sparkles,
  Float
} from '@react-three/drei';
import * as THREE from 'three';
import { 
  Cpu, 
  Layers, 
  Database, 
  Activity, 
  Zap, 
  ShieldCheck, 
  AlertTriangle, 
  Radio, 
  Play, 
  FastForward, 
  RotateCcw, 
  ChevronRight, 
  ChevronDown, 
  Box, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Sparkles as SparklesIcon,
  HardDrive,
  Lock,
  GitBranch,
  Terminal,
  Volume2,
  VolumeX,
  X,
  Folder,
  Sliders,
  Share2,
  Gauge,
  Thermometer,
  Wrench,
  Atom,
  Server,
  Flame,
  Camera,
  Search,
  Plus,
  Minus,
  CheckSquare,
  Square,
  ArrowRight,
  RefreshCw,
  User,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 1. SUPABASE CLIENT & ENTERPRISE CONFIGURATION
// ============================================================================
const SUPABASE_URL = 'https://grkwqpixawnqveiafmfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_D8bepgPx_mQu5J5n-rujBw_rXtx8rih';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const isSupabaseConfigured = true;

const CAR_MODEL_URL = '/free_mclaren_p1_gtr.glb';
const MODEL_URL = CAR_MODEL_URL;
const GARAGE_URL = '/uploads_files_4478463_Underground+Garage+Scene.glb';

// ============================================================================
// 1.1 MCLAREN P1 GTR (.GLB) NODE CLASSIFIER & 3D PIN COORDINATES
// ============================================================================
function classifyMclarenNode(nodeName = '', matName = '', parentName = '') {
  const n = `${nodeName} ${parentName}`.toLowerCase();
  const m = matName.toLowerCase();

  // BOM-03: Wheels, Tires, Rims, Brake Disks & Calipers
  if (
    n.includes('brake_9') ||
    ['tires', 'rims', 'disk', 'disk_circles', 'brake', 'tire_logo'].includes(m) ||
    ['object_24', 'object_25', 'object_26', 'object_27', 'object_28', 'object_29'].includes(nodeName.toLowerCase())
  ) {
    return {
      bomId: 'BOM-03',
      pinCoord: [0.65, 0.28, 0.95],
      explodeOffset: [0, -0.25, 0.55]
    };
  }

  // BOM-05: Windshield, Canopy Glass, Side Mirrors & Front LED Headlights
  if (
    n.includes('headlight') ||
    n.includes('daylight') ||
    n.includes('side mirrors') ||
    n.includes('plane.082') ||
    n.includes('plane.099') ||
    m.includes('headlight') ||
    m.includes('windshield') ||
    m.includes('side_mirrors')
  ) {
    return {
      bomId: 'BOM-05',
      pinCoord: [0.0, 0.62, 0.65],
      explodeOffset: [0, 0.65, 0.65]
    };
  }

  // BOM-04: Interior Cockpit, Divider & Roof Plastic Trim
  if (
    n.includes('interior') ||
    n.includes('inside divider') ||
    n.includes('mid roof') ||
    n.includes('plane.107') ||
    ['interior', 'back_extra_1', 'plastic'].includes(m)
  ) {
    return {
      bomId: 'BOM-04',
      pinCoord: [0.0, 0.48, 0.15],
      explodeOffset: [0, 0.30, 0]
    };
  }

  // BOM-01: Nitro / Battery Tanks & Underbody Sub-Assemblies
  if (
    n.includes('back tanks') ||
    n.includes('plane.058') ||
    n.includes('plane.070') ||
    ['back_extra_5_nitro', 'bck_extra_4', 'back_extra_6'].includes(m)
  ) {
    return {
      bomId: 'BOM-01',
      pinCoord: [0.0, 0.25, -1.15],
      explodeOffset: [0, -0.55, 0]
    };
  }

  // BOM-02: Rear Wing Spoiler, Exhaust System & Tail Lights
  if (
    n.includes('spoiler') ||
    n.includes('brake lights') ||
    m.includes('wing') ||
    m.includes('exhaust') ||
    m.includes('tail_light') ||
    (m.includes('back_extra_3') && !n.includes('air vents')) ||
    m === 'back_extra_2'
  ) {
    return {
      bomId: 'BOM-02',
      pinCoord: [0.0, 0.66, -1.28],
      explodeOffset: [0, 0.55, -0.95]
    };
  }

  // BOM-00: Main Body Shell, Carbon Aero & Vents (Default)
  return {
    bomId: 'BOM-00',
    pinCoord: [0.0, 0.52, 0.45],
    explodeOffset: [0, 0.45, 0]
  };
}

// Background garage filter to hide old embedded meshes
const GARAGE_PREFIXES = [
  'bottom light bars', 'cylinder', 'cube', 'plane', 'pipe',
  'scribble', 'ladder', 'p_workshop', 'blinking light', 'beziercurve', 'empty', 'light_02'
];

function classifyGlbNode(nodeName = '', matName = '') {
  const n = nodeName.toLowerCase();
  if (GARAGE_PREFIXES.some((prefix) => n.startsWith(prefix))) {
    return { type: 'GARAGE', bomId: null, explodeOffset: [0, 0, 0] };
  }
  return { type: 'CAR', bomId: 'BOM-00', explodeOffset: [0, 0, 0] };
}

// High-impact Camera Perspective Presets calibrated for McLaren P1 GTR
const CAMERA_PRESETS = [
  { id: 'front', name: 'FRONT NOSE', pos: [0, 0.70, 3.8], target: [0, 0.35, 0.5] },
  { id: 'hero', name: 'HERO 3/4', pos: [3.2, 1.3, 2.8], target: [0, 0.35, 0.1] },
  { id: 'cockpit', name: 'COCKPIT', pos: [0.25, 0.75, 0.15], target: [-0.15, 0.55, 0.45] },
  { id: 'aero', name: 'AERO REAR', pos: [0, 1.2, -3.8], target: [0, 0.55, -0.6] }
];

// ============================================================================
// 2. PROCEDURAL WEB AUDIO SYNTHESIZER (ZERO EXTERNAL MP3 ASSETS)
// ============================================================================
class ProceduralAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.analyser = null;
    this.masterGain = null;
    this.initialized = false;
    this.hasRevved = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio init skipped:', e);
    }
  }

  playAccelerationSequence() {
    if (!this.ctx || this.isMuted || this.hasRevved) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.hasRevved = true;

    const t = this.ctx.currentTime;

    // 1. Multi-Oscillator Supercar Engine Rev
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    // Pitch sweep: deep idle rumble -> violent twin-motor acceleration -> downshift braking growl
    osc1.frequency.setValueAtTime(45, t);
    osc1.frequency.exponentialRampToValueAtTime(380, t + 1.2);
    osc1.frequency.exponentialRampToValueAtTime(220, t + 1.6);
    osc1.frequency.exponentialRampToValueAtTime(80, t + 2.4);

    osc2.frequency.setValueAtTime(45.5, t);
    osc2.frequency.exponentialRampToValueAtTime(385, t + 1.2);
    osc2.frequency.exponentialRampToValueAtTime(224, t + 1.6);
    osc2.frequency.exponentialRampToValueAtTime(82, t + 2.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(2800, t + 1.2);
    filter.frequency.exponentialRampToValueAtTime(420, t + 2.4);
    filter.Q.setValueAtTime(3.8, t);

    oscGain.gain.setValueAtTime(0.01, t);
    oscGain.gain.linearRampToValueAtTime(0.32, t + 0.3);
    oscGain.gain.linearRampToValueAtTime(0.38, t + 1.2);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 2.6);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 2.7);
    osc2.stop(t + 2.7);

    // 2. High-Frequency Turbocharger Spool & BOV Chirp
    this.playTurboSpool(t);

    // 3. Downshift Exhaust Backfire Pops & Crackles
    this.scheduleBackfirePops(t + 1.5, 6);
  }

  playTurboSpool(startTime) {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2.0;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, startTime);
      filter.frequency.exponentialRampToValueAtTime(3200, startTime + 1.2);
      filter.Q.setValueAtTime(5.5, startTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 1.1);
      // Sudden blow-off valve (BOV) decompression whoosh
      gain.gain.setValueAtTime(0.24, startTime + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.6);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      whiteNoise.start(startTime);
      whiteNoise.stop(startTime + 1.7);
    } catch (e) {
      // Audio safety trap
    }
  }

  scheduleBackfirePops(startTime, count = 6) {
    if (!this.ctx) return;
    for (let i = 0; i < count; i++) {
      const popTime = startTime + i * 0.12 + (Math.random() * 0.06);
      this.playExhaustPop(popTime);
    }
  }

  playExhaustPop(time) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 + Math.random() * 80, time);
      osc.frequency.exponentialRampToValueAtTime(30, time + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, time);

      gain.gain.setValueAtTime(0.35 + Math.random() * 0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.1);
    } catch (e) {
      // Safety trap
    }
  }

  playClickSound() {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(450, t + 0.04);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) {
      // Safety trap
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  getWaveformData() {
    if (!this.analyser) return new Uint8Array(16);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data.slice(0, 16);
  }
}

const audio = new ProceduralAudioEngine();

// ============================================================================
// 3. ENTERPRISE TIER-1 BILL OF MATERIALS (BOM) DATASET
// ============================================================================
const INITIAL_BOM_DATA = [
  {
    id: 'BOM-00',
    parentId: null,
    name: 'Aero-Monocoque MonoCage & Carbon Splitters',
    meshKey: 'Aero_Monocoque_Body_Splitters',
    level: 1,
    category: 'Structural Chassis & Aero',
    material: 'Prepreg T1000G Carbon Fiber / Titanium Bulkheads',
    purity: 'High-Modulus Dry Carbon MonoCage',
    bin: 'Zone-A | Bay-01 | Monocoque Jig',
    rfid: 'RFID-9842-A1',
    rfidStatus: 'ACTIVE_ONLINE',
    supplier: 'McLaren Special Operations (MSO) & Toray',
    leadTimeDays: 18,
    stock: 42,
    reorderLevel: 50,
    status: 'warning',
    qcHold: false,
    unitCost: '$84,500',
    voltage: 'Galvanic Isolated Monocoque',
    thermalTolerance: '-40°C to +180°C',
    torqueSpec: '85 Nm (Torx M10 Grade-5 Titanium)',
    composition: 'High-Modulus Dry Carbon MonoCage / 6061-T6 Billet',
    failureRate: '< 1 PPM (FIA Structural Safety)',
    keyMetricLabel: 'Downforce @ 250km/h',
    keyMetricValue: '660 kg Aero Package',
    massWeight: '90.0 kg MonoCage Dry',
    sdg9: 'MonoCage carbon chassis eliminates external steel roll bars, cutting curb weight to 1,440 kg for maximum track efficiency.',
    sdg12: 'Zero-waste vacuum-assisted resin transfer molding (VARTM) with closed-loop dry carbon fiber recovery.',
    pinCoord: [0.0, 0.52, 0.45],
    explosionVector: [0, 0.45, 0],
    camTarget: [0.0, 0.45, 0.3],
    camPos: [3.0, 1.3, 2.6]
  },
  {
    id: 'BOM-01',
    parentId: null,
    name: '800V Hybrid Battery Module & Glycol Cooling System',
    meshKey: 'Structural_Battery_Floor_Nitro',
    level: 1,
    category: 'Hybrid Energy Storage',
    material: 'High-Power Cylindrical Li-Ion / Dielectric Glycol Loop',
    purity: 'FIA Formula 1 Hybrid ERS Spec',
    bin: 'Zone-B | ESD-Vault-01 | Pack Rack-08',
    rfid: 'RFID-4410-B8',
    rfidStatus: 'ACTIVE_ONLINE',
    supplier: 'McLaren Applied Technologies & Cosworth',
    leadTimeDays: 21,
    stock: 14,
    reorderLevel: 25,
    status: 'critical',
    qcHold: false,
    unitCost: '$68,000',
    voltage: '800V DC Nominal (920V Peak)',
    thermalTolerance: '-20°C to +65°C (Dielectric Loop)',
    torqueSpec: '45 Nm (Busbar M6 Silver-Plated Cu)',
    composition: 'High-Rate Li-Ion / Aluminum Cold Plates',
    failureRate: '< 2 PPM (Automotive ASIL-D Safe)',
    keyMetricLabel: 'E-Motor Output',
    keyMetricValue: '200 PS (147 kW) Instant Boost',
    massWeight: '96.0 kg Pack Module',
    sdg9: 'Direct cell-to-chassis structural packaging delivers instant electric torque fill across gear shifts with zero lag.',
    sdg12: 'Digital battery passport compliance with non-conflict cobalt/nickel certification.',
    pinCoord: [0.0, 0.25, -1.15],
    explosionVector: [0, -0.55, 0],
    camTarget: [0.0, 0.20, -1.0],
    camPos: [2.2, 0.5, -2.2]
  },
  {
    id: 'BOM-01-A',
    parentId: 'BOM-01',
    name: 'High-Rate Cylindrical F1 Hybrid Cell Matrix',
    meshKey: 'Cell_Array_21700',
    level: 2,
    category: 'Electro-Chemical Core',
    material: 'High-Current Nickel-Manganese-Cobalt (NMC)',
    purity: 'Formula-1 KERS Grade Chemistry',
    bin: 'Zone-B | Rack-15 | Bin-02C',
    rfid: 'RFID-4411-B2',
    rfidStatus: 'ACTIVE_ONLINE',
    supplier: 'McLaren Applied Technologies',
    leadTimeDays: 28,
    stock: 18,
    reorderLevel: 30,
    status: 'warning',
    qcHold: false,
    unitCost: '$18,400',
    voltage: '3.7V Nominal (4.2V Peak)',
    thermalTolerance: '-15°C to +60°C (Micro-channel)',
    torqueSpec: '9.5 Nm (Laser Ultrasonic Welds)',
    composition: 'NMC Chem / Laser-Fused Copper Tabs',
    failureRate: '< 1 PPM (Cell Qualification)',
    keyMetricLabel: 'Discharge Rate',
    keyMetricValue: '50C Instantaneous C-Rate',
    massWeight: '68.0 kg Cell Sub-Assembly',
    sdg9: 'Modular cell matrix design allowing automated swapping of sub-modules during rapid factory testing without whole-pack scrapping.',
    sdg12: 'Complies with EU Battery Passport mandate; barcode traces extraction to certified sustainable refineries.',
    pinCoord: [0.0, 0.25, -1.15],
    explosionVector: [0, -0.70, 0],
    camTarget: [0.0, 0.20, -1.0],
    camPos: [2.0, 0.4, -2.0]
  },
  {
    id: 'BOM-02',
    parentId: null,
    name: '3.8L Twin-Turbo V8 Engine, Inconel Exhaust & Active GT Wing',
    meshKey: 'Rear_GT_Wing_Diffuser_Exhaust',
    level: 1,
    category: 'Twin-Turbo ICE & Active Aero',
    material: 'Inconel 625 Alloy / Titanium Dual Exhaust / Prepreg Carbon',
    purity: 'McLaren M838TQ Twin-Turbo Spec',
    bin: 'Zone-C | Dyno-Bay-04 | Cradle-11',
    rfid: 'RFID-8819-C4',
    rfidStatus: 'ACTIVE_ONLINE',
    supplier: 'Ricardo Engines & McLaren Racing MSO',
    leadTimeDays: 14,
    stock: 64,
    reorderLevel: 40,
    status: 'healthy',
    qcHold: false,
    unitCost: '$125,000',
    voltage: '12V CAN-Bus / 48V Active DRS Actuator',
    thermalTolerance: '-30°C to +1,050°C (Inconel Exhaust Gas)',
    torqueSpec: '160 Nm (Flange M12 12.9 High-Tensile)',
    composition: 'AlSi7Mg Flat-Plane V8 / Inconel 625 / Titanium',
    failureRate: '< 1 PPM (Zero-Defect ISO 26262)',
    keyMetricLabel: 'Combined System Power',
    keyMetricValue: '1,000 PS (986 BHP) @ 8,500 RPM',
    massWeight: '195.0 kg Engine & Exhaust',
    sdg9: 'Inconel-titanium straight-exit exhaust reduces backpressure by 28% and sheds 10.5 kg compared to road-car muffler systems.',
    sdg12: 'Precision CNC-machined aerospace alloy billet blocks with 99.8% chip recycling circularity.',
    pinCoord: [0.0, 0.66, -1.28],
    explosionVector: [0, 0.55, -0.95],
    camTarget: [0.0, 0.55, -1.1],
    camPos: [2.2, 1.4, -2.8]
  },
  {
    id: 'BOM-03',
    parentId: null,
    name: 'Torque-Vectoring Wheels, Slick Tires & Akebono Calipers',
    meshKey: 'Torque_Vectoring_Wheels_Brembo',
    level: 1,
    category: 'Chassis Dynamics & High-G Braking',
    material: 'Carbon-Silicon Carbide (C/SiC) / Forged Monobloc Aluminum',
    purity: 'Akebono Motorsport Spec',
    bin: 'Zone-C | Wheel-Bay-02 | Rack-03',
    rfid: 'RFID-3301-C5',
    rfidStatus: 'ACTIVE_ONLINE',
    supplier: 'Akebono Brake Industry & Pirelli Motorsport',
    leadTimeDays: 12,
    stock: 51,
    reorderLevel: 35,
    status: 'healthy',
    qcHold: false,
    unitCost: '$28,500',
    voltage: '48V Active Vectoring & ABS Sensors',
    thermalTolerance: '-40°C to +1,000°C (C/SiC Track Braking)',
    torqueSpec: '650 Nm (Center-Lock Titanium Wheel Nut)',
    composition: 'C/SiC Matrix Rotors / Monobloc 6-Piston Calipers',
    failureRate: '< 1 PPM (Braking Safety Critical)',
    keyMetricLabel: 'Braking Deceleration',
    keyMetricValue: '2.4G Peak (100-0 km/h in 28m)',
    massWeight: '21.5 kg / Wheel Corner Unit',
    sdg9: 'F1-derived brake-steer software manages turn-in yaw by braking inner rear wheel, eliminating heavy mechanical limited-slip diffs.',
    sdg12: 'Zero copper brake compound compliance exceeding Euro-7 particulate standards.',
    pinCoord: [0.65, 0.28, 0.95],
    explosionVector: [0, -0.25, 0.55],
    camTarget: [0.65, 0.28, 0.95],
    camPos: [2.2, 0.5, 2.0]
  },
  {
    id: 'BOM-04',
    parentId: null,
    name: 'Cockpit Tub, F1 Steering Yoke & Cosworth Telemetry',
    meshKey: 'Cockpit_Tub_Internal_Telemetry',
    level: 1,
    category: 'Cockpit & Digital Telemetry',
    material: 'Full Dry Carbon Safety Cell / Alcantara / CAN-FD Bus',
    purity: 'FIA Safety Cell Standard / Mil-Spec Avionics',
    bin: 'Zone-D | Cockpit-Jig-01 | Bin-09',
    rfid: 'RFID-1092-D9',
    rfidStatus: 'ACTIVE_ONLINE',
    supplier: 'Cosworth Electronics & McLaren Special Operations',
    leadTimeDays: 32,
    stock: 9,
    reorderLevel: 20,
    status: 'critical',
    qcHold: false,
    unitCost: '$45,000',
    voltage: '12V Logic / Isolated High-Speed CAN-FD',
    thermalTolerance: '-40°C to +85°C (Cockpit Avionics)',
    torqueSpec: '24 Nm (Steering Column Spline Titanium)',
    composition: 'T1000G Monocell / Mil-Spec Wire Harness',
    failureRate: '< 1 PPM (Mil-Spec ASIL-D)',
    keyMetricLabel: 'Telemetry Refresh Rate',
    keyMetricValue: '1,000 Hz Sub-Millisecond Logging',
    massWeight: '18.2 kg Seat & Electronics Core',
    sdg9: 'F1 MP4-23 inspired steering wheel with integrated DRS and IPAS push-to-pass buttons directly communicating via high-bandwidth CAN-FD.',
    sdg12: 'Conflict-free gold and tantalum traceability audit under Responsible Minerals Initiative (RMI).',
    pinCoord: [0.0, 0.48, 0.15],
    explosionVector: [0, 0.30, 0],
    camTarget: [0.0, 0.48, 0.15],
    camPos: [1.2, 1.0, 1.0]
  },
  {
    id: 'BOM-05',
    parentId: null,
    name: 'LED Track Optics Array, Polycarbonate Canopy & Aero Mirrors',
    meshKey: 'LED_Headlights_Canopy_Mirrors',
    level: 1,
    category: 'Optics, Aero Glass & Visibility',
    material: 'Motorsport Polycarbonate / Lightweight LED Modules',
    purity: 'Optical Precision Grade IV',
    bin: 'Zone-D | Clean-Room-01 | Bin-01A',
    rfid: 'RFID-7712-D1',
    rfidStatus: 'ACTIVE_ONLINE',
    supplier: 'Hella Motorsport & Pilkington Racing',
    leadTimeDays: 25,
    stock: 19,
    reorderLevel: 25,
    status: 'warning',
    qcHold: false,
    unitCost: '$16,500',
    voltage: '12V Automotive Regulated LED Bus',
    thermalTolerance: '-40°C to +95°C (Optics Housing)',
    torqueSpec: '6.5 Nm (Anti-Vibration M5 Fasteners)',
    composition: 'Curved Chemically-Toughened Polycarbonate / High-Flux LED',
    failureRate: '< 2 PPM (Vision Safety Level)',
    keyMetricLabel: 'Luminous Intensity',
    keyMetricValue: '220,000 Candela High-Beam Apex Focus',
    massWeight: '5.2 kg Windshield & Mirror Assembly',
    sdg9: 'Motorsport-grade hard-coated polycarbonate canopy reduces greenhouse mass by 35% compared to laminated road glass while resisting track stone impacts at 300+ km/h.',
    sdg12: 'Teardrop aerodynamic mirror stalks reduce boundary-layer turbulence and coefficient of drag (Cd).',
    pinCoord: [0.0, 0.62, 0.65],
    explosionVector: [0, 0.65, 0.65],
    camTarget: [0.0, 0.55, 0.65],
    camPos: [1.8, 1.2, 2.2]
  }
];

// ============================================================================
// 4. CAMERA CONTROLLER RIG (SMOOTH LERP & DECELERATION CAMERA SHAKE)
// ============================================================================
function CameraRig({ selectedPart, cameraPreset, shakeIntensity = 0 }) {
  const { camera, controls } = useThree();
  const defaultPos = cameraPreset?.pos || [4.2, 2.0, 4.0];
  const defaultTarget = cameraPreset?.target || [0, 0.05, 0];
  const targetPosRef = useRef(new THREE.Vector3(...defaultPos));
  const lookAtRef = useRef(new THREE.Vector3(...defaultTarget));
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef(0);

  useEffect(() => {
    if (selectedPart) {
      targetPosRef.current.set(...selectedPart.camPos);
      lookAtRef.current.set(...selectedPart.camTarget);
    } else {
      targetPosRef.current.set(...defaultPos);
      lookAtRef.current.set(...defaultTarget);
    }
    isTransitioningRef.current = true;
    transitionTimerRef.current = 1.5;
  }, [selectedPart, cameraPreset]);

  // When user begins dragging or orbiting manually, surrender programmatic position lerping
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      isTransitioningRef.current = false;
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controls]);

  useFrame((_, delta) => {
    // Dynamic camera noise shake on hard deceleration or throttle rev
    if (shakeIntensity > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeIntensity * 0.15;
      camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.15;
    }

    if (isTransitioningRef.current) {
      transitionTimerRef.current -= delta;
      camera.position.lerp(targetPosRef.current, delta * 3.5);
      if (controls) {
        controls.target.lerp(lookAtRef.current, delta * 3.8);
      } else {
        camera.lookAt(lookAtRef.current);
      }

      // Hand over full continuous 360 rotation to OrbitControls once arrival is within close threshold
      if (!selectedPart && (transitionTimerRef.current <= 0 || camera.position.distanceTo(targetPosRef.current) < 0.08)) {
        isTransitioningRef.current = false;
      }
    }
  });

  return null;
}

// ============================================================================
// 5. AIR.INC FLUID 3D GLASS RIBBON (HERO INTRO MESH & TRANSMISSION SHADER)
// ============================================================================
function FluidGlassRibbon({ introProgress }) {
  const meshRef = useRef();

  // Procedural smooth Catmull-Rom 3D bezier glass swirl across upper screen
  const { geometry } = useMemo(() => {
    const points = [
      new THREE.Vector3(-3.8, 2.2, -2.5),
      new THREE.Vector3(-2.2, 2.9, -1.2),
      new THREE.Vector3(-0.8, 1.7, 0.2),
      new THREE.Vector3(0.9, 2.7, 0.8),
      new THREE.Vector3(2.4, 1.8, -0.6),
      new THREE.Vector3(3.8, 2.4, -2.2)
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    const geom = new THREE.TubeGeometry(curve, 96, 0.075, 16, false);
    return { geometry: geom };
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const t = state.clock.getElapsedTime();
      meshRef.current.rotation.y = Math.sin(t * 0.4) * 0.12;
      meshRef.current.rotation.z = Math.cos(t * 0.3) * 0.05;
      meshRef.current.position.y = Math.sin(t * 0.8) * 0.06;

      // Hide ribbon once intro settles into showroom to prevent obscuring car and reflections
      if (introProgress > 0.5) {
        meshRef.current.visible = false;
      } else {
        meshRef.current.visible = true;
      }
    }
  });

  return (
    <group ref={meshRef}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          transmission={0.98}
          roughness={0.05}
          ior={1.52}
          thickness={1.2}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          transparent={true}
          opacity={1.0}
          color="#dbeafe"
          attenuationColor="#60a5fa"
          attenuationDistance={1.8}
        />
      </mesh>
    </group>
  );
}

// ============================================================================
// 6. EXHAUST BACKFIRE & DUAL FLAME BURST PARTICLE EMITTERS
// ============================================================================
function ExhaustBackfireEmitter({ isFiring, isDecelerating }) {
  const flamesRef = useRef();
  const sparksCount = 90;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(sparksCount * 3);
    const col = new Float32Array(sparksCount * 3);

    for (let i = 0; i < sparksCount; i++) {
      // Dual exhaust pipes on McLaren P1 GTR: centered left (-0.12) and right (+0.12)
      const isLeft = i % 2 === 0;
      const baseX = isLeft ? -0.12 : 0.12;

      pos[i * 3] = baseX + (Math.random() - 0.5) * 0.06;
      pos[i * 3 + 1] = 0.38 + (Math.random() - 0.5) * 0.06;
      pos[i * 3 + 2] = -1.35 - Math.random() * 0.35;

      // Electric cyan, fiery orange, molten white flame mixture
      if (i % 3 === 0) {
        col[i * 3] = 0.0; col[i * 3 + 1] = 0.94; col[i * 3 + 2] = 1.0; // #00F0FF Cyan
      } else if (i % 3 === 1) {
        col[i * 3] = 1.0; col[i * 3 + 1] = 0.28; col[i * 3 + 2] = 0.0; // #FF4500 Orange
      } else {
        col[i * 3] = 1.0; col[i * 3 + 1] = 0.95; col[i * 3 + 2] = 0.8; // Hot white
      }
    }
    return [pos, col];
  }, []);

  useFrame((_, delta) => {
    if (!flamesRef.current) return;
    const posAttr = flamesRef.current.geometry.attributes.position;
    const array = posAttr.array;

    for (let i = 0; i < sparksCount; i++) {
      const isLeft = i % 2 === 0;
      const baseX = isLeft ? -0.12 : 0.12;

      if (isFiring || isDecelerating) {
        // High-velocity exhaust gas expulsion backward (-Z)
        array[i * 3 + 2] -= delta * (8.0 + Math.random() * 10.0);
        array[i * 3] += (Math.random() - 0.5) * delta * 1.5;
        array[i * 3 + 1] += (Math.random() - 0.2) * delta * 1.2;

        if (array[i * 3 + 2] < -3.2) {
          array[i * 3] = baseX + (Math.random() - 0.5) * 0.06;
          array[i * 3 + 1] = 0.38 + (Math.random() - 0.5) * 0.06;
          array[i * 3 + 2] = -1.35;
        }
      } else {
        // Disperse when idling
        array[i * 3 + 2] = -1.35;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (!isFiring && !isDecelerating) return null;

  return (
    <points ref={flamesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={sparksCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={sparksCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.065}
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ============================================================================
// 7. HIGH-FIDELITY LOCAL GLB CAR ENGINE (MCLAREN P1 GTR) WITH X-RAY & CAD EXPLOSION
// ============================================================================
function CustomCarGLTF({
  isExploded,
  selectedPartId,
  bomList,
  onSelectPart,
  isTelemetryActive,
  onIntroSettle,
  onCameraShake,
  isIntroPlaying = false,
  revTrigger = 0
}) {
  const { scene } = useGLTF(MODEL_URL);
  const groupRef = useRef();
  const [isFiring, setIsFiring] = useState(false);
  const [isDecelerating, setIsDecelerating] = useState(false);

  // High-voltage Rev Accelerator Trigger
  useEffect(() => {
    if (revTrigger > 0) {
      audio.init();
      audio.playAccelerationSequence();
      setIsFiring(true);
      if (onCameraShake) onCameraShake(1.5);
      const timer = setTimeout(() => {
        setIsFiring(false);
        if (onCameraShake) onCameraShake(0);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [revTrigger]);

  const clonedScene = useMemo(() => {
    try {
      const cloned = scene.clone(true);
      cloned.visible = true;

      cloned.traverse((child) => {
        if (child === cloned) return;

        // 1. Purge rogue Blender lights embedded in the GLB
        if (child.isLight) {
          child.intensity = 0;
          child.visible = false;
          return;
        }

        if (child.isMesh) {
          const rawName = child.name || '';
          const parentName = child.parent?.name || '';
          const rawMatName = (Array.isArray(child.material) ? child.material[0]?.name : child.material?.name) || '';
          
          // Use exact McLaren classifier
          const classification = classifyMclarenNode(rawName, rawMatName, parentName);

          child.visible = true;
          child.castShadow = true;
          child.receiveShadow = true;

          // Store classification metadata for explosion and BOM selection
          child.userData.bomId = classification.bomId;
          child.userData.explodeVec = new THREE.Vector3(...classification.explodeOffset);
          child.userData.pinCoord = classification.pinCoord;
          child.userData.originPos = child.position.clone();

          if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => m.clone());
            child.userData.originalOpacity = child.material[0]?.opacity ?? 1.0;
          } else if (child.material) {
            child.material = child.material.clone();
            child.userData.originalOpacity = child.material.opacity ?? 1.0;
          }

          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (!mat) return;
            const currentMatName = (mat.name || '').toLowerCase();

            // Native PBR Material Tuning for McLaren P1 GTR (preserving embedded 2K/4K textures)
            if (currentMatName === 'main_body') {
              mat.roughness = 0.16;
              mat.metalness = 0.35;
              if ('clearcoat' in mat) {
                mat.clearcoat = 1.0;
                mat.clearcoatRoughness = 0.05;
              }
            } else if (currentMatName === 'carbon') {
              mat.roughness = 0.26;
              mat.metalness = 0.30;
              if ('clearcoat' in mat) {
                mat.clearcoat = 0.85;
                mat.clearcoatRoughness = 0.06;
              }
            } else if (currentMatName === 'rims') {
              mat.roughness = 0.20;
              mat.metalness = 0.88;
            } else if (currentMatName === 'tires') {
              mat.roughness = 0.82;
              mat.metalness = 0.05;
            } else if (currentMatName === 'disk' || currentMatName === 'disk_circles') {
              mat.roughness = 0.30;
              mat.metalness = 0.95;
            } else if (currentMatName === 'brake') {
              mat.roughness = 0.22;
              mat.metalness = 0.65;
            } else if (currentMatName === 'windshieldwindows' || currentMatName === 'headlight_glass' || currentMatName === 'tail_light_glass') {
              mat.transparent = true;
              mat.depthWrite = false;
              mat.roughness = 0.04;
              mat.metalness = 0.1;
              if (currentMatName === 'windshieldwindows') {
                mat.opacity = 0.45;
                child.userData.originalOpacity = 0.45;
              } else if (currentMatName === 'headlight_glass') {
                mat.opacity = 0.35;
                child.userData.originalOpacity = 0.35;
              } else {
                mat.opacity = 0.50;
                child.userData.originalOpacity = 0.50;
              }
            } else if (currentMatName.includes('headlight_light') || currentMatName.includes('headlight_inside_strips')) {
              mat.emissive = new THREE.Color('#ffffff');
              mat.emissiveIntensity = 4.0;
              mat.toneMapped = false;
            } else if (currentMatName.startsWith('tail_light_light')) {
              mat.emissive = new THREE.Color('#ff2200');
              mat.emissiveIntensity = 3.5;
              mat.toneMapped = false;
            } else if (currentMatName === 'wing') {
              mat.roughness = 0.22;
              mat.metalness = 0.45;
              if ('clearcoat' in mat) {
                mat.clearcoat = 0.9;
                mat.clearcoatRoughness = 0.05;
              }
            } else if (currentMatName === 'interior') {
              mat.roughness = 0.70;
              mat.metalness = 0.15;
            }

            mat.needsUpdate = true;
          });
        }
      });

      return cloned;
    } catch (err) {
      console.warn('Fallback mapper triggered in CustomCarGLTF:', err);
      return scene;
    }
  }, [scene]);

  useFrame((state, delta) => {
    // Car stays immediately and rock-solid grounded at origin (zero entering lag, zero bouncing)
    if (groupRef.current) {
      groupRef.current.position.set(0, 0, 0);
      groupRef.current.rotation.set(0, 0, 0);
    }

    try {
      clonedScene.traverse((child) => {
        if (child.isMesh && child.material && child.userData.originPos) {
          const bomId = child.userData.bomId;
          const part = bomList.find((p) => p.id === bomId);

          // Smooth CAD Explosive Disassembly Lerp with 1.5x designated vector offset
          const explodeOffset = (isExploded && child.userData.explodeVec)
            ? child.userData.explodeVec.clone().multiplyScalar(1.5)
            : new THREE.Vector3(0, 0, 0);
          const targetPos = child.userData.originPos.clone().add(explodeOffset);
          child.position.lerp(targetPos, delta * 4.5);

          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (!mat) return;
            const matName = (mat.name || '').toLowerCase();
            const isGlass = matName.includes('glass') || matName.includes('windshield');

            if (selectedPartId) {
              const isMatchingSelected =
                bomId === selectedPartId ||
                (selectedPartId === 'BOM-01-A' && bomId === 'BOM-01') ||
                (selectedPartId === 'BOM-01' && bomId === 'BOM-01');

              if (isMatchingSelected) {
                // Keep selected assembly at full opacity (1.0) with an intense cyan inspection glow
                mat.transparent = isGlass;
                mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1.0, delta * 8.0);
                mat.emissive = new THREE.Color('#00F0FF');
                mat.emissiveIntensity = 0.35;
              } else {
                // 80% X-Ray Ghosting: lerp all other assemblies to opacity 0.20
                mat.transparent = true;
                mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.20, delta * 8.0);
                mat.emissive = new THREE.Color('#000000');
                mat.emissiveIntensity = 0;
              }
            } else if (isExploded) {
              // In exploded mode: 80% X-Ray transparency (opacity: 0.20) on unselected outer body/canopy
              // so internal structural components (BOM-01 battery floor and BOM-04 cockpit tub) are fully revealed
              const isOuterShell = bomId === 'BOM-00' || bomId === 'BOM-05';
              if (isOuterShell) {
                mat.transparent = true;
                mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.20, delta * 8.0);
              } else {
                mat.transparent = isGlass;
                mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1.0, delta * 8.0);
              }
              mat.emissive = new THREE.Color('#000000');
              mat.emissiveIntensity = 0;
            } else {
              // Assembled mode without selection: restore all parts to authentic opacity and lighting
              const origOpacity = (typeof child.userData.originalOpacity === 'number')
                ? child.userData.originalOpacity
                : (isGlass ? 0.45 : 1.0);

              mat.opacity = THREE.MathUtils.lerp(mat.opacity, origOpacity, delta * 8.0);
              mat.transparent = isGlass ? true : (mat.opacity < 0.99);

              if (part?.qcHold) {
                mat.emissive = new THREE.Color('#f43f5e');
                mat.emissiveIntensity = 0.5 + Math.sin(state.clock.getElapsedTime() * 6) * 0.2;
              } else if (matName.includes('headlight_light') || matName.includes('headlight_inside_strips')) {
                mat.emissive = new THREE.Color('#ffffff');
                mat.emissiveIntensity = 4.0;
                mat.toneMapped = false;
              } else if (matName.startsWith('tail_light_light')) {
                mat.emissive = new THREE.Color('#ff2200');
                mat.emissiveIntensity = 3.5;
                mat.toneMapped = false;
              } else {
                mat.emissive = new THREE.Color('#000000');
                mat.emissiveIntensity = 0;
              }
            }
          });
        }
      });
    } catch {
      // Safety trap
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        let mesh = e.object;
        // If clicked through transparent glass/window, check if interior component hit
        const isGlass = mesh?.name?.toLowerCase().includes('glass') || mesh?.name?.toLowerCase().includes('window');
        if (isGlass && e.intersections && e.intersections.length > 1) {
          const interiorHit = e.intersections.find((hit) => hit.object?.userData?.bomId === 'BOM-04');
          if (interiorHit) mesh = interiorHit.object;
        }
        while (mesh && !mesh.userData.bomId && mesh.parent && mesh !== clonedScene) {
          mesh = mesh.parent;
        }
        if (mesh && mesh.userData.bomId) {
          audio.playClickSound();
          onSelectPart(mesh.userData.bomId);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {/* McLaren P1 GTR Assembly: Centered at (0, 0.1082, 0) to touch cement floor perfectly */}
      <primitive object={clonedScene} position={[0, 0.1082, 0]} scale={1.0} />

      {/* Dual Exhaust Flame & Spark Emitters */}
      <ExhaustBackfireEmitter isFiring={isFiring} isDecelerating={isDecelerating} />

      {/* McLaren Dual LED Headlight Forward Projector Beams */}
      <pointLight position={[-0.45, 0.42, 1.45]} intensity={2.8} color="#f8fafc" distance={6} />
      <pointLight position={[0.45, 0.42, 1.45]} intensity={2.8} color="#f8fafc" distance={6} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);

// ============================================================================
// 8. PROCEDURAL SUPERCAR RIG (FAILSAFE OFFLINE BACKUP ENGINE)
// ============================================================================
function ProceduralSupercarRig({ isExploded, selectedPartId, bomList, onSelectPart, carColor = '#ea580c' }) {
  const group = useRef();

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.children.forEach((child) => {
      const part = bomList.find((p) => p.id === child.userData.bomId);
      if (part && child.userData.originPos) {
        const offset = isExploded ? new THREE.Vector3(...part.explosionVector) : new THREE.Vector3(0, 0, 0);
        child.position.lerp(child.userData.originPos.clone().add(offset), delta * 4);
      }
    });
  });

  return (
    <group ref={group} position={[0, -0.1, 0]}>
      {/* Monocoque Body */}
      <mesh userData={{ bomId: 'BOM-00', originPos: new THREE.Vector3(0, 0.45, 0) }} position={[0, 0.45, 0]}>
        <boxGeometry args={[1.9, 0.5, 4.2]} />
        <meshPhysicalMaterial color={carColor} metalness={0.88} roughness={0.15} clearcoat={1.0} />
      </mesh>
      {/* Canopy Glass */}
      <mesh userData={{ bomId: 'BOM-05', originPos: new THREE.Vector3(0, 0.9, -0.2) }} position={[0, 0.9, -0.2]}>
        <boxGeometry args={[1.4, 0.45, 1.8]} />
        <meshPhysicalMaterial color="#0f172a" transmission={0.92} roughness={0.05} ior={1.5} transparent />
      </mesh>
      {/* Battery Pack Underbody */}
      <mesh userData={{ bomId: 'BOM-01', originPos: new THREE.Vector3(0, 0.1, 0) }} position={[0, 0.1, 0]}>
        <boxGeometry args={[1.7, 0.2, 3.2]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 4 Corners Wheels */}
      {[[-0.95, 0.25, 1.3], [0.95, 0.25, 1.3], [-0.95, 0.25, -1.3], [0.95, 0.25, -1.3]].map((pos, idx) => (
        <mesh key={idx} userData={{ bomId: 'BOM-03', originPos: new THREE.Vector3(...pos) }} position={pos} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.38, 0.38, 0.28, 24]} />
          <meshStandardMaterial color="#0f172a" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// 9. 3D UNDERGROUND GARAGE ENVIRONMENT (REAL PBR WORKSHOP & CONCRETE TEXTURES)
// ============================================================================
function GarageEnvironment() {
  const { scene } = useGLTF(GARAGE_URL);

  // Authentic 4K PBR Textures extracted directly from the user's Blender workshop scene
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const load = (path, repeatX = 1, repeatY = 1) => {
      try {
        const tex = loader.load(path);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      } catch {
        return null;
      }
    };

    return {
      // 1. Authentic industrial screed cement floor slabs
      floor: load('/textures/ConcreteFloorsDamaged0041.jpg', 8, 4),
      // 2. Exact architectural concrete wall panels with tie-holes from \resouces\walls\TexturesCom_ConcreteBare0451
      wall: load('/textures/ConcreteBare0451.jpg', 8, 2),
      // 3. High-fidelity Multiply decals with edge-vignetted pure white borders (zero box cutouts)
      decalScribbles: load('/textures/decal_scribbles.jpg'),
      decalScribble1: load('/textures/decal_scribble1.jpg'),
      decalScribble2: load('/textures/decal_scribble2.jpg'),
      decalScribble3: load('/textures/decal_scribble3.jpg'),
    };
  }, []);

  const clonedGarage = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((child) => {
      // Deactivate any rogue raw Blender lights inside the garage asset
      if (child.isLight) {
        child.intensity = 0;
        child.visible = false;
        return;
      }

      if (child.isMesh) {
        const rawName = child.name || '';
        const rawMatName = (Array.isArray(child.material) ? child.material[0]?.name : child.material?.name) || '';
        const classification = classifyGlbNode(rawName, rawMatName);

        // Hide duplicate car meshes embedded in the garage scene (rendered with full PBR by CustomCarGLTF)
        if (classification.type === 'CAR') {
          child.visible = false;
          return;
        }

        const name = rawName.toLowerCase();
        const parentName = (child.parent?.name || '').toLowerCase();
        const matName = rawMatName.toLowerCase();
        const fullName = `${name} ${parentName} ${matName}`;

        // ---------------------------------------------------------------------
        // AUTHENTIC OVERLAID GRAFFITI DECALS (SEAMLESS MULTIPLY BLENDING)
        // Eliminates all white paper polygons and paints tags directly on concrete
        // ---------------------------------------------------------------------
        if (name.includes('scribble') || fullName.includes('scribble')) {
          child.visible = true;
          child.receiveShadow = false;
          child.castShadow = false;
          child.renderOrder = 3; // Render strictly after the concrete walls

          let decalTex = textures.decalScribbles;
          if (name.includes('scribble1')) {
            decalTex = textures.decalScribble1;
          } else if (name.includes('scribble2')) {
            decalTex = textures.decalScribble2;
          } else if (name.includes('scribble3')) {
            decalTex = textures.decalScribble3;
          }

          child.material = new THREE.MeshBasicMaterial({
            map: decalTex,
            blending: THREE.MultiplyBlending,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3,
          });
          return;
        }

        child.visible = true;
        child.receiveShadow = true;
        child.castShadow = false; // Prevent garage walls and ceiling from blocking interior lights
        child.renderOrder = 0;

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (!m) return;
          const currentMatName = (m.name || '').toLowerCase();

          // 1. Overhead fluorescent tube light fixtures: crisp white glow
          if (
            name.includes('bottom light') ||
            name.includes('cube.002') ||
            name.includes('cube.014') ||
            currentMatName === 'material.001' ||
            matName === 'material.001'
          ) {
            m.emissive = new THREE.Color('#ffffff');
            m.emissiveIntensity = 4.0;
            m.toneMapped = false;
            m.needsUpdate = true;
          }
          // 2. Square incandescent wall sconce on right wall: warm amber beacon
          else if (currentMatName === 'blinking light' || matName === 'blinking light' || name.includes('blinking light')) {
            m.emissive = new THREE.Color('#fbbf24');
            m.emissiveIntensity = 4.5;
            m.toneMapped = false;
            m.needsUpdate = true;
          }
          // 3. Authentic industrial concrete floor (matte screed finish, non-shiny)
          else if (
            currentMatName.includes('road') ||
            matName.includes('road') ||
            name.includes('road') ||
            name.includes('plane.016') ||
            fullName.includes('wet road')
          ) {
            if (textures.floor) {
              textures.floor.repeat.set(8, 4);
              m.map = textures.floor;
            }
            m.color = new THREE.Color('#525c68'); // Industrial concrete slab grey
            m.roughness = 0.82; // High roughness for authentic matte concrete (zero shiny mirror reflection)
            m.metalness = 0.02; // Pure non-metallic dielectric concrete
            m.needsUpdate = true;
          }
          // 4. Garage Columns / Pillars: Authentic two-tone painted finish matching reference
          else if (name.startsWith('cylinder.01') || name.startsWith('cylinder.02')) {
            if (currentMatName.includes('concrete.006')) {
              // Top half of pillar: architectural bare concrete
              if (textures.wall) m.map = textures.wall;
              m.color = new THREE.Color('#cbd5e1');
              m.roughness = 0.65;
              m.metalness = 0.05;
            } else {
              // Bottom half of pillar: authentic industrial sage-green wainscot paint
              if (textures.wall) m.map = textures.wall;
              m.color = new THREE.Color('#7a8e77'); // Exact sage/olive green garage pillar paint
              m.roughness = 0.40; // Commercial enamel semi-gloss paint
              m.metalness = 0.05;
            }
            m.needsUpdate = true;
          }
          // 5. Exact concrete architectural walls and structural framework
          else if (
            name === 'cube' ||
            currentMatName === 'material.014' ||
            matName === 'material.014' ||
            currentMatName.includes('concrete') ||
            matName.includes('concrete') ||
            currentMatName.includes('material.016') ||
            matName.includes('material.016') ||
            name.includes('plane.001') ||
            name.includes('plane.007') ||
            name.includes('plane.003') ||
            name.includes('plane.010')
          ) {
            if (textures.wall) {
              m.map = textures.wall;
            }
            m.color = new THREE.Color('#94a3b8'); // Formwork bare concrete with tie-holes
            m.roughness = 0.68;
            m.metalness = 0.05;
            m.needsUpdate = true;
          }
          // 6. Metal structural frames, ladders, ceiling conduits, and pipes
          else if (currentMatName.includes('ladder') || matName.includes('ladder') || currentMatName.includes('wire') || matName.includes('wire') || currentMatName.includes('metal') || matName.includes('metal') || currentMatName.includes('pipe') || matName.includes('pipe')) {
            m.roughness = 0.35;
            m.metalness = 0.85;
            m.needsUpdate = true;
          } else {
            m.roughness = Math.min(Math.max(m.roughness ?? 0.5, 0.3), 0.75);
            m.metalness = Math.min(m.metalness ?? 0.3, 0.65);
            m.needsUpdate = true;
          }
        });
      }
    });
    return cloned;
  }, [scene, textures]);

  return (
    <group position={[0, 0, 0]} scale={1.0}>
      <primitive object={clonedGarage} position={[-3.668, 0.007, 13.897]} />
    </group>
  );
}

useGLTF.preload(GARAGE_URL);

// ============================================================================
// 9.5 UNIFIED DYNAMIC STATUS & INDICATION HELPERS
// ============================================================================
export function getPartStatus(part) {
  if (!part) return 'healthy';
  if (part.qcHold) return 'critical';
  const stock = typeof part.stock === 'number' ? part.stock : 0;
  const reorder = part.reorderLevel || 30;
  // Critical if stock is critically depleted (<= 55% of reorder level or <= 10 units)
  if (stock <= Math.round(reorder * 0.55) || stock <= 10) return 'critical';
  // Warning if stock is at or below reorder level
  if (stock <= reorder) return 'warning';
  // Healthy otherwise
  return 'healthy';
}

export function getStatusColor(status, qcHold = false) {
  if (qcHold) return '#FF0055';
  if (status === 'critical') return '#FF0055';
  if (status === 'warning') return '#FFB703';
  return '#00F59B';
}

export function getStatusBgClass(status, qcHold = false) {
  if (qcHold) return 'bg-[#FF0055]';
  if (status === 'critical') return 'bg-[#FF0055]';
  if (status === 'warning') return 'bg-[#FFB703]';
  return 'bg-[#00F59B]';
}

// ============================================================================
// 10. COMPLETE 3D SCENE CONTAINER WITH GARAGE, BATCAVE LIGHTING & LEADER LINES
// ============================================================================
function SceneContainer({
  engineMode,
  isExploded,
  selectedPartId,
  bomList,
  onSelectPart,
  isTelemetryActive,
  onIntroSettle,
  introProgress,
  isIntroPlaying = false,
  cameraPreset,
  revTrigger = 0,
  activeFolder
}) {
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const selectedPart = bomList.find((p) => p.id === selectedPartId);
  const controlsRef = useRef();

  // Auto-orbit ONLY in full cinematic Viewport mode; never while navigating BOM Explorer or DBMS
  const isCinematicAutoOrbit = !isIntroPlaying && activeFolder === 'viewport' && !selectedPartId;

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isCinematicAutoOrbit;
      controlsRef.current.autoRotateSpeed = 0.5; // Smooth, slow, majestic automotive showcase sweep
    }
  });

  return (
    <>
      {/* 1. Global Studio Ambient Lighting */}
      <ambientLight intensity={0.5} color="#e2e8f0" />

      {/* 2. Key Light: Warm overhead spotlight with soft penumbra */}
      <spotLight
        position={[0, 10, 4]}
        intensity={3.5}
        penumbra={0.8}
        angle={0.85}
        color="#fffbeb"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />

      {/* 3. Rim / Backlight 1: Electric Blue on the left */}
      <pointLight
        position={[-6, 4, -2]}
        intensity={3.5}
        color="#00F0FF"
        distance={22}
      />

      {/* 4. Rim / Backlight 2: Warm Amber on the right */}
      <pointLight
        position={[6, 4, -2]}
        intensity={3.5}
        color="#F59E0B"
        distance={22}
      />

      {/* 5. Overhead Fluorescent Flood Light & Workshop Sconce */}
      <pointLight position={[0, 6.5, -3.0]} intensity={2.0} color="#f8fafc" distance={16} />
      <pointLight position={[3.25, 3.06, -12.86]} intensity={3.0} color="#fbbf24" distance={9} />

      {/* 6. City Environment Reflection Map for Specular Automotive Highlights */}
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      {/* Synchronized Camera Controller with Brake Shake & Dynamic Perspective Presets */}
      <CameraRig selectedPart={selectedPart} cameraPreset={cameraPreset} shakeIntensity={shakeIntensity} />

      {/* 3D Underground Garage Environment */}
      <Suspense fallback={null}>
        <GarageEnvironment />
      </Suspense>

      {/* Grounded Contact Shadows directly beneath tires on screed cement floor */}
      <ContactShadows
        position={[0, 0.003, 0]}
        opacity={0.85}
        scale={10}
        blur={1.6}
        far={2.5}
        color="#000000"
      />

      <group position={[0, 0, 0]}>
        {engineMode === 'local' ? (
          <Suspense fallback={<ProceduralSupercarRig isExploded={isExploded} selectedPartId={selectedPartId} bomList={bomList} onSelectPart={onSelectPart} />}>
            <CustomCarGLTF
              isExploded={isExploded}
              selectedPartId={selectedPartId}
              bomList={bomList}
              onSelectPart={onSelectPart}
              isTelemetryActive={isTelemetryActive}
              onIntroSettle={onIntroSettle}
              onCameraShake={(val) => setShakeIntensity(val)}
              isIntroPlaying={isIntroPlaying}
              revTrigger={revTrigger}
            />
          </Suspense>
        ) : (
          <ProceduralSupercarRig
            isExploded={isExploded}
            selectedPartId={selectedPartId}
            bomList={bomList}
            onSelectPart={onSelectPart}
          />
        )}

        {/* 3D Pin Callout Indicator Dot & Pulse Ring */}
        {selectedPart && selectedPart.pinCoord && (
          <group position={[
            selectedPart.pinCoord[0] + (isExploded ? (selectedPart.explosionVector ? selectedPart.explosionVector[0] * 1.5 : 0) : 0),
            selectedPart.pinCoord[1] + (isExploded ? (selectedPart.explosionVector ? selectedPart.explosionVector[1] * 1.5 : 0) : 0) + 0.108,
            selectedPart.pinCoord[2] + (isExploded ? (selectedPart.explosionVector ? selectedPart.explosionVector[2] * 1.5 : 0) : 0)
          ]}>
            <mesh>
              <sphereGeometry args={[0.02, 16, 16]} />
              <meshBasicMaterial color="#00F0FF" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.032, 0.046, 24]} />
              <meshBasicMaterial color="#00F0FF" side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>
          </group>
        )}

        {/* 3D Liquid Glass Leader Tag with High-Impact Typography */}
        {selectedPart && (
          <Html
            position={[
              (selectedPart.pinCoord ? selectedPart.pinCoord[0] : selectedPart.camTarget[0]) + (isExploded ? (selectedPart.explosionVector ? selectedPart.explosionVector[0] * 1.5 : 0) : 0),
              (selectedPart.pinCoord ? selectedPart.pinCoord[1] : selectedPart.camTarget[1]) + (isExploded ? (selectedPart.explosionVector ? selectedPart.explosionVector[1] * 1.5 : 0.35) : 0.22) + 0.108,
              (selectedPart.pinCoord ? selectedPart.pinCoord[2] : selectedPart.camTarget[2]) + (isExploded ? (selectedPart.explosionVector ? selectedPart.explosionVector[2] * 1.5 : 0) : 0)
            ]}
            center
            zIndexRange={[5, 0]}
          >
            <div className="px-3.5 py-1.5 rounded-xl liquid-glass border border-white/20 shadow-[0_12px_36px_rgba(0,0,0,0.7)] text-[11px] font-medium text-slate-100 whitespace-nowrap pointer-events-none flex items-center gap-2.5">
              <img src="/logo.png" alt="Emblem" className="w-3.5 h-3.5 object-contain filter drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
              <span className={`w-2 h-2 rounded-full ${getStatusBgClass(getPartStatus(selectedPart), selectedPart.qcHold)} ${selectedPart.qcHold ? 'animate-ping' : ''}`} />
              <span className="font-impact text-sm tracking-wider text-white">{selectedPart.id}</span>
              <span className="text-slate-500">·</span>
              <span className="font-display tracking-wide text-cyan-300 text-xs uppercase">{selectedPart.name}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 font-mono-code text-[10px]">Stock: <strong className="text-white">{selectedPart.stock}</strong></span>
              {selectedPart.qcHold && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#FF0055]/20 text-[#FF0055] text-[9px] font-bold font-mono-code border border-[#FF0055]/40">QC LOCK</span>
              )}
            </div>
          </Html>
        )}
      </group>

      <OrbitControls
        ref={controlsRef}
        enabled={!isIntroPlaying}
        makeDefault
        autoRotate={isCinematicAutoOrbit}
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.05}
        minDistance={1.8}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  );
}

// ============================================================================
// 10. PROCEDURAL AUDIO WAVEFORM VISUALIZER (TOP BAR)
// ============================================================================
function AudioWaveVisualizer({ isMuted }) {
  const [waveData, setWaveData] = useState(new Uint8Array(12));

  useEffect(() => {
    let animId;
    const update = () => {
      if (!isMuted) {
        const data = audio.getWaveformData();
        setWaveData(data.slice(0, 12));
      }
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [isMuted]);

  return (
    <div className="flex items-end gap-0.5 h-3.5 px-2 py-0.5 rounded-full bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10">
      {Array.from({ length: 12 }).map((_, i) => {
        const val = isMuted ? 2 : Math.max(3, (waveData[i] || 0) / 18);
        return (
          <div
            key={i}
            className="w-0.5 bg-[#0071E3] rounded-full transition-all duration-75"
            style={{ height: `${val}px` }}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// 10.4 NFS HEAT PROLOGUE CINEMATIC INTRO (PRE-LOGIN SEQUENCE)
// ============================================================================
function PreLoginIntroVideo({ onFinish }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);

  // Keyboard shortcut listener: Enter key skips intro
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.code === 'Enter' || e.key === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        audio.playClickSound();
        onFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFinish]);

  // Attempt unmuted playback with auto-fallback to muted
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsMuted(false);
        })
        .catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
    }
  }, []);

  const toggleAudio = (e) => {
    e.stopPropagation();
    audio.playClickSound();
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  const handleContainerClick = () => {
    const video = videoRef.current;
    if (video && isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className="fixed inset-0 z-[11000] bg-black flex items-center justify-center overflow-hidden select-none font-sans"
    >
      {/* 1080p High-Fidelity Video Feed (Hardware Accelerated) */}
      <video
        ref={videoRef}
        src="/1019.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={onFinish}
        className="w-full h-full object-cover scale-100"
        style={{
          transform: 'translateZ(0)',
          willChange: 'transform'
        }}
      />

      {/* Discrete Audio Toggle Button ONLY */}
      <button
        type="button"
        onClick={toggleAudio}
        className="absolute top-6 right-6 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass border border-white/20 text-xs font-mono-code text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition-all shadow-lg cursor-pointer"
      >
        {isMuted ? (
          <>
            <VolumeX className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-amber-300 uppercase tracking-wider font-bold">Unmute Audio</span>
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] text-cyan-300 uppercase tracking-wider font-bold">Audio Active</span>
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// 10.45 MCLAREN P1 GTR POST-LOGIN SECONDARY INTRO SEQUENCE (1016.MP4)
// ============================================================================
function PostLoginIntroVideo({ onFinish }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);

  // Keyboard shortcut listener: Enter key skips post-login intro
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.code === 'Enter' || e.key === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        audio.playClickSound();
        onFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFinish]);

  // Attempt unmuted playback with auto-fallback to muted
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsMuted(false);
        })
        .catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
    }
  }, []);

  const toggleAudio = (e) => {
    e.stopPropagation();
    audio.playClickSound();
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  const handleContainerClick = () => {
    const video = videoRef.current;
    if (video && isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className="fixed inset-0 z-[11000] bg-black flex items-center justify-center overflow-hidden select-none font-sans"
    >
      {/* 1080p High-Fidelity Video Feed - Hardware Accelerated & Zero Re-render Overhead */}
      <video
        ref={videoRef}
        src="/1016.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={onFinish}
        className="w-full h-full object-cover scale-100"
        style={{
          transform: 'translateZ(0)',
          willChange: 'transform'
        }}
      />

      {/* Discrete Audio Toggle Button ONLY */}
      <button
        type="button"
        onClick={toggleAudio}
        className="absolute top-6 right-6 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass border border-white/20 text-xs font-mono-code text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition-all shadow-lg cursor-pointer"
      >
        {isMuted ? (
          <>
            <VolumeX className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-amber-300 uppercase tracking-wider font-bold">Unmute Audio</span>
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-300 uppercase tracking-wider font-bold">Audio Active</span>
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// 10.5 LOGIN PORTAL (AURORA, CONIC HALO & ADMIN AUTHENTICATION)
// ============================================================================
function LoginPortal({ onLoginSuccess, onReplayIntro }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  const canvasRef = useRef(null);
  const btnRef = useRef(null);
  const userInputRef = useRef(null);

  const curRot = useRef({ rx: 0, ry: 0 });
  const targetRot = useRef({ rx: 0, ry: 0 });

  // 3D Tilt and spotlight animation loop
  useEffect(() => {
    let animId;
    const loop = () => {
      curRot.current.rx += (targetRot.current.rx - curRot.current.rx) * 0.08;
      curRot.current.ry += (targetRot.current.ry - curRot.current.ry) * 0.08;
      if (wrapRef.current) {
        wrapRef.current.style.transform = `rotateX(${curRot.current.rx.toFixed(2)}deg) rotateY(${curRot.current.ry.toFixed(2)}deg)`;
      }
      animId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Ambient floating particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let W, H;

    const resize = () => {
      if (!canvas || !stage) return;
      const dpr = window.devicePixelRatio || 1;
      W = canvas.width = stage.clientWidth * dpr;
      H = canvas.height = stage.clientHeight * dpr;
      canvas.style.width = stage.clientWidth + 'px';
      canvas.style.height = stage.clientHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['#22d3ee', '#8b5cf6', '#f472b6', '#ffffff'];
    const dpr = window.devicePixelRatio || 1;
    const particles = Array.from({ length: 46 }, () => ({
      x: Math.random() * (W || window.innerWidth * dpr),
      y: Math.random() * (H || window.innerHeight * dpr),
      r: (Math.random() * 1.6 + 0.6) * dpr,
      vy: (Math.random() * 0.25 + 0.06) * dpr,
      vx: (Math.random() - 0.5) * 0.12 * dpr,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      a: Math.random() * 0.5 + 0.25,
      pulse: Math.random() * Math.PI * 2
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.y -= p.vy;
        p.x += p.vx;
        p.pulse += 0.02;
        if (p.y < -10 * dpr) {
          p.y = H + 10 * dpr;
          p.x = Math.random() * W;
        }
        const alpha = p.a * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.fillStyle = p.c;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 8 * dpr;
        ctx.shadowColor = p.c;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleStageMouseMove = (e) => {
    if (!stageRef.current || !cardRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    targetRot.current = { rx: py * -12, ry: px * 14 };

    const cr = cardRef.current.getBoundingClientRect();
    const mx = ((e.clientX - cr.left) / cr.width) * 100;
    const my = ((e.clientY - cr.top) / cr.height) * 100;
    cardRef.current.style.setProperty('--mx', `${mx.toFixed(1)}%`);
    cardRef.current.style.setProperty('--my', `${my.toFixed(1)}%`);
  };

  const handleStageMouseLeave = () => {
    targetRot.current = { rx: 0, ry: 0 };
  };

  const handleBtnMouseMove = (e) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.12;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.35;
    btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };

  const handleBtnMouseLeave = () => {
    if (btnRef.current) {
      btnRef.current.style.transform = '';
    }
  };

  const handleBtnClick = (e) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.className = 'portal-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    audio.playClickSound();

    if (username.trim() === 'admin' && password.trim() === 'admin') {
      setErrorMsg('');
      setIsSuccess(true);
      if (rememberMe) {
        try {
          localStorage.setItem('showcase_auth', 'admin');
        } catch {}
      }
      try {
        sessionStorage.setItem('showcase_auth', 'admin');
      } catch {}

      setTimeout(() => {
        onLoginSuccess();
      }, 700);
    } else {
      setIsSuccess(false);
      setErrorMsg('Invalid credentials. Required: admin / admin');
      if (userInputRef.current) {
        userInputRef.current.focus();
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      ref={stageRef}
      onMouseMove={handleStageMouseMove}
      onMouseLeave={handleStageMouseLeave}
      className="portal-stage"
    >
      {/* Ambient Aurora Gradient Background */}
      <div className="portal-aurora" />
      <canvas ref={canvasRef} className="portal-fx" />
      <div className="portal-grain" />

      {/* 3D Tilt Card Wrap */}
      <div ref={wrapRef} className="portal-card-wrap">
        {/* Conic Rotating Halo (Angle animated, DOM box stationary) */}
        <div className="portal-halo blurred" aria-hidden="true" />
        <div className="portal-halo" aria-hidden="true" />

        {/* Glass Card Container */}
        <div ref={cardRef} className="portal-card">
          {/* Emblem Glyph (Orbital Double Ring + Pulsing Core) */}
          <div className="portal-glyph">
            <svg viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="portalGlyphGrad" x1="0" y1="0" x2="64" y2="64">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="55%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
              </defs>
              <circle className="ring" cx="32" cy="32" r="29" stroke="url(#portalGlyphGrad)" strokeWidth="2" opacity="0.35" strokeDasharray="6 5" />
              <ellipse className="ring ring2" cx="32" cy="32" rx="27" ry="12" stroke="url(#portalGlyphGrad)" strokeWidth="2" transform="rotate(30 32 32)" />
              <ellipse className="ring" cx="32" cy="32" rx="27" ry="12" stroke="url(#portalGlyphGrad)" strokeWidth="2" transform="rotate(-30 32 32)" opacity="0.6" />
              <circle className="core" cx="32" cy="32" r="7" fill="url(#portalGlyphGrad)" />
            </svg>
          </div>

          <h1 className="portal-title">Welcome back</h1>
          <p className="portal-sub">Sign in with administrator credentials</p>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="portal-err-msg">
              {errorMsg}
            </div>
          )}

          {isSuccess && (
            <div className="portal-success-msg">
              ✓ Access granted. Initializing showroom...
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="portal-form">
            {/* Username Input with Floating Label */}
            <div className="portal-field portal-field-1">
              <span className="portal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                ref={userInputRef}
                type="text"
                id="portal-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder=" "
                autoComplete="username"
                required
              />
              <label htmlFor="portal-username">Username (admin)</label>
            </div>

            {/* Password Input with Floating Label & Eye Toggle */}
            <div className="portal-field portal-field-2">
              <span className="portal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="5" y="11" width="14" height="9" rx="2.5" />
                  <path d="M8 11V7.5a4 4 0 018 0V11" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="portal-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                autoComplete="current-password"
                required
              />
              <label htmlFor="portal-pass">Password (admin)</label>
              <button
                type="button"
                className="portal-toggle-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3l18 18" strokeLinecap="round" />
                    <path d="M10.6 5.2A10.9 10.9 0 0112 5c7 0 10.5 7 10.5 7a13.6 13.6 0 01-3.1 4M6.6 6.6C3.7 8.4 1.5 12 1.5 12S5 19 12 19c1.3 0 2.5-.2 3.6-.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.9 9.9a3 3 0 004.2 4.2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Remember Credentials */}
            <div className="portal-row">
              <label className="portal-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="portal-chk" />
                <span>Remember credentials</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="portal-btn-wrap">
              <button
                ref={btnRef}
                className="portal-btn"
                type="submit"
                disabled={isSuccess}
                onClick={handleBtnClick}
                onMouseMove={handleBtnMouseMove}
                onMouseLeave={handleBtnMouseLeave}
              >
                <span className="shine" />
                {isSuccess ? 'Authenticating...' : 'Sign in'}
              </button>
            </div>
          </form>
          {onReplayIntro && (
            <div className="flex justify-center mt-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onReplayIntro}
                className="inline-flex items-center gap-1.5 text-xs text-[#a99fc9] hover:text-cyan-300 transition-colors bg-transparent border-none cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5 text-cyan-400" />
                <span>Replay NFS Heat Prologue</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// 11. MAIN BOLT // EV-OS APPLICATION ARCHITECTURE (LIQUID GLASS + HIGH-IMPACT TYPOGRAPHY)
// ============================================================================
const SUBSYSTEM_CATEGORIES = ['ALL', 'Structural', 'Energy', 'Powertrain', 'Chassis', 'Aerodynamics', 'Cockpit'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPreLoginIntroPlaying, setIsPreLoginIntroPlaying] = useState(true);
  const [engineMode, setEngineMode] = useState('local');
  const [isExploded, setIsExploded] = useState(false);
  const [isTelemetryActive, setIsTelemetryActive] = useState(true);
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [activeFolder, setActiveFolder] = useState('viewport'); // default directly to cinematic viewport
  const [isMuted, setIsMuted] = useState(false);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [introSettled, setIntroSettled] = useState(true);
  const [introProgress, setIntroProgress] = useState(1);
  const [cameraPreset, setCameraPreset] = useState(CAMERA_PRESETS[0]); // FRONT NOSE
  const [revTrigger, setRevTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [subsystemFilter, setSubsystemFilter] = useState('ALL');

  // Bulk / Batch JIT Allocation & ACID 2PC Confirmation Modal State
  const [batchSize, setBatchSize] = useState(10);
  const [confirmModal, setConfirmModal] = useState(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  const [skipQuickConfirm, setSkipQuickConfirm] = useState(false);

  // PostgreSQL Engine Tabs & Persistent State across reloads
  const [activeDbTab, setActiveDbTab] = useState('acid'); // 'acid' | 'concurrency' | 'storage' | 'query'
  const [bomList, setBomList] = useState(() => {
    try {
      const version = localStorage.getItem('bolt_bom_version');
      const saved = localStorage.getItem('bolt_bom_list');
      if (version === 'v6_mclaren_p1_gtr' && saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            ...item,
            status: getPartStatus(item)
          }));
        }
      }
    } catch {}
    return INITIAL_BOM_DATA.map((item) => ({
      ...item,
      status: getPartStatus(item)
    }));
  });
  const [walLogs, setWalLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('bolt_wal_logs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Sync state to localStorage on every transaction / modification
  useEffect(() => {
    try {
      localStorage.setItem('bolt_bom_version', 'v6_mclaren_p1_gtr');
      localStorage.setItem('bolt_bom_list', JSON.stringify(bomList));
    } catch {}
  }, [bomList]);

  useEffect(() => {
    try {
      localStorage.setItem('bolt_wal_logs', JSON.stringify(walLogs));
    } catch {}
  }, [walLogs]);

  const [lockTable, setLockTable] = useState([
    { resource: 'BOM-01 (Structural Battery Floor & Tanks)', lockType: 'EXCLUSIVE (X-LOCK)', owner: 'TXN-9021', status: 'GRANTED' },
    { resource: 'BOM-04 (Cockpit Tub & Telemetry Cabin)', lockType: 'SHARED (S-LOCK)', owner: 'TXN-9022', status: 'GRANTED' },
    { resource: 'BOM-00 (Aero-Monocoque Body Shell)', lockType: 'INTENT EXCLUSIVE (IX)', owner: 'TXN-9023', status: 'GRANTED' }
  ]);

  // Selected BOM Item
  const selectedPart = useMemo(() => {
    if (!selectedPartId) return null;
    return bomList.find((p) => p.id === selectedPartId) || null;
  }, [selectedPartId, bomList]);

  // Filtered BOM List based on search query and category
  const filteredBomList = useMemo(() => {
    return bomList.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      const matchesCategory = subsystemFilter === 'ALL' || item.category.toLowerCase().includes(subsystemFilter.toLowerCase());
      return matchesSearch && matchesCategory;
    });
  }, [bomList, searchQuery, subsystemFilter]);

  // Immediately settle into showroom as soon as video sequence concludes or is skipped
  useEffect(() => {
    if (!isIntroPlaying) {
      setIntroSettled(true);
      setIntroProgress(1);
      setActiveFolder('viewport');
      setSelectedPartId(null);
      setCameraPreset(CAMERA_PRESETS[0]); // FRONT NOSE
    }
  }, [isIntroPlaying]);

  // Initialize audio on first user click anywhere
  useEffect(() => {
    const handleFirstGesture = () => {
      audio.init();
      window.removeEventListener('pointerdown', handleFirstGesture);
    };
    window.addEventListener('pointerdown', handleFirstGesture);
    return () => window.removeEventListener('pointerdown', handleFirstGesture);
  }, []);

  // Trigger Throttle Rev & Exhaust Sparks
  const handleRevThrottle = () => {
    audio.playClickSound();
    setRevTrigger((prev) => prev + 1);
  };

  // Execute Atomic Batch / Bulk Transaction for one or more parts under ACID 2PC protocols
  const executeBatchAcidTransaction = (itemsToUpdate) => {
    // itemsToUpdate: array of { partId, qtyDelta }
    audio.playClickSound();

    // Check if any item would breach 0 floor
    const failedItem = itemsToUpdate.find(({ partId, qtyDelta }) => {
      const target = bomList.find((p) => p.id === partId);
      return target && target.stock + qtyDelta < 0;
    });

    if (failedItem) {
      const target = bomList.find((p) => p.id === failedItem.partId);
      const rollbackLog = {
        lsn: `LSN-${Math.floor(100000 + Math.random() * 900000)}`,
        txn: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
        op: 'ABORT / 2PC ROLLBACK',
        details: `Integrity check failed: ${target.id} insufficient allocation stock (${target.stock} < ${Math.abs(failedItem.qtyDelta)})`,
        status: 'rolled_back',
        timestamp: new Date().toLocaleTimeString()
      };
      setWalLogs((prev) => [rollbackLog, ...prev.slice(0, 18)]);
      return false;
    }

    const deltaMap = new Map();
    itemsToUpdate.forEach(({ partId, qtyDelta }) => {
      deltaMap.set(partId, (deltaMap.get(partId) || 0) + qtyDelta);
    });

    const commitLogs = [];
    setBomList((prev) =>
      prev.map((item) => {
        if (deltaMap.has(item.id)) {
          const delta = deltaMap.get(item.id);
          const newStock = Math.max(0, item.stock + delta);
          const newStatus = getPartStatus({ ...item, stock: newStock });

          commitLogs.push({
            lsn: `LSN-${Math.floor(100000 + Math.random() * 900000)}`,
            txn: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
            op: Math.abs(delta) > 1
              ? (delta > 0 ? '2PC BULK INGESTION' : '2PC BATCH DISPATCH')
              : '2PC PREPARE & COMMIT',
            details: `${item.id} allocation updated ${item.stock} -> ${newStock} (${delta > 0 ? `+${delta}` : delta}) [${newStatus.toUpperCase()}]`,
            status: 'committed',
            timestamp: new Date().toLocaleTimeString()
          });

          return { ...item, stock: newStock, status: newStatus };
        }
        return item;
      })
    );

    if (commitLogs.length > 0) {
      setWalLogs((prev) => [...commitLogs, ...prev].slice(0, 20));
    }
    return true;
  };

  // Stage Transaction & Request Confirmation Modal
  const requestTransactionConfirmation = (itemsToAdjust) => {
    audio.playClickSound();

    const populated = itemsToAdjust.map(({ partId, qtyDelta }) => {
      const part = bomList.find((p) => p.id === partId);
      if (!part) return null;
      const currentStock = part.stock;
      const projectedStock = currentStock + qtyDelta;
      const currentStatus = getPartStatus(part);
      const projectedStatus = getPartStatus({ ...part, stock: projectedStock });
      const isInvalid = projectedStock < 0;

      return {
        partId,
        name: part.name,
        category: part.category,
        currentStock,
        qtyDelta,
        projectedStock,
        reorderLevel: part.reorderLevel || 30,
        currentStatus,
        projectedStatus,
        qcHold: part.qcHold,
        isInvalid
      };
    }).filter(Boolean);

    if (populated.length === 0) return;

    // Optional fast-bypass for single +/-1 clicks if user opted in
    if (skipQuickConfirm && populated.length === 1 && Math.abs(populated[0].qtyDelta) === 1 && !populated[0].isInvalid) {
      executeBatchAcidTransaction(itemsToAdjust);
      return;
    }

    const isAllAddition = populated.every((i) => i.qtyDelta > 0);
    const isAllRemoval = populated.every((i) => i.qtyDelta < 0);
    const totalDelta = populated.reduce((acc, i) => acc + i.qtyDelta, 0);
    const hasInvalid = populated.some((i) => i.isInvalid);

    setConfirmModal({
      items: populated,
      isAddition: isAllAddition,
      isRemoval: isAllRemoval,
      totalDelta,
      hasInvalid,
      isBulk: populated.length > 1 || Math.abs(totalDelta) > 1,
      title: populated.length > 1
        ? `CONFIRM MULTI-PART ${isAllAddition ? 'BULK RESTOCK' : 'BATCH DISPATCH'}`
        : Math.abs(totalDelta) > 1
        ? `CONFIRM ${isAllAddition ? 'BULK STOCK INGESTION' : 'BATCH ALLOCATION DISPATCH'}`
        : `CONFIRM ${isAllAddition ? 'STOCK INGESTION' : 'ALLOCATION DISPATCH'}`
    });
  };

  // Helper mapping single part adjustments to confirmation
  const executeAcidTransaction = (partId, qtyDelta) => {
    requestTransactionConfirmation([{ partId, qtyDelta }]);
  };

  const handleConfirmTransaction = () => {
    if (!confirmModal || confirmModal.hasInvalid) return;
    const itemsToUpdate = confirmModal.items.map((i) => ({
      partId: i.partId,
      qtyDelta: i.qtyDelta
    }));
    executeBatchAcidTransaction(itemsToUpdate);
    setConfirmModal(null);
    if (isMultiSelectMode) {
      setSelectedPartIds([]);
    }
  };

  const handleCancelTransaction = () => {
    audio.playClickSound();
    setConfirmModal(null);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#04060A] font-sans select-none text-slate-100">
      {/* ==================================================================== */}
      {/* -2. NFS HEAT PRE-LOGIN CINEMATIC PROLOGUE */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {!isAuthenticated && isPreLoginIntroPlaying && (
          <motion.div
            key="prelogin-nfs-intro"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[11000]"
          >
            <PreLoginIntroVideo onFinish={() => setIsPreLoginIntroPlaying(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* -1. AURORA GLASS LOGIN PORTAL (ADMIN / ADMIN) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {!isAuthenticated && !isPreLoginIntroPlaying && (
          <LoginPortal
            onLoginSuccess={() => {
              setIsAuthenticated(true);
              setIsIntroPlaying(true);
              setIntroSettled(false);
            }}
            onReplayIntro={() => setIsPreLoginIntroPlaying(true)}
          />
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 0. SEAMLESS FULLSCREEN VIDEO INTRO SEQUENCE (1016.MP4) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isAuthenticated && isIntroPlaying && (
          <motion.div
            key="postlogin-cad-intro"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[11000]"
          >
            <PostLoginIntroVideo
              onFinish={() => {
                setIsIntroPlaying(false);
                setIntroSettled(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 3D CANVAS VIEWPORT (BATCAVE GARAGE & OBSIDIAN BACKGROUND) */}
      {/* ==================================================================== */}
      {isAuthenticated && !isIntroPlaying && (
        <div className="absolute inset-0 z-0">
          <Canvas
            frameloop="always"
            shadows
            camera={{ position: [0, 0.70, 3.8], fov: 45 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.95,
              powerPreference: "high-performance"
            }}
            onPointerMissed={() => {
              setSelectedPartId(null);
            }}
          >
            <color attach="background" args={['#030712']} />
            <fog attach="fog" args={['#030712', 30, 80]} />
            <SceneContainer
              engineMode={engineMode}
              isExploded={isExploded}
              selectedPartId={selectedPartId}
              bomList={bomList}
              onSelectPart={(id) => {
                setSelectedPartId(id);
              }}
              isTelemetryActive={isTelemetryActive}
              onIntroSettle={() => setIntroSettled(true)}
              introProgress={introProgress}
              isIntroPlaying={false}
              cameraPreset={cameraPreset}
              revTrigger={revTrigger}
              activeFolder={activeFolder}
            />
          </Canvas>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. TOP-LEFT SHOWCASE LOGO & TOP-RIGHT AUDIO CONTROL */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {!isIntroPlaying && introSettled && (
          <>
            {/* Top-Left Showcase Brand Emblem */}
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="fixed top-5 left-6 z-40 flex items-center gap-3 select-none pointer-events-auto"
            >
              <div className="relative w-12 h-12 flex items-center justify-center filter drop-shadow-[0_4px_16px_rgba(255,255,255,0.25)] transition-transform hover:scale-105 duration-200 cursor-pointer">
                <img
                  src="/logo.png"
                  alt="Brand Emblem"
                  className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                />
              </div>
              <h1 className="font-black italic tracking-wider text-2xl text-white drop-shadow-[0_2px_14px_rgba(255,255,255,0.45)] leading-none">
                BOLT
              </h1>
            </motion.div>

            {/* Discrete Top-Right Audio Mute Pill */}
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="fixed top-5 right-6 z-40 flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-full liquid-glass border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            >
              <AudioWaveVisualizer isMuted={isMuted} />
              <button
                type="button"
                onClick={() => {
                  const muted = audio.toggleMute();
                  setIsMuted(muted);
                }}
                className="p-1 rounded-full hover:bg-white/10 transition text-slate-300"
                title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-[#FACC15]" />}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 2B. CAMERA PERSPECTIVES FLOATING CONTROLLER (BOTTOM DOCK) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {!isIntroPlaying && introSettled && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.2 }}
            className={`fixed z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass border border-white/20 shadow-[0_12px_36px_rgba(0,0,0,0.7)] transition-all duration-300 ${
              activeFolder === 'dbms' ? 'bottom-[276px]' : 'bottom-6'
            } ${
              selectedPart
                ? 'left-1/2 -translate-x-[calc(50%+120px)] 2xl:-translate-x-1/2'
                : 'left-1/2 -translate-x-1/2'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[9.5px] font-mono-code font-bold uppercase tracking-wider text-slate-400 pr-2 border-r border-white/15 whitespace-nowrap">
              <Camera className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span className="hidden sm:inline">PERSPECTIVE:</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Interactive Exploded View Mode Button */}
              <button
                type="button"
                onClick={() => {
                  audio.playClickSound();
                  setIsExploded(!isExploded);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-bold font-mono-code transition-all ${
                  isExploded
                    ? 'bg-gradient-to-r from-[#FACC15] to-[#EAB308] text-black shadow-[0_0_16px_rgba(250,204,21,0.55)] border border-[#FACC15]'
                    : 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-400/10 border border-amber-400/30'
                }`}
                title="Toggle Interactive 3D Exploded Component View"
              >
                <Layers className={`w-3 h-3 ${isExploded ? 'text-black' : 'text-[#FACC15]'}`} />
                <span>{isExploded ? 'EXPLODED [1.5X]' : 'EXPLODED VIEW'}</span>
              </button>

              <div className="h-3.5 w-px bg-white/20 mx-0.5" />

              {CAMERA_PRESETS.map((preset) => {
                const isActive = cameraPreset.id === preset.id && !selectedPartId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      audio.playClickSound();
                      setSelectedPartId(null);
                      setCameraPreset(preset);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[9.5px] font-bold font-mono-code transition-all ${
                      isActive
                        ? 'bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/50 shadow-[0_0_12px_rgba(0,240,255,0.35)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 3. VERTICAL NAVIGATION DOCK (PINNED FAR LEFT) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {!isIntroPlaying && introSettled && (
          <motion.div
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.1 }}
            className="fixed top-24 left-4 z-30 flex flex-col gap-2 p-1.5 rounded-2xl liquid-glass border border-white/12 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            {[
              { id: 'viewport', icon: EyeIcon, label: 'Viewport' },
              { id: 'bom', icon: Folder, label: 'BOM Explorer' },
              { id: 'dbms', icon: Database, label: 'DBMS Kernel (Review-2)' }
            ].map((folder) => {
              const Icon = folder.icon;
              const isActive = activeFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    audio.playClickSound();
                    if (folder.id === 'viewport') {
                      setSelectedPartId(null);
                    }
                    setActiveFolder(activeFolder === folder.id ? 'viewport' : folder.id);
                  }}
                  className={`relative group flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-tr from-[#0071E3] to-[#00F0FF] text-white shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={folder.label}
                >
                  <Icon className="w-5 h-5" />
                  <span className="absolute left-14 px-2.5 py-1 rounded-lg liquid-glass border border-white/15 text-white text-[11px] font-mono-code font-bold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition shadow-xl">
                    {folder.label}
                  </span>
                </button>
              );
            })}

            {/* Lock / Sign Out Button */}
            <div className="pt-1 mt-1 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  audio.playClickSound();
                  try {
                    localStorage.removeItem('showcase_auth');
                    sessionStorage.removeItem('showcase_auth');
                  } catch {}
                  setIsAuthenticated(false);
                  setIsPreLoginIntroPlaying(false);
                }}
                className="relative group flex items-center justify-center w-11 h-11 rounded-xl transition-all text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                title="Lock / Sign Out"
              >
                <Lock className="w-4 h-4" />
                <span className="absolute left-14 px-2.5 py-1 rounded-lg liquid-glass border border-white/15 text-white text-[11px] font-mono-code font-bold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition shadow-xl">
                  Sign Out (admin)
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 4. LEFT MULTI-TIER BOM TREE DRAWER (LIQUID GLASS + HIGH-IMPACT TYPOGRAPHY) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {!isIntroPlaying && introSettled && activeFolder === 'bom' && (
          <motion.div
            initial={{ x: -360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -360, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="fixed top-24 left-20 bottom-8 z-30 w-88 max-w-[340px] p-5 rounded-3xl liquid-glass border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.7)] flex flex-col text-slate-100"
          >
            {/* Header */}
            <div className="pb-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="Emblem" className="w-5 h-5 object-contain filter drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
                  <h2 className="font-impact text-base tracking-wider uppercase text-white">
                    Hardware Hierarchy
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded-full liquid-glass-capsule text-[10px] font-mono-code text-cyan-300 font-bold border border-cyan-400/20">
                  {filteredBomList.length} / {bomList.length} NODES
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative mt-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by part ID, name, subsystem..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono-code transition"
                />
              </div>

              {/* Subsystem Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pt-2 pb-0.5 no-scrollbar">
                {SUBSYSTEM_CATEGORIES.map((cat) => {
                  const isActive = subsystemFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        audio.playClickSound();
                        setSubsystemFilter(cat);
                      }}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold font-mono-code uppercase whitespace-nowrap transition ${
                        isActive
                          ? 'bg-[#00F0FF] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Quick Bulk Restock & Multi-Select Bar */}
              <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/10 text-[10px] font-mono-code">
                <button
                  type="button"
                  onClick={() => {
                    const lowParts = bomList.filter((p) => getPartStatus(p) !== 'healthy');
                    if (lowParts.length === 0) return;
                    requestTransactionConfirmation(
                      lowParts.map((p) => ({ partId: p.id, qtyDelta: +10 }))
                    );
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00F59B] border border-emerald-500/30 font-bold transition"
                  title="Restock all warning/critical assemblies with +10 units"
                >
                  <RefreshCw className="w-3 h-3" />
                  RESTOCK LOW (+10)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    audio.playClickSound();
                    setIsMultiSelectMode(!isMultiSelectMode);
                    if (isMultiSelectMode) setSelectedPartIds([]);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border transition ${
                    isMultiSelectMode
                      ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                      : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
                  }`}
                >
                  <CheckSquare className="w-3 h-3" />
                  {isMultiSelectMode ? 'EXIT BATCH' : 'MULTI-SELECT'}
                </button>
              </div>
            </div>

            {/* Tree Nodes List */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1">
              {filteredBomList.map((part) => {
                const isSelected = selectedPartId === part.id;
                const isBatchSelected = selectedPartIds.includes(part.id);
                const maxStock = Math.max(60, (part.reorderLevel || 30) * 1.4);
                const stockRatio = Math.min(100, Math.max(10, (part.stock / maxStock) * 100));
                const partStatus = getPartStatus(part);
                const statusBg = getStatusBgClass(partStatus, part.qcHold);

                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => {
                      audio.playClickSound();
                      if (isMultiSelectMode) {
                        setSelectedPartIds((prev) =>
                          prev.includes(part.id)
                            ? prev.filter((id) => id !== part.id)
                            : [...prev, part.id]
                        );
                      } else {
                        setSelectedPartId(part.id);
                      }
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all border ${
                      isBatchSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                        : isSelected
                        ? 'bg-gradient-to-r from-cyan-950/50 to-blue-950/50 border-cyan-400/60 shadow-[0_0_25px_rgba(0,240,255,0.25)]'
                        : 'liquid-glass-pill hover:border-cyan-400/40 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isMultiSelectMode && (
                          <div className="text-cyan-400">
                            {isBatchSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#00F0FF]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                        )}
                        <span className="font-impact text-xs tracking-wider text-[#00F0FF]">
                          {part.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono-code text-slate-400 uppercase">
                          {part.category.split(' ')[0]}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${statusBg} ${part.qcHold ? 'animate-ping' : ''}`} />
                      </div>
                    </div>

                    <div className="font-display text-sm font-bold text-white tracking-wide truncate">
                      {part.name}
                    </div>

                    {/* Micro Stock Progress Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="w-full h-1 rounded-full bg-slate-800/80 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${statusBg}`}
                          style={{ width: `${stockRatio}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400">
                        <span>Stock: <strong className="text-white">{part.stock} units</strong></span>
                        <span className="text-cyan-300">{part.unitCost}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Multi-Select Floating Batch Deck */}
            {isMultiSelectMode && selectedPartIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-3 p-2.5 rounded-2xl liquid-glass border border-cyan-400/40 shadow-[0_0_25px_rgba(0,240,255,0.25)] flex items-center justify-between font-mono-code text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="font-bold text-white text-[11px]">{selectedPartIds.length} Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      requestTransactionConfirmation(
                        selectedPartIds.map((id) => ({ partId: id, qtyDelta: +10 }))
                      );
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black font-bold text-[10px] hover:opacity-90 transition shadow-[0_0_10px_rgba(0,245,155,0.4)]"
                  >
                    +10 ADD
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      requestTransactionConfirmation(
                        selectedPartIds.map((id) => ({ partId: id, qtyDelta: -5 }))
                      );
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] hover:opacity-90 transition shadow-[0_0_10px_rgba(255,0,85,0.4)]"
                  >
                    -5 ALLOC
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPartIds([])}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                    title="Clear Selection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 5. RIGHT SLIDE-OVER HARDWARE INSPECTOR (LIQUID GLASS + BENTO GAUGES) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {!isIntroPlaying && selectedPart && (
          <motion.aside
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="fixed top-24 right-4 bottom-20 z-30 w-88 max-w-[340px] p-5 rounded-3xl liquid-glass border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.7)] flex flex-col overflow-y-auto text-slate-100"
          >
            {/* Header with Close Button */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Emblem" className="w-5 h-5 object-contain filter drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
                <h3 className="font-impact text-base tracking-wider uppercase text-white">
                  Hardware Inspector
                </h3>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  audio.playClickSound();
                  setSelectedPartId(null);
                }}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
                title="Close Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Part Name & Primary Tag */}
            <div className="pt-4 pb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-impact text-2xl tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,240,255,0.35)]">
                  {selectedPart.id}
                </span>
                {(() => {
                  const partStatus = getPartStatus(selectedPart);
                  const isCrit = partStatus === 'critical' || selectedPart.qcHold;
                  const isWarn = partStatus === 'warning';
                  const label = selectedPart.qcHold ? 'QC HOLD' : isCrit ? 'LOW CRITICAL' : isWarn ? 'REORDER' : 'NOMINAL';
                  const badgeClass = isCrit
                    ? 'border-[#FF0055]/40 text-[#FF0055] bg-[#FF0055]/10'
                    : isWarn
                    ? 'border-[#FFB703]/40 text-[#FFB703] bg-[#FFB703]/10'
                    : 'border-[#00F59B]/40 text-[#00F59B] bg-[#00F59B]/10';

                  return (
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono-code font-bold border flex items-center gap-1 ${badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusBgClass(partStatus, selectedPart.qcHold)} ${selectedPart.qcHold ? 'animate-ping' : ''}`} />
                        {label}
                      </span>
                      <span className="px-2 py-0.5 rounded-md liquid-glass-capsule text-[10px] font-mono-code text-cyan-300 font-bold border border-cyan-400/30">
                        ISO 26262 ASIL-D
                      </span>
                    </div>
                  );
                })()}
              </div>
              <h2 className="font-display text-lg font-bold text-slate-100 leading-snug tracking-wide">
                {selectedPart.name}
              </h2>
              <p className="text-[10px] font-mono-code text-slate-400 uppercase tracking-wider mt-0.5">
                {selectedPart.category} · {selectedPart.material}
              </p>
            </div>

            {/* Hardware Telemetry Bento Grid */}
            <div className="grid grid-cols-2 gap-2.5 my-3">
              {/* Voltage / HV Power */}
              <div className="p-3 rounded-2xl liquid-glass-pill border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono-code uppercase">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Voltage</span>
                </div>
                <div className="font-mono-code text-sm font-bold text-white">
                  {selectedPart.voltage}
                </div>
              </div>

              {/* Thermal Range */}
              <div className="p-3 rounded-2xl liquid-glass-pill border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono-code uppercase">
                  <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-rose-400" /> Temp Range</span>
                </div>
                <div className="font-mono-code text-xs font-bold text-white truncate">
                  {selectedPart.thermalTolerance}
                </div>
              </div>

              {/* Torque Spec */}
              <div className="p-3 rounded-2xl liquid-glass-pill border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono-code uppercase">
                  <span className="flex items-center gap-1"><Wrench className="w-3 h-3 text-cyan-400" /> Torque</span>
                </div>
                <div className="font-mono-code text-xs font-bold text-white truncate">
                  {selectedPart.torqueSpec}
                </div>
              </div>

              {/* Yield Metric */}
              <div className="p-3 rounded-2xl liquid-glass-pill border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono-code uppercase">
                  <span className="flex items-center gap-1 truncate"><ShieldCheck className="w-3 h-3 text-emerald-400" /> {selectedPart.keyMetricLabel || 'Metric'}</span>
                </div>
                <div className="font-mono-code text-xs font-bold text-white truncate">
                  {selectedPart.keyMetricValue}
                </div>
              </div>
            </div>

            {/* Engineering & Supply Chain Specs */}
            <div className="space-y-2 text-xs py-2.5 border-t border-white/10 font-mono-code">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><Box className="w-3.5 h-3.5 text-[#00F0FF]" /> Unit Valuation</span>
                <strong className="text-emerald-400 text-[11px] font-bold">{selectedPart.unitCost}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-cyan-400" /> Dry Assembly Mass</span>
                <strong className="text-white text-[11px]">{selectedPart.massWeight}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-amber-300" /> Tier-1 Supplier</span>
                <strong className="text-white text-[11px] truncate max-w-[170px] text-right">{selectedPart.supplier}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#00F0FF]" /> Bin Location</span>
                <strong className="text-white text-[11px]">{selectedPart.bin}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-emerald-400" /> RFID Tracking</span>
                <strong className="text-white text-[11px]">{selectedPart.rfid}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400" /> JIT Lead Time</span>
                <strong className="text-white text-[11px]">{selectedPart.leadTimeDays} Days</strong>
              </div>
            </div>

            {/* Custom Livery / Paint Finishes in Hardware Inspector */}
            {/* Authentic MSO Factory Track Livery Spec */}
            <div className="py-2.5 border-t border-white/10 font-mono-code space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <SparklesIcon className="w-3.5 h-3.5 text-[#00F0FF]" /> Factory Specification
                </span>
                <span className="text-amber-400 font-bold text-[10px] uppercase">
                  MSO Track GTR Spec
                </span>
              </div>
              <p className="text-[10px] text-slate-300/80 leading-relaxed">
                McLaren P1 GTR · 1,000 PS (986 BHP) 3.8L V8 Twin-Turbo Hybrid · MonoCage Carbon Monocoque · PBR 4K
              </p>
            </div>

            {/* Interactive Action Deck (Single & Bulk JIT Allocation with Confirmation) */}
            <div className="pt-2 mt-auto space-y-2.5 font-mono-code">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-1">
                <span>JIT Stock Allocation</span>
                <span className="flex items-center gap-1.5 font-mono-code normal-case">
                  <span className={`w-2 h-2 rounded-full ${getStatusBgClass(getPartStatus(selectedPart), selectedPart.qcHold)} ${selectedPart.qcHold ? 'animate-ping' : ''}`} />
                  <span className="text-white font-bold text-[11px]">{selectedPart.stock} units</span>
                  <span className="text-slate-500 font-normal text-[10px]">/ min {selectedPart.reorderLevel || 30}</span>
                </span>
              </div>

              {/* Batch Size Selector Pills */}
              <div className="flex items-center justify-between bg-black/40 p-1 rounded-xl border border-white/5 text-[10px]">
                <span className="text-slate-400 pl-2 font-mono-code uppercase text-[9px]">Batch Size:</span>
                <div className="flex items-center gap-1">
                  {[1, 5, 10, 25].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => {
                        audio.playClickSound();
                        setBatchSize(qty);
                      }}
                      className={`px-2 py-0.5 rounded-lg font-bold transition ${
                        batchSize === qty
                          ? 'bg-[#00F0FF] text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {qty}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Batch Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => requestTransactionConfirmation([{ partId: selectedPart.id, qtyDelta: +batchSize }])}
                  className="py-2.5 rounded-xl liquid-glass-pill hover:border-emerald-400/50 hover:bg-emerald-500/10 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(0,245,155,0.15)]"
                >
                  <Plus className="w-3.5 h-3.5 text-[#00F59B]" />
                  +{batchSize} ADD
                </button>
                <button
                  type="button"
                  onClick={() => requestTransactionConfirmation([{ partId: selectedPart.id, qtyDelta: -batchSize }])}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-[#0071E3] to-[#00F0FF] hover:opacity-90 text-black text-xs font-bold transition shadow-[0_0_20px_rgba(0,240,255,0.4)] flex items-center justify-center gap-1"
                >
                  <Minus className="w-3.5 h-3.5 text-black" />
                  -{batchSize} ALLOCATE
                </button>
              </div>

              {/* Instant Quick Shortcuts (Single ±1 and Bulk ±10) */}
              <div className="grid grid-cols-4 gap-1 text-[9px] pt-0.5">
                <button
                  type="button"
                  onClick={() => requestTransactionConfirmation([{ partId: selectedPart.id, qtyDelta: +1 }])}
                  className="py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition font-mono-code"
                  title="Add 1 Unit"
                >
                  +1 QUICK
                </button>
                <button
                  type="button"
                  onClick={() => requestTransactionConfirmation([{ partId: selectedPart.id, qtyDelta: -1 }])}
                  className="py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition font-mono-code"
                  title="Allocate 1 Unit"
                >
                  -1 QUICK
                </button>
                <button
                  type="button"
                  onClick={() => requestTransactionConfirmation([{ partId: selectedPart.id, qtyDelta: +10 }])}
                  className="py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00F59B] border border-emerald-500/30 transition font-bold font-mono-code"
                  title="Bulk Ingest 10 Units"
                >
                  +10 BULK
                </button>
                <button
                  type="button"
                  onClick={() => requestTransactionConfirmation([{ partId: selectedPart.id, qtyDelta: -10 }])}
                  className="py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[#FF0055] border border-rose-500/30 transition font-bold font-mono-code"
                  title="Bulk Dispatch 10 Units"
                >
                  -10 BULK
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 6. BOTTOM DRAWER (POSTGRESQL TELEMETRY & WAL ENGINE - REVIEW-2) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {!isIntroPlaying && introSettled && activeFolder === 'dbms' && (
          <motion.div
            initial={{ y: 280, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 280, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="fixed bottom-4 left-20 right-4 z-30 h-64 p-4 rounded-3xl liquid-glass border border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.8)] flex flex-col text-slate-100"
          >
            {/* Engine Tabs */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Emblem" className="w-5 h-5 object-contain filter drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
                <span className="font-impact text-sm tracking-wider uppercase text-white">
                  PostgreSQL Telemetry Engine (Review-2)
                </span>
              </div>

              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
                {[
                  { id: 'acid', label: 'Atomic Transactions', icon: Zap },
                  { id: 'concurrency', label: 'Concurrency & Locks', icon: Lock },
                  { id: 'storage', label: 'Storage Architecture', icon: HardDrive },
                  { id: 'query', label: 'Query Performance', icon: GitBranch }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeDbTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        audio.playClickSound();
                        setActiveDbTab(tab.id);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono-code font-bold transition ${
                        isActive
                          ? 'bg-[#0071E3] text-white shadow-[0_0_15px_rgba(0,113,227,0.4)]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setActiveFolder('viewport')}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Tab Content */}
            <div className="flex-1 overflow-y-auto pt-3 font-mono-code text-xs">
              {activeDbTab === 'acid' && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                    <span>Write-Ahead Log (WAL) Real-time Replication Stream</span>
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      SYNCHRONOUS REPLICATION ONLINE
                    </span>
                  </div>
                  {walLogs.length === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">
                      No active transactions recorded yet. Click &quot;+1 Stock&quot; or &quot;-1 Allocate&quot; to test ACID 2PC commit protocols.
                    </p>
                  ) : (
                    walLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-[11px] border ${
                          log.status === 'committed'
                            ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                            : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[#00F0FF] font-bold">{log.lsn}</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-white font-semibold">{log.op}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-300">{log.details}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeDbTab === 'concurrency' && (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">
                    Two-Phase Locking (2PL) Lock Manager Table
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-400 pb-1 border-b border-white/10 font-bold">
                    <span>RESOURCE ID</span>
                    <span>LOCK LEVEL</span>
                    <span>OWNING TXN</span>
                    <span>GRANT STATUS</span>
                  </div>
                  {lockTable.map((lock, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-xs py-1.5 border-b border-white/5 items-center">
                      <span className="text-white font-bold">{lock.resource}</span>
                      <span className="text-amber-400">{lock.lockType}</span>
                      <span className="text-[#00F0FF]">{lock.owner}</span>
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> {lock.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeDbTab === 'storage' && (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { drive: 'NVMe-RAID-01', tier: 'Hot Memory Buffer', capacity: '1.2TB / 2.0TB', health: 'Optimal' },
                    { drive: 'NVMe-RAID-02', tier: 'WAL Journal Ring', capacity: '512GB / 1.0TB', health: 'Optimal' },
                    { drive: 'NVMe-RAID-03', tier: 'Parquet Column Store', capacity: '4.8TB / 8.0TB', health: 'Optimal' },
                    { drive: 'NVMe-RAID-04', tier: 'Cold Snapshot Replica', capacity: '12.4TB / 16.0TB', health: 'Synced' }
                  ].map((drive, i) => (
                    <div key={i} className="p-3 rounded-2xl liquid-glass-pill border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-white font-bold">{drive.drive}</span>
                        <span className="text-emerald-400 text-[9px] font-bold">{drive.health}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{drive.tier}</div>
                      <div className="text-xs font-mono-code text-[#00F0FF] pt-1">{drive.capacity}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeDbTab === 'query' && (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                    <span>EXPLAIN (ANALYZE, BUFFERS) Execution Plan</span>
                    <span className="text-cyan-400">Execution Time: 0.142 ms</span>
                  </div>
                  <pre className="p-3 rounded-2xl bg-black/60 border border-white/10 text-[#00F0FF] text-[11px] leading-relaxed">
{`-> Index Scan using idx_bom_rfid on bom_telemetry (cost=0.28..4.30 rows=1 width=128)
   Index Cond: (rfid = 'RFID-9842-A1')
   Buffers: shared hit=4 read=0
Planning Time: 0.082 ms | Execution Time: 0.142 ms`}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 7. CONFIRMATION MODAL (ACID 2PC TRANSACTION COMMIT GUARANTEE) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className={`w-full max-w-lg rounded-3xl p-6 liquid-glass border shadow-2xl text-slate-100 flex flex-col space-y-4 ${
                confirmModal.isAddition
                  ? 'border-emerald-500/30 shadow-[0_0_50px_rgba(0,245,155,0.2)]'
                  : 'border-rose-500/30 shadow-[0_0_50px_rgba(255,0,85,0.2)]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${confirmModal.isAddition ? 'bg-emerald-500/20 text-[#00F59B]' : 'bg-rose-500/20 text-[#FF0055]'}`}>
                    <img src="/logo.png" alt="Emblem" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <h3 className="font-impact text-lg tracking-wider uppercase text-white flex items-center gap-2">
                      {confirmModal.title}
                    </h3>
                    <p className="text-[10px] font-mono-code text-slate-400">
                      ACID 2PC COMMIT PROTOCOL · HIGH-DURABILITY WAL
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelTransaction}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-Header Notice / Invalid Warning */}
              {confirmModal.hasInvalid ? (
                <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 font-mono-code">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Integrity check violation: One or more components have insufficient allocation stock. Maximum allocatable limit reached.</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs font-mono-code text-slate-400 bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span>Scope: <strong className="text-white">{confirmModal.items.length} {confirmModal.items.length === 1 ? 'Component' : 'Components'}</strong></span>
                  <span className="flex items-center gap-1">
                    Delta: 
                    <strong className={`font-bold ${confirmModal.isAddition ? 'text-[#00F59B]' : 'text-[#FF0055]'}`}>
                      {confirmModal.totalDelta > 0 ? `+${confirmModal.totalDelta}` : confirmModal.totalDelta} units
                    </strong>
                  </span>
                </div>
              )}

              {/* Items List (Scrollable if multiple) */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 font-mono-code text-xs">
                {confirmModal.items.map((item) => {
                  const currStatusBg = getStatusBgClass(item.currentStatus, item.qcHold);
                  const projStatusBg = getStatusBgClass(item.projectedStatus, item.qcHold);

                  return (
                    <div
                      key={item.partId}
                      className={`p-3 rounded-2xl border transition-all ${
                        item.isInvalid
                          ? 'bg-rose-950/30 border-rose-500/50'
                          : 'bg-black/40 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-impact text-sm text-[#00F0FF]">{item.partId}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          item.qtyDelta > 0 ? 'bg-emerald-500/20 text-[#00F59B]' : 'bg-rose-500/20 text-[#FF0055]'
                        }`}>
                          {item.qtyDelta > 0 ? `+${item.qtyDelta}` : item.qtyDelta} units
                        </span>
                      </div>
                      <div className="text-white font-display text-xs font-semibold truncate mb-2">
                        {item.name}
                      </div>

                      {/* Stock & Status Transition */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span>Stock:</span>
                          <span className="text-white font-bold">{item.currentStock}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className={`font-bold ${item.isInvalid ? 'text-rose-400' : 'text-white'}`}>
                            {item.isInvalid ? `${item.projectedStock} (ILLEGAL)` : `${item.projectedStock} units`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${currStatusBg}`} />
                          <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                          <span className={`w-2 h-2 rounded-full ${projStatusBg}`} />
                          <span className="text-[10px] uppercase text-slate-400">
                            {item.projectedStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Checkbox: skip quick confirmation for single adjustments */}
              <div className="flex items-center justify-between pt-1 text-[11px] font-mono-code text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipQuickConfirm}
                    onChange={(e) => setSkipQuickConfirm(e.target.checked)}
                    className="rounded bg-black/50 border-white/20 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Skip confirmation for rapid ±1 quick taps</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 font-mono-code">
                <button
                  type="button"
                  onClick={handleCancelTransaction}
                  className="py-3 rounded-2xl liquid-glass-pill hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  CANCEL
                </button>
                <button
                  type="button"
                  disabled={confirmModal.hasInvalid}
                  onClick={handleConfirmTransaction}
                  className={`py-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                    confirmModal.hasInvalid
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                      : confirmModal.isAddition
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:opacity-95 text-black shadow-[0_0_25px_rgba(0,245,155,0.4)]'
                      : 'bg-gradient-to-r from-rose-600 to-amber-500 hover:opacity-95 text-white shadow-[0_0_25px_rgba(255,0,85,0.4)]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  CONFIRM & COMMIT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Minimal Eye icon helper
function EyeIcon(props) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
