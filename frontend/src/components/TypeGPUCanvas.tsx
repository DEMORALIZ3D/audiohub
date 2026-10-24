import { Cpu, Disc3, Loader2, Zap } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import tgpu, { d } from 'typegpu';
import { usePlayer } from '../context/PlayerContext';
import { WebGLCanvas } from './WebGLCanvas';

interface TypeGPUCanvasProps {
  className?: string;
}

// Synchronous check to avoid black screen flash on unsupported browsers
function checkWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
}

// TypeGPU Struct Schema for audio uniforms
const Uniforms = d
  .struct({
    time: d.f32,
    bass: d.f32,
    mid: d.f32,
    treble: d.f32,
    energy: d.f32,
    aspect: d.f32,
    color1: d.vec3f,
    color2: d.vec3f,
    color3: d.vec3f,
  })
  .$name('Uniforms');

// Quantum Singularity WGSL shader resolved with TypeGPU
const SHADER_WGSL = tgpu.resolveWithContext({
  template: `
    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) uv: vec2f,
    }

    @group(0) @binding(0) var<uniform> u: Uniforms;

    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
      var pos = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f( 1.0, -1.0),
        vec2f(-1.0,  1.0),
        vec2f(-1.0,  1.0),
        vec2f( 1.0, -1.0),
        vec2f( 1.0,  1.0)
      );
      var out: VertexOutput;
      out.position = vec4f(pos[vertexIndex], 0.0, 1.0);
      out.uv = pos[vertexIndex];
      return out;
    }

    fn rot2d(angle: f32) -> mat2x2f {
      let c = cos(angle);
      let s = sin(angle);
      return mat2x2f(vec2f(c, -s), vec2f(s, c));
    }

    fn hash(p: vec2f) -> f32 {
      return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123);
    }

    fn noise(p: vec2f) -> f32 {
      let i = floor(p);
      let f = fract(p);
      let u_curve = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2f(0.0, 0.0)), hash(i + vec2f(1.0, 0.0)), u_curve.x),
        mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u_curve.x),
        u_curve.y
      );
    }

    fn fbm(p: vec2f) -> f32 {
      var v = 0.0;
      var a = 0.5;
      var shift = vec2f(100.0);
      var q = p;
      for (var i = 0; i < 4; i++) {
        v += a * noise(q);
        q = rot2d(0.5) * q * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    @fragment
    fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
      var p = vec2f(uv.x * u.aspect, uv.y);
      let r = length(p);
      let angle = atan2(p.y, p.x);

      // Event horizon breathing with sub-bass
      let horizonRadius = 0.22 + u.bass * 0.06;
      let warpFactor = 1.0 / max(r - horizonRadius * 0.65, 0.02);
      let swirl = angle + warpFactor * 0.42 + u.time * (0.35 + u.energy * 0.45);

      var warpedP = vec2f(cos(swirl), sin(swirl)) * r;

      // Accretion disk plasma filaments modulated by mid frequencies
      let f1 = fbm(warpedP * (3.2 + u.mid * 2.2) - vec2f(u.time * 0.38, 0.0));
      let f2 = fbm(warpedP * 6.5 + vec2f(0.0, u.time * 0.55) + vec2f(f1 * 2.0));

      // Core black hole shadow
      let coreShadow = smoothstep(horizonRadius * 0.94, horizonRadius * 1.14, r);

      // Relativistic photon ring
      let ringDist = abs(r - horizonRadius * 1.08);
      let photonRing = 0.014 / (ringDist * ringDist + 0.0028) * (1.0 + u.bass * 2.6);

      // Spiral arms
      let spiral = sin(swirl * 4.0 - r * 8.5 + u.time * 2.2);
      let spiralGlow = (f2 * 0.85 + 0.15) / (abs(spiral) * 0.75 + 0.16);

      // Treble-reactive quantum electrical sparks
      let sparkAngle = angle * 14.0 + u.time * 7.5;
      let sparks = pow(max(sin(sparkAngle) * sin(r * 22.0 - u.time * 5.5), 0.0), 7.0) * u.treble * 4.2;

      // Outer gravitational aura
      let outerGlow = exp(-r * 1.7) * (0.8 + u.energy * 1.25);

      // Album palette dynamic color blending
      let colorMix1 = mix(u.color1, u.color2, sin(u.time * 0.45 + r * 2.2) * 0.5 + 0.5);
      let colorMix2 = mix(colorMix1, u.color3, cos(swirl * 2.0) * 0.5 + 0.5);

      var col = vec3f(0.0);
      col += colorMix2 * photonRing * 0.85;
      col += mix(u.color1, vec3f(1.0, 0.85, 0.95), 0.35) * (spiralGlow * outerGlow * 0.6);
      col += vec3f(0.85, 0.96, 1.0) * sparks;
      col += u.color2 * outerGlow * 0.38;
      col *= coreShadow;

      // Relativistic beaming / Doppler brightness shift
      let beaming = 1.0 + p.x * 0.32 * (1.0 + u.bass);
      col *= max(beaming, 0.15);

      // Cinematic smooth vignette (safe inverted smoothstep)
      let vig = 1.0 - smoothstep(0.3, 1.75, length(uv));
      col *= vig;
      col += vec3f(0.012, 0.008, 0.02) * (1.0 - coreShadow);

      return vec4f(col, 1.0);
    }
  `,
  externals: {
    Uniforms,
  },
}).code;

function hexToRgb(hex?: string): [number, number, number] {
  if (!hex || typeof hex !== 'string') return [0.12, 0.84, 0.38];
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [
      Number.isFinite(r) ? r : 0.4,
      Number.isFinite(g) ? g : 0.3,
      Number.isFinite(b) ? b : 0.8,
    ];
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return [
      Number.isFinite(r) ? r : 0.4,
      Number.isFinite(g) ? g : 0.3,
      Number.isFinite(b) ? b : 0.8,
    ];
  }
  return [0.12, 0.84, 0.38];
}

export const TypeGPUCanvas: React.FC<TypeGPUCanvasProps> = ({ className = 'w-full h-full' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { getAudioMetrics, currentPalette, setVisualizerTheme } = usePlayer();
  const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(() => {
    return checkWebGPUSupported() ? null : false;
  });

  useEffect(() => {
    let animId: number;
    let isDestroyed = false;
    let initTimeoutId: number | null = null;

    // Check if WebGPU is available in browser
    if (!checkWebGPUSupported()) {
      setWebGpuSupported(false);
      return;
    }

    // Safety timeout: prevent indefinite black screen if device hangs
    initTimeoutId = window.setTimeout(() => {
      if (!isDestroyed && webGpuSupported === null) {
        console.warn('TypeGPU WebGPU initialization timed out, safely falling back.');
        setWebGpuSupported(false);
      }
    }, 2500);

    const initWebGPU = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        // Initialize TypeGPU Root
        const root = await tgpu.init();
        if (isDestroyed) {
          try {
            root.destroy();
          } catch (e) {}
          return;
        }

        const device = root.device;
        if (!device) {
          setWebGpuSupported(false);
          return;
        }

        // Listen for device loss (GPU hang, tab backgrounded, out of memory)
        device.lost
          ?.then((info) => {
            if (!isDestroyed) {
              console.warn('TypeGPU WebGPU device lost:', info);
              setWebGpuSupported(false);
            }
          })
          .catch(() => {});

        const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
        if (!context) {
          setWebGpuSupported(false);
          return;
        }

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format,
          alphaMode: 'premultiplied',
        });

        // Create uniform buffer via TypeGPU
        const uniformBuffer = root.createBuffer(Uniforms);

        // Create Render Pipeline with resolved WGSL shader
        const shaderModule = device.createShaderModule({
          code: SHADER_WGSL,
        });

        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
          },
          fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [
              {
                format,
              },
            ],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });

        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: {
                buffer: root.unwrap(uniformBuffer),
              },
            },
          ],
        });

        setWebGpuSupported(true);

        const startTime = performance.now();

        // Render loop
        const render = () => {
          if (isDestroyed) return;

          try {
            // Resize canvas for device pixel ratio
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const displayWidth = Math.floor(canvas.clientWidth * dpr);
            const displayHeight = Math.floor(canvas.clientHeight * dpr);

            if (displayWidth <= 0 || displayHeight <= 0) {
              animId = requestAnimationFrame(render);
              return;
            }

            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
              canvas.width = Math.max(displayWidth, 1);
              canvas.height = Math.max(displayHeight, 1);
            }

            const now = performance.now();
            const elapsed = (now - startTime) * 0.001;
            const metrics = getAudioMetrics() || ({} as any);

            const c1 = hexToRgb(currentPalette?.primary);
            const c2 = hexToRgb(currentPalette?.secondary);
            const c3 = hexToRgb(currentPalette?.accent);

            const bass = Number.isFinite(metrics.bass) ? metrics.bass : 0;
            const mid = Number.isFinite(metrics.mid) ? metrics.mid : 0;
            const treble = Number.isFinite(metrics.treble) ? metrics.treble : 0;
            const energy = Number.isFinite(metrics.energy) ? metrics.energy : 0;

            // Update uniform data via TypeGPU
            uniformBuffer.write({
              time: elapsed,
              bass,
              mid,
              treble,
              energy,
              aspect: canvas.width / Math.max(canvas.height, 1),
              color1: d.vec3f(c1[0], c1[1], c1[2]),
              color2: d.vec3f(c2[0], c2[1], c2[2]),
              color3: d.vec3f(c3[0], c3[1], c3[2]),
            });

            // Submit WebGPU render commands
            const currentTexture = context.getCurrentTexture();
            if (!currentTexture) {
              animId = requestAnimationFrame(render);
              return;
            }

            const textureView = currentTexture.createView();
            const commandEncoder = device.createCommandEncoder();
            const renderPass = commandEncoder.beginRenderPass({
              colorAttachments: [
                {
                  view: textureView,
                  clearValue: { r: 0.015, g: 0.01, b: 0.025, a: 1.0 },
                  loadOp: 'clear',
                  storeOp: 'store',
                },
              ],
            });

            renderPass.setPipeline(pipeline);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.draw(6);
            renderPass.end();

            device.queue.submit([commandEncoder.finish()]);

            animId = requestAnimationFrame(render);
          } catch (renderErr) {
            console.warn(
              'TypeGPU WebGPU render error, gracefully falling back to WebGL:',
              renderErr,
            );
            isDestroyed = true;
            setWebGpuSupported(false);
          }
        };

        animId = requestAnimationFrame(render);
      } catch (err: any) {
        console.warn('TypeGPU WebGPU initialization failed, falling back to safe visualizer:', err);
        setWebGpuSupported(false);
      }
    };

    initWebGPU();

    return () => {
      isDestroyed = true;
      if (initTimeoutId) clearTimeout(initTimeoutId);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [getAudioMetrics, currentPalette]);

  // If WebGPU is not supported or failed to initialize, gracefully fall back to 2D bars with 3D turntable switcher
  if (webGpuSupported === false) {
    return (
      <div className={`relative ${className}`}>
        <WebGLCanvas theme="bars" className="w-full h-full" />
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 px-4 py-2.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-amber-500/40 text-amber-200 text-xs shadow-2xl animate-fadeIn max-w-[92vw]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
            <span>WebGPU unavailable on this device/browser. Showing classic spectrum bars.</span>
          </div>
          <button
            onClick={() => setVisualizerTheme('turntable')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-bold active:scale-95 transition-all text-xs shadow-md shrink-0 cursor-pointer"
          >
            <Disc3 className="w-3.5 h-3.5" />
            <span>Switch to 3D Turntable</span>
          </button>
        </div>
      </div>
    );
  }

  // Loading state while WebGPU device initializes
  if (webGpuSupported === null) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-black text-white/70 gap-3 ${className}`}
      >
        <Loader2 className="w-8 h-8 text-spotify-green animate-spin" />
        <span className="text-xs font-medium tracking-wider uppercase font-mono">
          Initializing WebGPU Shader...
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      {webGpuSupported && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-xs shadow-lg animate-pulse">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold tracking-wide">TypeGPU • WebGPU Accelerated</span>
        </div>
      )}
    </div>
  );
};
