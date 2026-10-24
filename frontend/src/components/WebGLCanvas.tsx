import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { drawRoundRect } from '../utils/canvasPolyfill';

interface WebGLCanvasProps {
  theme: 'synthwave' | 'liquid' | 'wormhole' | 'bars' | 'starfield';
  className?: string;
}

const VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const SYNTHWAVE_FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_color;
  uniform float u_bass;
  uniform float u_mid;
  varying vec2 vUv;

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    uv.y += 0.25;

    // Horizon line
    if (uv.y > 0.0) {
      // Sun & Sky
      float d = length(uv - vec2(0.0, 0.25));
      float sunRadius = 0.46 + u_bass * 0.08;
      // Inverted smoothstep safe across all drivers (edge0 < edge1)
      float sun = 1.0 - smoothstep(sunRadius, sunRadius + 0.02, d);
      float glow = exp(-d * 2.4) * (1.0 + u_bass * 2.2);

      vec3 skyColor = mix(vec3(0.01, 0.0, 0.03), u_color * 0.15, uv.y);
      vec3 sunColor = mix(vec3(1.0, 0.75, 0.1), u_color, uv.y * 2.0);

      // Sun scanlines
      float sunLines = smoothstep(0.0, 0.12, sin((uv.y - u_time * 0.04) * 45.0));
      if (uv.y < 0.35) sunColor *= sunLines;

      gl_FragColor = vec4(skyColor + (sun * sunColor) + (glow * u_color * 0.55), 1.0);
      return;
    }

    // Grid Floor
    float y = -uv.y;
    float z = 1.0 / max(y, 0.001);
    float x = uv.x * z;
    float t = u_time * 2.8 + (u_bass * 3.5);

    #if HAS_DERIVATIVES
      float lineX = abs(fract(x * 3.5) - 0.5) / max(fwidth(x * 3.5), 0.001);
      float lineZ = abs(fract(z * 3.5 - t) - 0.5) / max(fwidth(z * 3.5 - t), 0.001);
    #else
      float lineX = abs(fract(x * 3.5) - 0.5) / 0.04;
      float lineZ = abs(fract(z * 3.5 - t) - 0.5) / 0.04;
    #endif
    float grid = 1.0 - min(min(lineX, lineZ), 1.0);

    vec3 gridColor = mix(u_color, vec3(1.0, 0.4, 0.8), z * 0.1) * grid * (y * 2.5) * (1.0 + u_bass * 0.9);
    gl_FragColor = vec4(gridColor, 1.0);
  }
`;

const LIQUID_FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_color;
  uniform float u_bass;
  uniform float u_mid;
  varying vec2 vUv;

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 4; i++) {
      f += w * noise(p);
      p *= 2.0;
      w *= 0.5;
    }
    return f;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv *= 2.5;

    float t = u_time * 0.25 + u_bass * 0.4;
    float q = fbm(uv + t);
    vec2 r = vec2(fbm(uv + q + t * 0.4), fbm(uv + q - t * 0.2));
    float f = fbm(uv + r * (1.0 + u_mid * 1.5));

    vec3 baseColor = vec3(0.03, 0.01, 0.06);
    vec3 accentColor = vec3(u_color.y, u_color.z, u_color.x);
    float mixFactor = clamp(f * (1.2 + u_bass * 1.2), 0.0, 1.0);
    vec3 liquidColor = mix(baseColor, u_color, mixFactor);
    liquidColor += accentColor * (q * 0.5 * (1.0 + u_mid));

    gl_FragColor = vec4(liquidColor, 1.0);
  }
`;

const WORMHOLE_FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_color;
  uniform float u_bass;
  uniform float u_mid;
  varying vec2 vUv;

  void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float r = length(p);
    float a = atan(p.y, p.x);

    float u = 0.4 / max(r, 0.001) + u_time * 0.6 + u_bass * 0.3;
    float val = sin(u * 8.0) * cos(a * 6.0 + u_time);

    vec3 color2 = vec3(u_color.y, u_color.z, u_color.x);
    vec3 baseCol = mix(u_color, color2, sin(u * 2.0 + u_time) * 0.5 + 0.5);

    vec3 col = baseCol * (val * 0.5 + 0.5);
    col *= smoothstep(0.0, 0.25, r) * (1.0 - smoothstep(0.5, 1.8, r));
    col *= (1.0 + u_mid * 1.5 + u_bass);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const STARFIELD_FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_color;
  uniform float u_bass;
  uniform float u_treble;
  varying vec2 vUv;

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float speed = u_time * (0.8 + u_bass * 1.8);
    vec3 col = vec3(0.01, 0.01, 0.02);

    for (int i = 1; i < 4; i++) {
      float fi = float(i);
      vec2 p = uv * (fi * 2.0);
      float z = fract(sin(fi * 91.345 + floor(speed)) * 43758.54);
      p += vec2(sin(fi + speed * 0.2), cos(fi * 1.5 + speed * 0.15)) * 0.3;
      float d = length(p);
      float star = 1.0 - smoothstep(0.0, 0.03 + u_treble * 0.02, d);
      col += mix(u_color, vec3(1.0, 1.0, 1.0), 0.5) * star * (1.0 + u_bass);
    }

    // Central pulsing nebula
    float centerGlow = exp(-length(uv) * 3.0) * (0.3 + u_bass * 0.6);
    col += u_color * centerGlow;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const WebGLCanvas: React.FC<WebGLCanvasProps> = ({ theme, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { getAudioMetrics, currentPalette } = usePlayer();
  const [fallbackToBars, setFallbackToBars] = useState(false);

  // Reset fallback when theme changes
  useEffect(() => {
    setFallbackToBars(false);
  }, [theme]);

  const effectiveTheme = fallbackToBars ? 'bars' : theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (effectiveTheme === 'bars') {
      // High-performance 2D Canvas Audio Spectrum Bars
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animId: number;
      const renderBars = () => {
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width <= 0 || height <= 0) {
          animId = requestAnimationFrame(renderBars);
          return;
        }

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const metrics = getAudioMetrics() || ({} as any);
        const data = metrics.frequencyData || new Uint8Array(256);
        const barCount = Math.min(64, Math.max(32, Math.floor(width / 18)));
        const gap = 3;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(4, (width - 48 - totalGap) / barCount);
        const startX = (width - (barCount * barWidth + totalGap)) / 2;
        const boost = 1.0 + (metrics.energy || 0) * 1.5;

        ctx.shadowBlur = 14;
        ctx.shadowColor = currentPalette?.accent || '#1ed760';

        for (let i = 0; i < barCount; i++) {
          const normIdx = i / barCount;
          const sampleIdx = Math.floor(normIdx ** 1.85 * Math.min(data.length, 200));
          const rawVal = (data[sampleIdx] || 0) / 255;
          const val = rawVal ** 1.25;
          const barHeight = Math.max(8, val * (height * 0.82) * boost);
          const x = startX + i * (barWidth + gap);
          const y = height / 2 - barHeight / 2;

          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, currentPalette?.primary || '#1ed760');
          grad.addColorStop(0.5, currentPalette?.accent || '#1ed760');
          grad.addColorStop(1, currentPalette?.secondary || '#15803d');

          ctx.fillStyle = grad;
          ctx.beginPath();
          drawRoundRect(ctx, x, y, barWidth, barHeight, 4);
          ctx.fill();
        }

        ctx.restore();
        animId = requestAnimationFrame(renderBars);
      };

      animId = requestAnimationFrame(renderBars);
      return () => cancelAnimationFrame(animId);
    }

    // WebGL Shader Renderers (Synthwave, Liquid, Wormhole, Starfield)
    // Prefer WebGL2 context with fallback to WebGL1 / experimental-webgl
    const gl = (canvas.getContext('webgl2', { alpha: true, antialias: true }) ||
      canvas.getContext('webgl', { alpha: true, antialias: true }) ||
      canvas.getContext('experimental-webgl', { alpha: true, antialias: true })) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;

    if (!gl) {
      console.warn('WebGL not supported on this device/view, falling back to 2D bars spectrum');
      setFallbackToBars(true);
      return;
    }

    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const extDeriv = !isWebGL2 ? gl.getExtension('OES_standard_derivatives') : null;
    const hasDerivatives = isWebGL2 || !!extDeriv;

    // Pick shader
    let fragSource = SYNTHWAVE_FRAG;
    if (theme === 'liquid') fragSource = LIQUID_FRAG;
    if (theme === 'wormhole') fragSource = WORMHOLE_FRAG;
    if (theme === 'starfield') fragSource = STARFIELD_FRAG;

    let header = '';
    if (hasDerivatives) {
      header += '#extension GL_OES_standard_derivatives : enable\n';
    }
    header += `#define HAS_DERIVATIVES ${hasDerivatives ? 1 : 0}\n`;

    const fullFragSource = header + fragSource;

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, fullFragSource);
    if (!vs || !fs) {
      console.warn('Shader compilation failed, falling back to 2D bars spectrum');
      setFallbackToBars(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setFallbackToBars(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Program link error:', gl.getProgramInfoLog(program));
      setFallbackToBars(true);
      return;
    }
    // WebGL useProgram (bracket access prevents React Hook naming heuristic false-positive)
    gl['useProgram'](program);

    // Fullscreen quad buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const posAttr = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uColor = gl.getUniformLocation(program, 'u_color');
    const uBass = gl.getUniformLocation(program, 'u_bass');
    const uMid = gl.getUniformLocation(program, 'u_mid');
    const uTreble = gl.getUniformLocation(program, 'u_treble');

    let animId: number;
    const startTime = performance.now();

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(animId);
      console.warn('WebGLCanvas context lost.');
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      const elapsed = (performance.now() - startTime) / 1000;
      const metrics = getAudioMetrics() || ({} as any);

      const paletteRgb = currentPalette?.rgb;
      const r = paletteRgb && Number.isFinite(paletteRgb[0]) ? paletteRgb[0] : 30;
      const g = paletteRgb && Number.isFinite(paletteRgb[1]) ? paletteRgb[1] : 215;
      const b = paletteRgb && Number.isFinite(paletteRgb[2]) ? paletteRgb[2] : 96;

      const bass = Number.isFinite(metrics.bass) ? metrics.bass : 0;
      const mid = Number.isFinite(metrics.mid) ? metrics.mid : 0;
      const treble = Number.isFinite(metrics.treble) ? metrics.treble : 0;

      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform3f(uColor, r / 255, g / 255, b / 255);
      gl.uniform1f(uBass, bass);
      gl.uniform1f(uMid, mid);
      if (uTreble) gl.uniform1f(uTreble, treble);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      try {
        if (program) gl.deleteProgram(program);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
      } catch (e) {}
    };
  }, [effectiveTheme, currentPalette]);

  return (
    <canvas
      key={effectiveTheme === 'bars' ? 'canvas-2d' : 'canvas-webgl'}
      ref={canvasRef}
      className={`w-full h-full block ${className}`}
    />
  );
};
