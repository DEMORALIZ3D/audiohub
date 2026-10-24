import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { usePlayer } from '../context/PlayerContext';
import { WebGLCanvas } from './WebGLCanvas';

export type CameraPreset = 'turntable' | 'macro' | 'overhead';
export type TurntableEnvironment = 'lounge' | 'neon' | 'sunset' | 'studio' | 'minimal';

export interface VinylVisualizerProps {
  mode?: 'vinyl_only' | 'turntable';
  cameraPreset?: CameraPreset;
  environment?: TurntableEnvironment;
  onCameraPresetChange?: (preset: CameraPreset) => void;
  className?: string;
}

// Procedural rich walnut wood grain texture for credenza console
function createWalnutWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base warm rich dark walnut
    ctx.fillStyle = '#26160c';
    ctx.fillRect(0, 0, 1024, 512);

    // Flowing organic wood grain lines
    for (let y = 0; y < 512; y += 3) {
      const alpha = 0.12 + Math.random() * 0.18;
      const shade = Math.sin(y * 0.08) * 18 + Math.cos(y * 0.03) * 12;
      const r = Math.floor(Math.max(20, Math.min(65, 48 + shade)));
      const g = Math.floor(Math.max(12, Math.min(45, 28 + shade * 0.6)));
      const b = Math.floor(Math.max(8, Math.min(30, 16 + shade * 0.4)));

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 2 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        256,
        y + Math.sin(y * 0.02) * 15,
        768,
        y - Math.cos(y * 0.02) * 15,
        1024,
        y,
      );
      ctx.stroke();
    }

    // Subtle satin varnish sheen overlay
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(255, 220, 180, 0.06)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.04)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Procedural blonde Scandinavian oak texture
function createBlondeOakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#8f7356';
    ctx.fillRect(0, 0, 1024, 512);

    for (let y = 0; y < 512; y += 3) {
      const alpha = 0.15 + Math.random() * 0.15;
      const shade = Math.sin(y * 0.06) * 15;
      ctx.strokeStyle = `rgba(${Math.floor(125 + shade)}, ${Math.floor(100 + shade * 0.8)}, ${Math.floor(75 + shade * 0.6)}, ${alpha})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y + Math.sin(y * 0.03) * 6);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Fallback high-resolution vinyl label texture when track cover is unavailable or loading
function createFallbackLabelTexture(
  title: string,
  artist: string,
  accentColor: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(512, 512, 60, 512, 512, 512);
    grad.addColorStop(0, accentColor || '#b45309');
    grad.addColorStop(0.72, '#201c18');
    grad.addColorStop(0.96, '#121110');
    grad.addColorStop(1, '#080808');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(512, 512, 512, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(235, 200, 120, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(512, 512, 480, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(235, 200, 120, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(512, 512, 360, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('AUDIOHUB HI-FI', 512, 310);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(240, 210, 140, 0.85)';
    ctx.fillText('33⅓ RPM • MICROGROOVE STEREO • AUDIOPHILE PRESSING', 512, 350);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const displayTitle = title
      ? title.length > 22
        ? title.substring(0, 20) + '…'
        : title
      : 'AudioHub Wax';
    ctx.fillText(displayTitle, 512, 680);

    ctx.font = '30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    const displayArtist = artist
      ? artist.length > 26
        ? artist.substring(0, 24) + '…'
        : artist
      : 'Collector Series';
    ctx.fillText(displayArtist, 512, 730);

    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('MATRIX: AH-2026-A1 • DIRECT METAL MASTER', 512, 790);

    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.arc(512, 512, 48, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Generate circular texture from cover image for the vinyl center sticker
function createAlbumLabelTexture(
  img: HTMLImageElement,
  title: string,
  artist: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.save();
  ctx.beginPath();
  ctx.arc(512, 512, 512, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 0, 0, 1024, 1024);

  const vignette = ctx.createRadialGradient(512, 512, 300, 512, 512, 512);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.85, 'rgba(0,0,0,0.4)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = 'rgba(235, 210, 130, 0.75)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(512, 512, 506, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(10, 10, 12, 0.65)';
  ctx.beginPath();
  ctx.arc(512, 512, 508, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const displayTitle = title ? (title.length > 24 ? title.substring(0, 22) + '…' : title) : '';
  ctx.fillText(displayTitle, 512, 700);

  ctx.font = '26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  const displayArtist = artist ? (artist.length > 28 ? artist.substring(0, 26) + '…' : artist) : '';
  ctx.fillText(displayArtist, 512, 745);

  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = 'rgba(240, 210, 140, 0.9)';
  ctx.fillText('AUDIOHUB 33⅓ RPM STEREO', 512, 790);

  ctx.fillStyle = '#060608';
  ctx.beginPath();
  ctx.arc(512, 512, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// GLSL Vertex Shader for Anisotropic Vinyl Disc
const VINYL_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vec4 mvPosition = viewMatrix * worldPosition;
  vViewPosition = -mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}
`;

// GLSL Fragment Shader: Physical Anisotropic Microgrooves with Bowtie Specular and Iridescence
const VINYL_FRAGMENT_SHADER = `
uniform sampler2D uLabelTexture;
uniform float uBass;
uniform float uEnergy;
uniform vec3 uAccentColor;
uniform vec3 uLightPos;
uniform vec3 uStylusLightPos;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

void main() {
  vec2 p = vUv - vec2(0.5);
  float r = length(p) * 2.0;
  float theta = atan(p.y, p.x);

  if (r < 0.045) {
    gl_FragColor = vec4(0.06, 0.06, 0.07, 1.0);
    return;
  }

  if (r < 0.355) {
    vec2 labelUv = (p / 0.355) * 0.5 + vec2(0.5);
    vec4 labelColor = texture2D(uLabelTexture, labelUv);
    float edgeFactor = smoothstep(0.35, 0.355, r);
    vec3 col = mix(labelColor.rgb, vec3(0.03), edgeFactor * 0.7);

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightPos - vWorldPosition);
    float diff = max(dot(N, L), 0.3);
    gl_FragColor = vec4(col * (diff * 0.75 + 0.25), 1.0);
    return;
  }

  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);

  vec2 dir = normalize(p);
  vec3 T = normalize(vec3(-dir.y, 0.0, dir.x));

  float isMusicZone = smoothstep(0.42, 0.44, r) * (1.0 - smoothstep(0.965, 0.985, r));
  float grooveFreq = 2600.0;
  float microWobble = sin(r * 220.0 + theta * 4.0) * 1.8 + (uBass * 1.4 * sin(r * 1200.0));
  float groove = sin(r * grooveFreq + microWobble) * 0.5 + 0.5;

  float gap1 = 1.0 - smoothstep(0.003, 0.009, abs(r - 0.56));
  float gap2 = 1.0 - smoothstep(0.003, 0.009, abs(r - 0.70));
  float gap3 = 1.0 - smoothstep(0.003, 0.009, abs(r - 0.83));
  float gaps = max(gap1, max(gap2, gap3));

  float runoutZone = smoothstep(0.355, 0.375, r) * (1.0 - smoothstep(0.42, 0.43, r));
  float spiralTheta = mod(theta + (r - 0.355) * 80.0, 6.2831853);
  float spiralGroove = 1.0 - smoothstep(0.02, 0.12, abs(spiralTheta - 3.14159));

  vec3 L1 = normalize(uLightPos - vWorldPosition);
  vec3 H1 = normalize(L1 + V);
  float dotT1 = dot(H1, T);
  float aniso1 = pow(sqrt(max(0.0, 1.0 - dotT1 * dotT1)), 44.0);

  vec3 L2 = normalize(uStylusLightPos - vWorldPosition);
  vec3 H2 = normalize(L2 + V);
  float dotT2 = dot(H2, T);
  float aniso2 = pow(sqrt(max(0.0, 1.0 - dotT2 * dotT2)), 32.0) * 1.5;

  // Natural realistic vinyl specular sheen - clean warm silver & champagne highlights without rainbow chromatic distraction
  vec3 specColor1 = vec3(0.96, 0.95, 0.93) * aniso1;
  vec3 specColor2 = vec3(0.90, 0.86, 0.80) * aniso2 * 0.75;

  vec3 baseVinyl = vec3(0.040, 0.042, 0.046);
  float grooveShimmer = mix(0.78, 1.22, groove);
  if (isMusicZone > 0.05) {
    baseVinyl *= mix(1.0, grooveShimmer, isMusicZone * (1.0 - gaps * 0.8));
  }
  
  if (runoutZone > 0.1) {
    specColor1 *= 1.25;
    baseVinyl = mix(baseVinyl, vec3(0.024, 0.025, 0.028), runoutZone * (1.0 - spiralGroove * 0.45));
  }

  float audioBrilliance = 1.0 + uBass * 0.20;
  vec3 finalColor = baseVinyl + (specColor1 * 1.15 + specColor2 * 0.85) * audioBrilliance;

  float outerBevel = smoothstep(0.98, 1.0, r);
  finalColor = mix(finalColor, vec3(0.012), outerBevel * 0.85);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// Helper to dispose an entire Three.js subtree cleanly
function disposeThreeNode(node: THREE.Object3D) {
  for (let i = node.children.length - 1; i >= 0; i--) {
    disposeThreeNode(node.children[i]);
  }
  if ((node as THREE.Mesh).geometry) {
    (node as THREE.Mesh).geometry.dispose();
  }
  if ((node as THREE.Mesh).material) {
    const mat = (node as THREE.Mesh).material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => {
        if ((m as any).map) (m as any).map.dispose();
        m.dispose();
      });
    } else {
      if ((mat as any).map) (mat as any).map.dispose();
      mat.dispose();
    }
  }
}

export const VinylVisualizer: React.FC<VinylVisualizerProps> = ({
  mode = 'turntable',
  cameraPreset: externalCameraPreset,
  environment = 'lounge',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { currentTrack, isPlaying, currentTime, duration, getAudioMetrics, currentPalette } =
    usePlayer();

  const [initError, setInitError] = useState(false);
  const [internalPreset] = useState<CameraPreset>(mode === 'vinyl_only' ? 'macro' : 'turntable');
  const activePreset = externalCameraPreset || internalPreset;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const durationRef = useRef(duration);
  durationRef.current = duration;

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  const currentPaletteRef = useRef(currentPalette);
  currentPaletteRef.current = currentPalette;

  const getAudioMetricsRef = useRef(getAudioMetrics);
  getAudioMetricsRef.current = getAudioMetrics;

  const cameraPresetRef = useRef(activePreset);
  cameraPresetRef.current = activePreset;

  const envRef = useRef(environment);
  envRef.current = environment;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDisposed = false;
    let isContextLost = false;
    let animationFrameId: number;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);

    // 2. High-performance WebGL Renderer with safe context initialization
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x0a0a0d, 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.4;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch (e) {
      console.warn('VinylVisualizer: Failed to create WebGL context:', e);
      setInitError(true);
      return;
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      cancelAnimationFrame(animationFrameId);
      console.warn('VinylVisualizer: WebGL context lost.');
    };

    const handleContextRestored = () => {
      isContextLost = false;
      console.info('VinylVisualizer: WebGL context restored.');
    };

    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    // 3. Dynamic Global Illumination (GI) & Environment Lighting Rig
    // A. Hemisphere Light for realistic ambient sky & ground bounce illumination
    const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x3d281a, 1.85);
    hemiLight.position.set(0, 15, 0);
    scene.add(hemiLight);

    // B. Base Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    // C. Key Spotlight (Direct overhead/angled beam)
    const keySpotLight = new THREE.SpotLight(0xffffff, 15, 40, Math.PI / 3.8, 0.4);
    keySpotLight.position.set(3.5, 9.5, 4.2);
    keySpotLight.castShadow = true;
    keySpotLight.shadow.mapSize.width = 1024;
    keySpotLight.shadow.mapSize.height = 1024;
    keySpotLight.shadow.bias = -0.0001;
    scene.add(keySpotLight);

    // D. Dynamic Palette Tinted Rim Light
    const rimLight = new THREE.SpotLight(
      new THREE.Color(currentPalette.accent || '#1db954'),
      13,
      30,
      Math.PI / 3,
      0.6,
    );
    rimLight.position.set(-5, 4, -4);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // E. Primary Soft Fill Light (Left Front)
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.35);
    fillLight.position.set(-2, 5, 4.5);
    scene.add(fillLight);

    // F. Secondary Soft Fill Light (Right Rear) - prevents dark void on the tonearm side
    const secondaryFillLight = new THREE.DirectionalLight(0xfff3e0, 1.15);
    secondaryFillLight.position.set(4.5, 4.0, -2.5);
    scene.add(secondaryFillLight);

    // G. Soft Under-Table / Lower Credenza Bounce Light (simulates floor bounce)
    const underGlowLight = new THREE.PointLight(0xff7722, 2.0, 9.0);
    underGlowLight.position.set(0, -1.3, 0);
    scene.add(underGlowLight);

    // H. Pop-Up Stylus Target Lamp
    const stylusLampLight = new THREE.PointLight(0xffe8b4, 3.5, 6.0, 1.2);
    stylusLampLight.position.set(-2.0, 0.65, -1.25);
    scene.add(stylusLampLight);

    // I. Wall Wash Accent Light (Illuminates acoustic slats & back wall)
    const wallWashLight = new THREE.PointLight(0xffa24c, 3.2, 12);
    wallWashLight.position.set(0, 4.5, -3.8);
    scene.add(wallWashLight);

    // 4. Procedural Textures Cache for Clean Disposal
    const walnutTex = createWalnutWoodTexture();
    const oakTex = createBlondeOakTexture();

    // --- 3D ENVIRONMENT SCENERY (Credenza, Acoustic Slat Wall & Tube Amp) ---
    const envGroup = new THREE.Group();
    scene.add(envGroup);

    // 1. Audiophile Furniture Credenza (Console Table under turntable)
    const credenzaWidth = 7.8;
    const credenzaDepth = 5.0;
    const credenzaTopThick = 0.22;

    const credenzaTopGeo = new THREE.BoxGeometry(credenzaWidth, credenzaTopThick, credenzaDepth);
    const credenzaMat = new THREE.MeshStandardMaterial({
      color: 0x3d2719,
      map: walnutTex,
      roughness: 0.45,
      metalness: 0.1,
    });
    const credenzaTop = new THREE.Mesh(credenzaTopGeo, credenzaMat);
    credenzaTop.position.set(0, -0.42, 0);
    credenzaTop.receiveShadow = true;
    credenzaTop.castShadow = true;
    envGroup.add(credenzaTop);

    // Credenza Metal Bracket Edge Trim
    const credenzaTrimGeo = new THREE.BoxGeometry(credenzaWidth + 0.04, 0.04, credenzaDepth + 0.04);
    const credenzaTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1f1f22,
      metalness: 0.9,
      roughness: 0.3,
    });
    const credenzaTrim = new THREE.Mesh(credenzaTrimGeo, credenzaTrimMat);
    credenzaTrim.position.set(0, -0.42 + credenzaTopThick / 2, 0);
    envGroup.add(credenzaTrim);

    // Credenza Anodized Black Metal Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.08, 4.0, 16);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.85,
      roughness: 0.3,
    });
    const legOffsets = [
      [-credenzaWidth / 2 + 0.45, -credenzaDepth / 2 + 0.45],
      [credenzaWidth / 2 - 0.45, -credenzaDepth / 2 + 0.45],
      [-credenzaWidth / 2 + 0.45, credenzaDepth / 2 - 0.45],
      [credenzaWidth / 2 - 0.45, credenzaDepth / 2 - 0.45],
    ];
    for (const [lx, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, -2.4, lz);
      envGroup.add(leg);
    }

    // Lower Shelf with Vinyl Record Spines & Tube Amp
    const lowerShelfGeo = new THREE.BoxGeometry(credenzaWidth - 0.6, 0.12, credenzaDepth - 0.4);
    const lowerShelf = new THREE.Mesh(lowerShelfGeo, credenzaMat);
    lowerShelf.position.set(0, -1.8, 0);
    envGroup.add(lowerShelf);

    // Glowing Tube Amplifier on Lower Shelf
    const ampChassisGeo = new THREE.BoxGeometry(2.4, 0.32, 1.6);
    const ampChassisMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1e,
      metalness: 0.95,
      roughness: 0.25,
    });
    const ampChassis = new THREE.Mesh(ampChassisGeo, ampChassisMat);
    ampChassis.position.set(1.6, -1.6, 0);
    envGroup.add(ampChassis);

    // Vacuum Tubes with glowing warm filaments
    const tubeBulbGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.48, 16);
    const tubeGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      transmission: 0.9,
    });
    const tubeFilamentMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });

    const tubeLights: THREE.PointLight[] = [];
    for (let t = 0; t < 3; t++) {
      const tubeBulb = new THREE.Mesh(tubeBulbGeo, tubeGlassMat);
      tubeBulb.position.set(1.0 + t * 0.6, -1.25, 0);
      envGroup.add(tubeBulb);

      const filamentGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8);
      const filament = new THREE.Mesh(filamentGeo, tubeFilamentMat);
      filament.position.set(1.0 + t * 0.6, -1.25, 0);
      envGroup.add(filament);

      const tLight = new THREE.PointLight(0xff6600, 1.8, 3.5);
      tLight.position.set(1.0 + t * 0.6, -1.2, 0);
      envGroup.add(tLight);
      tubeLights.push(tLight);
    }

    // 2. Back Wall Architectural Elements (Vertical Acoustic Slats)
    const wallGroup = new THREE.Group();
    wallGroup.position.set(0, 2.0, -4.5);
    envGroup.add(wallGroup);

    // Acoustic Felt Backing Board (subtle warm charcoal with soft light acceptance)
    const wallBackingGeo = new THREE.PlaneGeometry(24, 14);
    const wallBackingMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.9 });
    const wallBacking = new THREE.Mesh(wallBackingGeo, wallBackingMat);
    wallGroup.add(wallBacking);

    // Vertical Acoustic Wooden Slats
    const slatGeo = new THREE.BoxGeometry(0.14, 12, 0.12);
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0x3d2719,
      map: walnutTex,
      roughness: 0.45,
    });

    const slatMeshes: THREE.Mesh[] = [];
    for (let x = -10; x <= 10; x += 0.34) {
      const slat = new THREE.Mesh(slatGeo, slatMat);
      slat.position.set(x, 0, 0.06);
      slat.castShadow = true;
      slat.receiveShadow = true;
      wallGroup.add(slat);
      slatMeshes.push(slat);
    }

    // Ground Studio Floor (richer slate/wood floor receiving ambient bounce)
    const floorGeo = new THREE.PlaneGeometry(35, 35);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x18181f,
      roughness: 0.4,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -3.8;
    floorMesh.receiveShadow = true;
    envGroup.add(floorMesh);

    // 5. Main Turntable Assembly Hierarchy
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // --- TURNTABLE BASE & CHASSIS ---
    const plinthWidth = 5.5;
    const plinthDepth = 4.3;
    const plinthHeight = 0.42;

    const baseGeo = new THREE.BoxGeometry(plinthWidth, plinthHeight, plinthDepth);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1b1c20,
      roughness: 0.65,
      metalness: 0.25,
    });
    const plinthBase = new THREE.Mesh(baseGeo, baseMat);
    plinthBase.position.y = 0.0;
    plinthBase.castShadow = true;
    plinthBase.receiveShadow = true;
    mainGroup.add(plinthBase);

    // Brushed Dark Gunmetal Deck Top Plate
    const deckPlateGeo = new THREE.BoxGeometry(plinthWidth - 0.08, 0.04, plinthDepth - 0.08);
    const deckPlateMat = new THREE.MeshStandardMaterial({
      color: 0x22242a,
      metalness: 0.88,
      roughness: 0.32,
    });
    const deckPlate = new THREE.Mesh(deckPlateGeo, deckPlateMat);
    deckPlate.position.y = plinthHeight / 2 + 0.02;
    deckPlate.receiveShadow = true;
    mainGroup.add(deckPlate);

    // 4 Chrome Isolation Dampener Feet with Rubber Base
    const footGeo = new THREE.CylinderGeometry(0.32, 0.28, 0.22, 28);
    const footMat = new THREE.MeshStandardMaterial({
      color: 0x333338,
      metalness: 0.85,
      roughness: 0.25,
    });
    const footPositions = [
      [-plinthWidth / 2 + 0.48, -plinthHeight / 2 - 0.1, -plinthDepth / 2 + 0.48],
      [plinthWidth / 2 - 0.48, -plinthHeight / 2 - 0.1, -plinthDepth / 2 + 0.48],
      [-plinthWidth / 2 + 0.48, -plinthHeight / 2 - 0.1, plinthDepth / 2 - 0.48],
      [plinthWidth / 2 - 0.48, -plinthHeight / 2 - 0.1, plinthDepth / 2 - 0.48],
    ];
    for (const [fx, fy, fz] of footPositions) {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(fx, fy, fz);
      foot.castShadow = true;
      mainGroup.add(foot);
    }

    // --- HEAVY DIE-CAST ALUMINUM PLATTER ---
    const platterCenterX = -0.65;
    const platterCenterZ = 0.0;
    const platterRadius = 1.86;
    const platterHeight = 0.22;

    const platterGeo = new THREE.CylinderGeometry(platterRadius, platterRadius, platterHeight, 64);
    const platterMat = new THREE.MeshStandardMaterial({
      color: 0xc4c7cc,
      metalness: 0.94,
      roughness: 0.22,
    });
    const platter = new THREE.Mesh(platterGeo, platterMat);
    platter.position.set(
      platterCenterX,
      plinthHeight / 2 + platterHeight / 2 + 0.03,
      platterCenterZ,
    );
    platter.castShadow = true;
    platter.receiveShadow = true;
    mainGroup.add(platter);

    // 4 Rows of Strobe Dots on Platter Rim
    const strobeRingsGroup = new THREE.Group();
    for (let r = 0; r < 4; r++) {
      const ringGeo = new THREE.TorusGeometry(platterRadius - 0.01, 0.012, 6, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: r % 2 === 0 ? 0x222226 : 0xd8d8de,
        metalness: 0.9,
        roughness: 0.3,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = -platterHeight / 2 + 0.04 + r * 0.045;
      strobeRingsGroup.add(ringMesh);
    }
    platter.add(strobeRingsGroup);

    // Heavy Rubber / Felt Slipmat
    const slipmatRadius = 1.78;
    const slipmatGeo = new THREE.CylinderGeometry(slipmatRadius, slipmatRadius, 0.03, 64);
    const slipmatMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.95,
      metalness: 0.05,
    });
    const slipmat = new THREE.Mesh(slipmatGeo, slipmatMat);
    slipmat.position.set(platterCenterX, plinthHeight / 2 + platterHeight + 0.045, platterCenterZ);
    slipmat.receiveShadow = true;
    mainGroup.add(slipmat);

    // --- REVOLVING RECORD GROUP ---
    const recordGroup = new THREE.Group();
    const vinylSurfaceY = plinthHeight / 2 + platterHeight + 0.06;
    recordGroup.position.set(platterCenterX, vinylSurfaceY, platterCenterZ);
    mainGroup.add(recordGroup);

    // Center Spindle Pin (Brass / Chrome)
    const spindleGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.32, 24);
    const spindleMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      metalness: 0.95,
      roughness: 0.15,
    });
    const spindle = new THREE.Mesh(spindleGeo, spindleMat);
    spindle.position.y = 0.12;
    recordGroup.add(spindle);

    // 12" Vinyl Disc Top Face with Custom Anisotropic Shader
    const vinylRadius = 1.74;
    const initialLabelTex = createFallbackLabelTexture(
      currentTrack?.title || '',
      currentTrack?.artist || '',
      currentPalette.primary || currentPalette.accent || '#b45309',
    );

    const vinylShaderUniforms = {
      uLabelTexture: { value: initialLabelTex },
      uBass: { value: 0.0 },
      uEnergy: { value: 0.0 },
      uAccentColor: { value: new THREE.Color(currentPalette.accent || '#1db954') },
      uLightPos: { value: new THREE.Vector3(3.5, 9.5, 4.2) },
      uStylusLightPos: { value: new THREE.Vector3(-2.0, 0.65, -1.25) },
    };

    const vinylShaderMat = new THREE.ShaderMaterial({
      vertexShader: VINYL_VERTEX_SHADER,
      fragmentShader: VINYL_FRAGMENT_SHADER,
      uniforms: vinylShaderUniforms,
      side: THREE.FrontSide,
    });

    const vinylTopGeo = new THREE.CircleGeometry(vinylRadius, 128);
    const vinylTopMesh = new THREE.Mesh(vinylTopGeo, vinylShaderMat);
    vinylTopMesh.rotation.x = -Math.PI / 2;
    vinylTopMesh.position.y = 0.018;
    recordGroup.add(vinylTopMesh);

    const vinylBodyGeo = new THREE.CylinderGeometry(vinylRadius, vinylRadius, 0.035, 64);
    const vinylBodyMat = new THREE.MeshStandardMaterial({
      color: 0x08080a,
      roughness: 0.5,
      metalness: 0.6,
    });
    const vinylBody = new THREE.Mesh(vinylBodyGeo, vinylBodyMat);
    vinylBody.position.y = 0.0;
    vinylBody.castShadow = true;
    recordGroup.add(vinylBody);

    // Dynamic Label Update
    let currentTexture: THREE.Texture = initialLabelTex;

    const updateVinylLabel = (coverUrl?: string, title = '', artist = '', accent = '#b45309') => {
      if (isDisposed) return;
      if (!coverUrl) {
        try {
          const fallbackTex = createFallbackLabelTexture(title, artist, accent);
          vinylShaderUniforms.uLabelTexture.value = fallbackTex;
          if (currentTexture !== initialLabelTex) currentTexture.dispose();
          currentTexture = fallbackTex;
        } catch (e) {}
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (isDisposed) return;
        try {
          const newTex = createAlbumLabelTexture(img, title, artist);
          vinylShaderUniforms.uLabelTexture.value = newTex;
          if (currentTexture !== initialLabelTex) currentTexture.dispose();
          currentTexture = newTex;
        } catch (e) {
          console.warn('Failed to create album label texture, falling back:', e);
          try {
            const fallbackTex = createFallbackLabelTexture(title, artist, accent);
            vinylShaderUniforms.uLabelTexture.value = fallbackTex;
            if (currentTexture !== initialLabelTex) currentTexture.dispose();
            currentTexture = fallbackTex;
          } catch (err) {}
        }
      };
      img.onerror = () => {
        if (isDisposed) return;
        try {
          const fallbackTex = createFallbackLabelTexture(title, artist, accent);
          vinylShaderUniforms.uLabelTexture.value = fallbackTex;
          if (currentTexture !== initialLabelTex) currentTexture.dispose();
          currentTexture = fallbackTex;
        } catch (e) {}
      };
      img.src = coverUrl;
    };

    if (currentTrack?.cover_url) {
      updateVinylLabel(
        currentTrack.cover_url,
        currentTrack.title,
        currentTrack.artist,
        currentPalette.primary || currentPalette.accent,
      );
    }

    // --- DECK CONTROLS & DETAILS ---
    // 1. Rotary Power Switch
    const pwrBaseGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.15, 24);
    const pwrBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1e,
      metalness: 0.9,
      roughness: 0.3,
    });
    const pwrBase = new THREE.Mesh(pwrBaseGeo, pwrBaseMat);
    pwrBase.position.set(-plinthWidth / 2 + 0.55, plinthHeight / 2 + 0.1, plinthDepth / 2 - 0.6);
    mainGroup.add(pwrBase);

    const pwrLedGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16);
    const pwrLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const pwrLed = new THREE.Mesh(pwrLedGeo, pwrLedMat);
    pwrLed.position.set(-plinthWidth / 2 + 0.55, plinthHeight / 2 + 0.18, plinthDepth / 2 - 0.6);
    mainGroup.add(pwrLed);

    // 2. Start / Stop Button
    const btnGeo = new THREE.BoxGeometry(0.5, 0.12, 0.38);
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0xd2d4d8,
      metalness: 0.92,
      roughness: 0.22,
    });
    const startBtn = new THREE.Mesh(btnGeo, btnMat);
    startBtn.position.set(-plinthWidth / 2 + 1.25, plinthHeight / 2 + 0.08, plinthDepth / 2 - 0.6);
    mainGroup.add(startBtn);

    // 3. 33 / 45 RPM Speed Select Buttons
    const speedBtnGeo = new THREE.BoxGeometry(0.22, 0.08, 0.16);
    const speedBtn33 = new THREE.Mesh(speedBtnGeo, btnMat);
    speedBtn33.position.set(
      -plinthWidth / 2 + 1.7,
      plinthHeight / 2 + 0.06,
      plinthDepth / 2 - 0.68,
    );
    mainGroup.add(speedBtn33);

    const speedBtn45 = new THREE.Mesh(speedBtnGeo, btnMat);
    speedBtn45.position.set(
      -plinthWidth / 2 + 1.7,
      plinthHeight / 2 + 0.06,
      plinthDepth / 2 - 0.48,
    );
    mainGroup.add(speedBtn45);

    const speedLedGeo = new THREE.CircleGeometry(0.025, 12);
    const speedLedMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const speedLed = new THREE.Mesh(speedLedGeo, speedLedMat);
    speedLed.rotation.x = -Math.PI / 2;
    speedLed.position.set(-plinthWidth / 2 + 1.7, plinthHeight / 2 + 0.11, plinthDepth / 2 - 0.68);
    mainGroup.add(speedLed);

    // 4. Precision Pitch Fader
    const faderSlotGeo = new THREE.BoxGeometry(0.24, 0.02, 1.4);
    const faderSlotMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.9 });
    const faderSlot = new THREE.Mesh(faderSlotGeo, faderSlotMat);
    faderSlot.position.set(plinthWidth / 2 - 0.55, plinthHeight / 2 + 0.04, 0.5);
    mainGroup.add(faderSlot);

    const faderHandleGeo = new THREE.BoxGeometry(0.18, 0.14, 0.12);
    const faderHandleMat = new THREE.MeshStandardMaterial({
      color: 0xe0e2e6,
      metalness: 0.95,
      roughness: 0.18,
    });
    const faderHandle = new THREE.Mesh(faderHandleGeo, faderHandleMat);
    faderHandle.position.set(plinthWidth / 2 - 0.55, plinthHeight / 2 + 0.1, 0.5);
    mainGroup.add(faderHandle);

    const qtzLedGeo = new THREE.CircleGeometry(0.028, 12);
    const qtzLedMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const qtzLed = new THREE.Mesh(qtzLedGeo, qtzLedMat);
    qtzLed.rotation.x = -Math.PI / 2;
    qtzLed.position.set(plinthWidth / 2 - 0.55, plinthHeight / 2 + 0.055, -0.3);
    mainGroup.add(qtzLed);

    // 5. Pop-Up Stylus Target Light Tower
    const lampTowerGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.55, 20);
    const lampTowerMat = new THREE.MeshStandardMaterial({
      color: 0xc8cacc,
      metalness: 0.92,
      roughness: 0.25,
    });
    const lampTower = new THREE.Mesh(lampTowerGeo, lampTowerMat);
    lampTower.position.set(
      -plinthWidth / 2 + 0.55,
      plinthHeight / 2 + 0.28,
      -plinthDepth / 2 + 0.7,
    );
    mainGroup.add(lampTower);

    // 6. AudioHub Hi-Fi Brand Badge
    const badgeGeo = new THREE.BoxGeometry(1.2, 0.02, 0.32);
    const badgeMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25,
    });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(-plinthWidth / 2 + 1.25, plinthHeight / 2 + 0.045, -plinthDepth / 2 + 0.65);
    mainGroup.add(badge);

    // --- HIGH-PRECISION TONEARM ASSEMBLY ---
    const armPivotX = 1.85;
    const armPivotZ = -1.15;
    const armBaseY = plinthHeight / 2 + 0.05;

    const armBaseGroup = new THREE.Group();
    armBaseGroup.position.set(armPivotX, armBaseY, armPivotZ);
    mainGroup.add(armBaseGroup);

    // Gimbal Base Housing
    const gimbalBaseGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.42, 32);
    const gimbalBaseMat = new THREE.MeshStandardMaterial({
      color: 0x222428,
      metalness: 0.9,
      roughness: 0.3,
    });
    const gimbalBase = new THREE.Mesh(gimbalBaseGeo, gimbalBaseMat);
    gimbalBase.position.y = 0.21;
    armBaseGroup.add(gimbalBase);

    // Anti-skate dial knob
    const antiSkateGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16);
    const antiSkateMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.5 });
    const antiSkate = new THREE.Mesh(antiSkateGeo, antiSkateMat);
    antiSkate.position.set(0.32, 0.38, 0.22);
    armBaseGroup.add(antiSkate);

    // Tonearm Rest Post & Clip (Located under wand at parked angle)
    const restPostGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.55, 16);
    const restPostMat = new THREE.MeshStandardMaterial({ color: 0x333338, metalness: 0.8 });
    const restPost = new THREE.Mesh(restPostGeo, restPostMat);
    restPost.position.set(-0.85, 0.28, -0.27);
    armBaseGroup.add(restPost);

    // Rotating Arm Segment
    const armSegment = new THREE.Group();
    armSegment.position.y = 0.48;
    armBaseGroup.add(armSegment);

    // Gimbal Ring
    const gimbalRingGeo = new THREE.TorusGeometry(0.22, 0.045, 16, 32);
    const gimbalRingMat = new THREE.MeshStandardMaterial({
      color: 0xd2d4d8,
      metalness: 0.96,
      roughness: 0.15,
    });
    const gimbalRing = new THREE.Mesh(gimbalRingGeo, gimbalRingMat);
    gimbalRing.rotation.y = Math.PI / 2;
    armSegment.add(gimbalRing);

    // Counterweight
    const weightGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.32, 32);
    const weightMat = new THREE.MeshStandardMaterial({
      color: 0x18181c,
      metalness: 0.9,
      roughness: 0.3,
    });
    const counterweight = new THREE.Mesh(weightGeo, weightMat);
    counterweight.rotation.z = Math.PI / 2;
    counterweight.position.set(0.68, 0.0, 0.0);
    armSegment.add(counterweight);

    // Numbered dial ring
    const weightRingGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.1, 32);
    const weightRingMat = new THREE.MeshStandardMaterial({
      color: 0xc4c7cc,
      metalness: 0.95,
      roughness: 0.2,
    });
    const weightRing = new THREE.Mesh(weightRingGeo, weightRingMat);
    weightRing.rotation.z = Math.PI / 2;
    weightRing.position.set(0.55, 0.0, 0.0);
    armSegment.add(weightRing);

    // S-shaped Tonearm Tube
    const armLength = 2.95;
    const curvePoints = [
      new THREE.Vector3(0.0, 0.0, 0.0),
      new THREE.Vector3(-0.6, 0.02, 0.08),
      new THREE.Vector3(-1.4, 0.04, -0.05),
      new THREE.Vector3(-2.2, 0.01, 0.06),
      new THREE.Vector3(-armLength, -0.04, 0.0),
    ];
    const armCurve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(armCurve, 32, 0.042, 16, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xdedfe2,
      metalness: 0.98,
      roughness: 0.12,
    });
    const armTube = new THREE.Mesh(tubeGeo, tubeMat);
    armSegment.add(armTube);

    // Cueing Lever
    const cueLeverGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 12);
    const cueLeverMat = new THREE.MeshStandardMaterial({ color: 0x111114, metalness: 0.9 });
    const cueLever = new THREE.Mesh(cueLeverGeo, cueLeverMat);
    cueLever.position.set(-0.25, 0.15, 0.18);
    armSegment.add(cueLever);

    // Headshell
    const headshellGeo = new THREE.BoxGeometry(0.52, 0.15, 0.26);
    const headshellMat = new THREE.MeshStandardMaterial({
      color: 0x18181c,
      metalness: 0.85,
      roughness: 0.35,
    });
    const headshell = new THREE.Mesh(headshellGeo, headshellMat);
    headshell.position.set(-armLength - 0.24, -0.04, 0.0);
    headshell.rotation.y = -Math.PI / 10;
    armSegment.add(headshell);

    // Chrome Finger Lift
    const fingerLiftGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.26, 8);
    const fingerLiftMat = new THREE.MeshStandardMaterial({ color: 0xd8d8de, metalness: 0.95 });
    const fingerLift = new THREE.Mesh(fingerLiftGeo, fingerLiftMat);
    fingerLift.rotation.z = Math.PI / 3;
    fingerLift.position.set(-armLength - 0.12, 0.1, 0.16);
    armSegment.add(fingerLift);

    // Ortofon Red Cartridge Body
    const cartGeo = new THREE.BoxGeometry(0.28, 0.14, 0.2);
    const cartMat = new THREE.MeshStandardMaterial({
      color: 0xdf2828,
      metalness: 0.2,
      roughness: 0.3,
    });
    const cart = new THREE.Mesh(cartGeo, cartMat);
    cart.position.set(0.02, -0.11, 0.0);
    headshell.add(cart);

    // Stylus Nose / Front Housing
    const stylusNoseGeo = new THREE.BoxGeometry(0.08, 0.08, 0.14);
    const stylusNoseMat = new THREE.MeshStandardMaterial({
      color: 0xbf1f1f,
      metalness: 0.3,
      roughness: 0.4,
    });
    const stylusNose = new THREE.Mesh(stylusNoseGeo, stylusNoseMat);
    stylusNose.position.set(-0.11, -0.04, 0.0);
    cart.add(stylusNose);

    // Cantilever Rod (Tubular aluminum suspension extending forward-downward from cartridge nose)
    const cantileverGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.09, 8);
    const cantileverMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8de,
      metalness: 0.95,
      roughness: 0.2,
    });
    const cantilever = new THREE.Mesh(cantileverGeo, cantileverMat);
    cantilever.rotation.z = Math.PI / 4.5;
    cantilever.position.set(-0.125, -0.085, 0.0);
    cart.add(cantilever);

    // Micro Diamond Stylus Tip (Mounted at the lower end of the cantilever pointing down into record groove)
    const stylusGeo = new THREE.ConeGeometry(0.015, 0.045, 8);
    const stylusMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.95,
      roughness: 0.05,
    });
    const stylusNeedle = new THREE.Mesh(stylusGeo, stylusMat);
    stylusNeedle.rotation.z = Math.PI;
    stylusNeedle.position.set(-0.155, -0.12, 0.0);
    cart.add(stylusNeedle);

    // Tracking Constants
    const ARM_REST_ANGLE = -0.32;
    const ARM_START_ANGLE = -0.08;
    const ARM_END_ANGLE = 0.22;

    let armCurrentAngle = ARM_REST_ANGLE;
    let armCurrentY = 0.56;

    let currentRPM = 0;
    const TARGET_RPM = 0.024;

    const currentCameraPos = new THREE.Vector3(0, 5, 10);
    const currentCameraLook = new THREE.Vector3(0, 0, 0);

    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetParallaxX = nx * 0.45;
      targetParallaxY = ny * 0.35;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = container.getBoundingClientRect();
        const nx = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((touch.clientY - rect.top) / rect.height) * 2 - 1);
        targetParallaxX = nx * 0.4;
        targetParallaxY = ny * 0.3;
      }
    };

    container.addEventListener('mousemove', onPointerMove);
    container.addEventListener('touchmove', onTouchMove, { passive: true });

    // 6. MAIN 60FPS ANIMATION LOOP
    const animate = () => {
      if (isDisposed || isContextLost) return;
      animationFrameId = requestAnimationFrame(animate);

      const playing = isPlayingRef.current;
      const curTime = currentTimeRef.current || 0;
      const dur = durationRef.current || 1;
      const audio = getAudioMetricsRef.current();
      const palette = currentPaletteRef.current;
      const activePres = cameraPresetRef.current;
      const activeEnv = envRef.current;

      const progress = dur > 0 ? Math.min(Math.max(curTime / dur, 0.0), 1.0) : 0.0;

      const targetRPM = playing ? TARGET_RPM : 0.0;
      currentRPM = THREE.MathUtils.lerp(currentRPM, targetRPM, playing ? 0.038 : 0.02);

      recordGroup.rotation.y += currentRPM;
      platter.rotation.y += currentRPM;

      // Tonearm Tracking
      let targetArmAngle: number;
      let targetArmY: number;

      if (playing || curTime > 0.5) {
        targetArmAngle = ARM_START_ANGLE + progress * (ARM_END_ANGLE - ARM_START_ANGLE);
        targetArmY = playing ? 0.465 : 0.535;
      } else {
        targetArmAngle = ARM_REST_ANGLE;
        targetArmY = 0.535;
      }

      armCurrentAngle = THREE.MathUtils.lerp(armCurrentAngle, targetArmAngle, 0.045);
      armSegment.rotation.y = armCurrentAngle;

      armCurrentY = THREE.MathUtils.lerp(armCurrentY, targetArmY, 0.05);
      armSegment.position.y = armCurrentY;

      cueLever.rotation.x = (armCurrentY - 0.465) * 4.5;

      const bassVal = audio?.bass || 0.0;
      const energyVal = audio?.energy || 0.0;
      if (playing && armCurrentY <= 0.48) {
        headshell.position.y = -0.04 + bassVal * 0.008;
      }

      // Tube amplifier filaments & lights audio reaction
      for (const tLight of tubeLights) {
        tLight.intensity = 1.6 + bassVal * 1.8;
      }

      // Dynamic Environment Lighting Behavior & Global Illumination (GI)
      if (activeEnv === 'neon') {
        keySpotLight.color.set(0x00f0ff);
        rimLight.color.set(0xff007f);
        stylusLampLight.color.set(0x38bdf8);
        wallWashLight.color.set(0xa855f7);
        wallWashLight.intensity = 3.8 + bassVal * 2.0;
        secondaryFillLight.color.set(0xc084fc);
        secondaryFillLight.intensity = 1.15;
        underGlowLight.color.set(0x06b6d4);
        underGlowLight.intensity = 2.4 + bassVal * 1.5;
        hemiLight.color.set(0x38bdf8);
        hemiLight.groundColor.set(0x4c1d95);
        hemiLight.intensity = 1.75;
        ambientLight.intensity = 1.2;
        floorMat.color.set(0x131024);
        renderer.setClearColor(0x0a0614, 1);
        credenzaMat.color.set(0x181820);
        credenzaMat.map = null;
        credenzaMat.needsUpdate = true;
      } else if (activeEnv === 'sunset') {
        keySpotLight.color.set(0xff9e3b);
        rimLight.color.set(0xf97316);
        stylusLampLight.color.set(0xffd580);
        wallWashLight.color.set(0xfb923c);
        wallWashLight.intensity = 4.0 + bassVal * 1.8;
        secondaryFillLight.color.set(0xf59e0b);
        secondaryFillLight.intensity = 1.25;
        underGlowLight.color.set(0xea580c);
        underGlowLight.intensity = 2.5 + bassVal * 1.5;
        hemiLight.color.set(0xfef08a);
        hemiLight.groundColor.set(0x78350f);
        hemiLight.intensity = 1.85;
        ambientLight.intensity = 1.25;
        floorMat.color.set(0x221712);
        renderer.setClearColor(0x180f08, 1);
        credenzaMat.color.set(0x8f7356);
        credenzaMat.map = oakTex;
        credenzaMat.needsUpdate = true;
      } else if (activeEnv === 'studio') {
        keySpotLight.color.set(0xf8fafc);
        rimLight.color.set(palette.accent || '#10b981');
        stylusLampLight.color.set(0xffeed4);
        wallWashLight.color.set(0x94a3b8);
        wallWashLight.intensity = 3.2;
        secondaryFillLight.color.set(0xe2e8f0);
        secondaryFillLight.intensity = 1.2;
        underGlowLight.color.set(0x64748b);
        underGlowLight.intensity = 1.8 + bassVal * 1.0;
        hemiLight.color.set(0xf1f5f9);
        hemiLight.groundColor.set(0x334155);
        hemiLight.intensity = 1.8;
        ambientLight.intensity = 1.25;
        floorMat.color.set(0x181a20);
        renderer.setClearColor(0x0f1115, 1);
        credenzaMat.color.set(0x2a2a2e);
        credenzaMat.map = null;
        credenzaMat.needsUpdate = true;
      } else if (activeEnv === 'minimal') {
        keySpotLight.color.set(0xffffff);
        rimLight.color.set(palette.accent || '#1db954');
        stylusLampLight.color.set(0xffffff);
        wallWashLight.intensity = 1.0;
        secondaryFillLight.color.set(0xffffff);
        secondaryFillLight.intensity = 1.05;
        underGlowLight.color.set(0x3f3f46);
        underGlowLight.intensity = 1.2;
        hemiLight.color.set(0xffffff);
        hemiLight.groundColor.set(0x27272a);
        hemiLight.intensity = 1.65;
        ambientLight.intensity = 1.15;
        floorMat.color.set(0x18181c);
        renderer.setClearColor(0x121214, 1);
        credenzaMat.color.set(0x111114);
        credenzaMat.map = null;
        credenzaMat.needsUpdate = true;
      } else {
        // 'lounge' Warm Teak Default
        keySpotLight.color.set(0xffeed4);
        rimLight.color.set(palette.accent || '#1db954');
        stylusLampLight.color.set(0xffe8b4);
        wallWashLight.color.set(0xffa24c);
        wallWashLight.intensity = 3.5 + bassVal * 1.5;
        secondaryFillLight.color.set(0xfff3e0);
        secondaryFillLight.intensity = 1.2;
        underGlowLight.color.set(0xff7722);
        underGlowLight.intensity = 2.2 + bassVal * 1.2;
        hemiLight.color.set(0xffeedd);
        hemiLight.groundColor.set(0x452b1a);
        hemiLight.intensity = 1.85;
        ambientLight.intensity = 1.25;
        floorMat.color.set(0x1c1613);
        renderer.setClearColor(0x130e0c, 1);
        credenzaMat.color.set(0x3d2719);
        credenzaMat.map = walnutTex;
        credenzaMat.needsUpdate = true;
      }

      // Update shader uniforms
      vinylShaderUniforms.uBass.value = bassVal;
      vinylShaderUniforms.uEnergy.value = energyVal;
      if (palette?.accent) {
        vinylShaderUniforms.uAccentColor.value.set(palette.accent);
      }

      rimLight.intensity = (activeEnv === 'neon' ? 14 : 10) + bassVal * 15;
      stylusLampLight.intensity = 3.0 + bassVal * 1.5;

      // --- RESPONSIVE CAMERA POSITIONING & ZOOM ---
      const currentWidth = container.clientWidth || window.innerWidth;
      const currentHeight = container.clientHeight || window.innerHeight;
      const aspect = Math.max(0.1, currentWidth / currentHeight);

      const isPortrait = aspect < 1.05;

      let targetPos: THREE.Vector3;
      let targetLook: THREE.Vector3;

      if (isPortrait) {
        // Mobile portrait optimization:
        // Position model comfortably in the upper viewport above player controls with spacious margins
        mainGroup.position.set(0, 0.85, 0);
        envGroup.position.set(0, 0.85, 0);

        // Zoomed out responsive fit distance so plinth, platter, and tonearm fit comfortably with generous padding
        const safeAspect = Math.max(0.38, Math.min(1.0, aspect));
        const fitDist = 7.2 / (0.8284 * safeAspect);

        if (activePres === 'overhead') {
          // Overhead Bird's Eye View - Zoomed out to show entire 12" platter and tonearm pivot
          targetPos = new THREE.Vector3(-0.55, fitDist * 1.15 + 1.8, 0.01);
          targetLook = new THREE.Vector3(-0.55, 0.85, 0.0);
        } else if (activePres === 'macro') {
          // Macro Stylus View - Zoomed out so cartridge, wand, and grooves are framed without clipping
          targetPos = new THREE.Vector3(0.35, 2.85, 3.1);
          targetLook = new THREE.Vector3(-0.65, 1.05, -0.2);
        } else {
          // 'turntable' Full Hi-Fi View - Zoomed out isometric perspective
          targetPos = new THREE.Vector3(0.0, 1.35 + fitDist * 0.65, fitDist * 0.82);
          targetLook = new THREE.Vector3(-0.1, 0.95, 0.0);
        }
      } else {
        // Desktop landscape view
        mainGroup.position.set(0, -0.4, 0);
        envGroup.position.set(0, -0.4, 0);

        if (activePres === 'overhead') {
          targetPos = new THREE.Vector3(-0.65, 5.8, 0.01);
          targetLook = new THREE.Vector3(-0.65, 0.2, 0.0);
        } else if (activePres === 'macro') {
          targetPos = new THREE.Vector3(0.6, 2.1, 1.7);
          targetLook = new THREE.Vector3(-0.85, 0.22, -0.45);
        } else {
          targetPos = new THREE.Vector3(0.0, 5.2, 6.4);
          targetLook = new THREE.Vector3(-0.1, 0.0, 0.0);
        }
      }

      // Parallax offset
      currentParallaxX = THREE.MathUtils.lerp(currentParallaxX, targetParallaxX, 0.06);
      currentParallaxY = THREE.MathUtils.lerp(currentParallaxY, targetParallaxY, 0.06);

      const finalDesiredPos = targetPos
        .clone()
        .add(new THREE.Vector3(currentParallaxX, currentParallaxY, 0));
      const finalDesiredLook = targetLook.clone();

      currentCameraPos.lerp(finalDesiredPos, 0.055);
      currentCameraLook.lerp(finalDesiredLook, 0.055);

      camera.position.copy(currentCameraPos);
      camera.lookAt(currentCameraLook);

      try {
        renderer.render(scene, camera);
      } catch (renderError) {
        console.warn('VinylVisualizer render error:', renderError);
      }
    };

    animate();

    // 7. Handle Resize
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      try {
        renderer.setSize(width, height);
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Watch track changes
    let lastTrackId = currentTrack?.id;
    const interval = setInterval(() => {
      const activeTrack = currentTrackRef.current;
      const activePalette = currentPaletteRef.current;
      if (activeTrack?.id !== lastTrackId) {
        lastTrackId = activeTrack?.id;
        updateVinylLabel(
          activeTrack?.cover_url,
          activeTrack?.title,
          activeTrack?.artist,
          activePalette.primary || activePalette.accent,
        );
      }
    }, 400);

    // --- COMPLETE CLEANUP & MEMORY RELEASE ON UNMOUNT ---
    return () => {
      isDisposed = true;
      clearInterval(interval);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('touchmove', onTouchMove);
      resizeObserver.disconnect();

      if (renderer?.domElement) {
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      }

      // Dispose all textures & geometries safely
      try {
        if (currentTexture) currentTexture.dispose();
        walnutTex.dispose();
        oakTex.dispose();
        vinylShaderMat.dispose();
        disposeThreeNode(scene);
      } catch (e) {}

      // Force WebGL context loss to immediately free GPU memory safely
      try {
        renderer.dispose();
        renderer.forceContextLoss();
      } catch (e) {}

      if (container && renderer?.domElement) {
        try {
          container.innerHTML = '';
        } catch (e) {}
      }
    };
  }, []);

  if (initError) {
    return (
      <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
        <WebGLCanvas theme="bars" className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="3D Audiophile Turntable Experience"
      />
    </div>
  );
};
