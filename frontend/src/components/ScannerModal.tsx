import {
  AlertCircle,
  Barcode,
  Camera,
  Check,
  CheckCircle2,
  Disc,
  Image as ImageIcon,
  Loader2,
  Music,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAlbum?: (albumId: string) => void;
  targetPlaylist?: { id: string; name: string } | null;
}

interface AlbumMatch {
  id: string;
  source_id: string;
  source_type: string;
  title: string;
  artist: string;
  artist_id?: string;
  cover_url: string;
  track_count?: number;
  release_date?: string;
  record_type?: string;
}

interface ScanResponse {
  success: boolean;
  query_used?: string;
  raw_text?: string;
  cleaned_text?: string;
  media_type?: string;
  confidence?: number;
  matches: AlbumMatch[];
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectAlbum,
  targetPlaylist,
}) => {
  const { playTrack } = usePlayer();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const edgeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barcodeScanIntervalRef = useRef<any>(null);

  // Camera stream & hardware states
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(() => {
    try {
      return localStorage.getItem('audiohub_scanner_camera_id') || '';
    } catch {
      return '';
    }
  });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Flash / Torch: 'off' | 'on' | 'auto'
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('auto');
  const [hasTorchCapability, setHasTorchCapability] = useState(false);

  // Zoom: hardware or digital fallback
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [minZoom, setMinZoom] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(5);
  const [hasHardwareZoom, setHasHardwareZoom] = useState(false);
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  // Scanning mode: 'cover' | 'barcode' | 'tracklist' | 'label'
  const [scanMode, setScanMode] = useState<'cover' | 'barcode' | 'tracklist' | 'label'>('cover');
  const [isScanning, setIsScanning] = useState(false);
  const [statusText, setStatusText] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [addedToLibrary, setAddedToLibrary] = useState<Record<string, boolean>>({});

  // Auto Edge Detection state
  const [isEdgeAligned, setIsEdgeAligned] = useState<boolean>(false);
  const [edgeScore, setEdgeScore] = useState<number>(0);

  // Manual query refinement in results drawer
  const [refineQuery, setRefineQuery] = useState<string>('');

  // Stop media tracks safely
  const stopStream = useCallback(() => {
    if (barcodeScanIntervalRef.current) {
      clearInterval(barcodeScanIntervalRef.current);
      barcodeScanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
  }, []);

  // Update hardware capabilities (Torch & Zoom) from active track
  const inspectTrackCapabilities = (track: MediaStreamTrack) => {
    try {
      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      setHasTorchCapability(Boolean(caps.torch));

      if (caps.zoom) {
        setHasHardwareZoom(true);
        setMinZoom(caps.zoom.min || 1);
        setMaxZoom(caps.zoom.max || 5);
        setZoomLevel(caps.zoom.min || 1);
      } else {
        setHasHardwareZoom(false);
        setMinZoom(1);
        setMaxZoom(3);
        setZoomLevel(1);
      }
    } catch {
      setHasTorchCapability(false);
      setHasHardwareZoom(false);
    }
  };

  // Start Camera Stream
  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by your browser.');
        return;
      }

      setIsInitializing(true);
      setCameraError(null);
      stopStream();

      try {
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };

        if (deviceId) {
          videoConstraints.deviceId = { exact: deviceId };
        } else {
          videoConstraints.facingMode = { ideal: 'environment' };
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          inspectTrackCapabilities(videoTrack);

          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          setCameras(videoDevices);

          const activeSettings = videoTrack.getSettings?.();
          if (activeSettings?.deviceId) {
            setSelectedCameraId(activeSettings.deviceId);
            try {
              localStorage.setItem('audiohub_scanner_camera_id', activeSettings.deviceId);
            } catch {}
          }
        }
      } catch (err: any) {
        console.error('[Scanner] Failed to open camera:', err);
        if (err.name === 'NotAllowedError') {
          setCameraError(
            'Camera permission was denied. Please allow camera access in your browser settings.',
          );
        } else {
          setCameraError('Could not start camera. Check if another app is using it.');
        }
      } finally {
        setIsInitializing(false);
      }
    },
    [stopStream],
  );

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera(selectedCameraId || undefined);
    } else {
      stopStream();
      setScanResult(null);
      setIsScanning(false);
      setIsEdgeAligned(false);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, selectedCameraId, stopStream]);

  // Real-time edge detection & barcode scanner background loop
  useEffect(() => {
    if (!isOpen || isScanning || scanResult) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      // 1. Barcode scanning loop (Layer 1)
      if (scanMode === 'barcode' && typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'upc_a', 'upc_e', 'qr_code', 'code_128'],
          });
          const barcodes = await detector.detect(video);
          if (Array.isArray(barcodes) && barcodes.length > 0) {
            const rawBarcode = barcodes[0].rawValue;
            if (rawBarcode) {
              if (navigator.vibrate) navigator.vibrate([40]);
              lookupBarcode(rawBarcode);
              return;
            }
          }
        } catch {}
      }

      // 2. Real-time Edge Alignment Evaluation
      try {
        if (!edgeCanvasRef.current) {
          edgeCanvasRef.current = document.createElement('canvas');
          edgeCanvasRef.current.width = 120;
          edgeCanvasRef.current.height = 120;
        }
        const canvas = edgeCanvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, 120, 120);
          const imgData = ctx.getImageData(0, 0, 120, 120);
          const data = imgData.data;

          // Simple gradient contrast check on borders vs center
          let edgeVariance = 0;
          let samples = 0;
          for (let y = 10; y < 110; y += 10) {
            for (let x = 10; x < 110; x += 10) {
              const idx = (y * 120 + x) * 4;
              const rightIdx = (y * 120 + (x + 5)) * 4;
              const downIdx = ((y + 5) * 120 + x) * 4;
              const luma = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
              const rightLuma =
                data[rightIdx] * 0.299 + data[rightIdx + 1] * 0.587 + data[rightIdx + 2] * 0.114;
              const downLuma =
                data[downIdx] * 0.299 + data[downIdx + 1] * 0.587 + data[downIdx + 2] * 0.114;
              edgeVariance += Math.abs(luma - rightLuma) + Math.abs(luma - downLuma);
              samples += 2;
            }
          }

          const avgContrast = edgeVariance / samples;
          setEdgeScore(Math.min(100, Math.round(avgContrast * 2.5)));
          setIsEdgeAligned(avgContrast > 24);
        }
      } catch {}
    }, 250);

    return () => clearInterval(interval);
  }, [isOpen, isScanning, scanResult, scanMode]);

  // Lookup Barcode via Backend
  const lookupBarcode = async (barcode: string) => {
    setIsScanning(true);
    setStatusText(`Barcode detected: ${barcode}...`);
    try {
      const res = await fetch('/api/v1/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, mode: 'barcode' }),
      });
      if (res.ok) {
        const data = await res.json();
        setScanResult(data);
        if (data.matches?.[0]?.title) {
          setRefineQuery(data.matches[0].title);
        }
      }
    } catch (e) {
      console.error('Barcode lookup failed:', e);
    } finally {
      setIsScanning(false);
    }
  };

  // Apply torch state change
  const applyTorch = useCallback(
    async (state: boolean) => {
      if (!streamRef.current) return;
      const track = streamRef.current.getVideoTracks()[0];
      if (track && hasTorchCapability) {
        try {
          await (track as any).applyConstraints({
            advanced: [{ torch: state }],
          });
        } catch (e) {
          console.warn('Failed to toggle torch:', e);
        }
      }
    },
    [hasTorchCapability],
  );

  // Apply zoom state change
  const applyZoom = useCallback(
    async (zoomValue: number) => {
      const clamped = Math.min(maxZoom, Math.max(minZoom, zoomValue));
      setZoomLevel(clamped);

      if (streamRef.current && hasHardwareZoom) {
        const track = streamRef.current.getVideoTracks()[0];
        if (track) {
          try {
            await (track as any).applyConstraints({
              advanced: [{ zoom: clamped }],
            });
          } catch {}
        }
      }
    },
    [hasHardwareZoom, minZoom, maxZoom],
  );

  // Cycle Flash Mode: 'auto' -> 'on' -> 'off'
  const toggleFlash = async () => {
    let next: 'off' | 'on' | 'auto';
    if (flashMode === 'auto') next = 'on';
    else if (flashMode === 'on') next = 'off';
    else next = 'auto';

    setFlashMode(next);
    if (next === 'on') {
      await applyTorch(true);
    } else {
      await applyTorch(false);
    }
  };

  // Switch camera lens (cycle available video inputs)
  const switchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextDevice = cameras[nextIndex];
    setSelectedCameraId(nextDevice.deviceId);
    try {
      localStorage.setItem('audiohub_scanner_camera_id', nextDevice.deviceId);
    } catch {}
    startCamera(nextDevice.deviceId);
  };

  // Pinch-to-zoom touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = dist / touchStartDistRef.current;
      const targetZoom = touchStartZoomRef.current * ratio;
      applyZoom(targetZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  // Capture frame & perform visual OCR + multi-catalog resolution
  const captureAndAnalyze = async (manualImage?: Blob) => {
    setIsScanning(true);
    setStatusText('Capturing high-resolution frame...');

    try {
      let canvas: HTMLCanvasElement;

      if (manualImage) {
        const img = new Image();
        img.src = URL.createObjectURL(manualImage);
        await new Promise((r) => {
          img.onload = r;
        });
        canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      } else {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0) {
          throw new Error('Video stream is not ready');
        }

        canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context');

        if (flashMode === 'auto' && hasTorchCapability) {
          await applyTorch(true);
          await new Promise((r) => setTimeout(r, 120));
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (flashMode === 'auto' && hasTorchCapability) {
          applyTorch(false);
        }
      }

      // Check native browser Shape Detection TextDetector API first
      let detectedText = '';
      if (typeof window !== 'undefined' && 'TextDetector' in window) {
        try {
          setStatusText('Detecting text on sleeve...');
          const detector = new (window as any).TextDetector();
          const detected = await detector.detect(canvas);
          if (Array.isArray(detected) && detected.length > 0) {
            detectedText = detected.map((d: any) => d.rawValue).join(' ');
          }
        } catch {}
      }

      // Fallback: Use Tesseract.js WASM for 100% browser compatibility
      if (!detectedText.trim()) {
        try {
          setStatusText('Extracting typography with in-browser OCR...');
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker('eng');
          const ocrResult = await worker.recognize(canvas);
          detectedText = ocrResult.data.text || '';
          await worker.terminate();
        } catch (e) {
          console.warn('[Scanner] Tesseract fallback error:', e);
        }
      }

      setStatusText('Searching Discogs, MusicBrainz & Deezer...');

      const response = await fetch('/api/v1/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: detectedText || undefined,
          mode: scanMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data: ScanResponse = await response.json();
      setScanResult(data);
      if (data.matches?.[0]?.title) {
        setRefineQuery(data.matches[0].title);
      } else if (data.cleaned_text) {
        setRefineQuery(data.cleaned_text);
      }
    } catch (err: any) {
      console.error('[Scanner] Scan failed:', err);
      setStatusText(`Scan error: ${err.message || 'Could not recognize album'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Re-query with manual refined text
  const handleRefineSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineQuery.trim()) return;
    setIsScanning(true);
    setStatusText(`Searching for "${refineQuery}"...`);

    try {
      const response = await fetch('/api/v1/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: refineQuery,
          mode: 'cover',
        }),
      });
      if (response.ok) {
        const data: ScanResponse = await response.json();
        setScanResult(data);
      }
    } catch (err) {
      console.error('Refined search failed', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Photo File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      captureAndAnalyze(file);
    }
  };

  // Play Top Match Immediately
  const handlePlayAlbum = (album: AlbumMatch) => {
    if (album.source_id) {
      playTrack({
        id: `dz_album_${album.source_id}_1`,
        title: album.title,
        artist: album.artist,
        cover_url: album.cover_url,
        source_type: album.source_type,
        source_id: album.source_id,
        duration_seconds: 180,
      });
      onClose();
    }
  };

  // Add Album to User Library
  const handleAddToLibrary = async (album: AlbumMatch) => {
    try {
      const res = await fetch('/api/v1/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: album.title,
          description: `Album by ${album.artist} (Scanned)`,
          cover_url: album.cover_url,
          source_type: album.source_type,
          source_id: album.source_id,
        }),
      });
      if (res.ok) {
        setAddedToLibrary((prev) => ({ ...prev, [album.id]: true }));
        window.dispatchEvent(new CustomEvent('playlists_changed'));
      }
    } catch (e) {
      console.error('Failed to add album to library:', e);
    }
  };

  // Save Album tracks directly to target playlist
  const handleSaveToTargetPlaylist = async (album: AlbumMatch) => {
    if (!targetPlaylist) return;
    try {
      const res = await fetch(`/api/v1/albums/${album.source_id}/save-to-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: targetPlaylist.id }),
      });
      if (res.ok) {
        setAddedToLibrary((prev) => ({ ...prev, [album.id]: true }));
        window.dispatchEvent(new CustomEvent('playlists_changed'));
      } else {
        await handleAddToLibrary(album);
      }
    } catch {
      await handleAddToLibrary(album);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-fadeIn select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Main Full-Screen Viewfinder Container */}
      <div className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden">
        {/* Top Floating Controls Bar */}
        <div className="relative z-20 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-black/50 border border-white/10 text-zinc-300 hover:text-white hover:bg-black/80 transition"
            title="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>

          {targetPlaylist && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold truncate max-w-[170px] shadow-sm">
              <Disc className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span className="truncate">{targetPlaylist.name}</span>
            </div>
          )}

          {/* Mode Pill Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-black/60 border border-white/15 backdrop-blur-md">
            <button
              onClick={() => setScanMode('cover')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                scanMode === 'cover'
                  ? 'bg-spotify-green text-black font-bold shadow'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Cover
            </button>
            <button
              onClick={() => setScanMode('barcode')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${
                scanMode === 'barcode'
                  ? 'bg-spotify-green text-black font-bold shadow'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Barcode</span>
            </button>
            <button
              onClick={() => setScanMode('tracklist')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                scanMode === 'tracklist'
                  ? 'bg-spotify-green text-black font-bold shadow'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Tracklist
            </button>
          </div>

          {/* Top-Right Tools: Flash & Camera Lens Cycle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFlash}
              className={`p-2.5 rounded-full border transition flex items-center justify-center ${
                flashMode === 'on'
                  ? 'bg-amber-400 text-black border-amber-300 shadow-lg shadow-amber-400/30'
                  : flashMode === 'auto'
                    ? 'bg-black/60 border-white/20 text-amber-300'
                    : 'bg-black/50 border-white/10 text-zinc-400'
              }`}
              title={`Flash Mode: ${flashMode.toUpperCase()}`}
            >
              {flashMode === 'off' ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            </button>

            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="p-2.5 rounded-full bg-black/50 border border-white/10 text-zinc-300 hover:text-white hover:bg-black/80 transition"
                title="Switch Camera Lens"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Video Viewfinder Area */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 max-w-sm text-center bg-zinc-900/90 border border-zinc-700 rounded-2xl mx-4 shadow-2xl z-30">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white mb-2">Camera Unavailable</h4>
              <p className="text-xs text-zinc-400 mb-4">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl bg-spotify-green text-black font-bold text-xs hover:brightness-110 transition flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Upload Photo Instead</span>
              </button>
            </div>
          ) : (
            <div
              className="relative w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
              style={{
                transform: !hasHardwareZoom && zoomLevel > 1 ? `scale(${zoomLevel})` : undefined,
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* AR Focus Reticle Overlay with Dynamic Edge Detection */}
          {!cameraError && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div
                className={`relative border-2 transition-all duration-300 shadow-2xl ${
                  scanMode === 'barcode'
                    ? 'w-80 h-32 rounded-xl border-amber-400/80 shadow-amber-500/20'
                    : scanMode === 'tracklist'
                      ? 'w-72 h-96 rounded-2xl'
                      : 'w-72 h-72 rounded-2xl'
                } ${
                  isEdgeAligned && scanMode !== 'barcode'
                    ? 'border-spotify-green shadow-emerald-500/50 scale-[1.02]'
                    : 'border-white/40'
                }`}
              >
                {/* 4 Glowing Corner Brackets */}
                <div
                  className={`absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg transition-colors duration-300 ${
                    isEdgeAligned
                      ? 'border-spotify-green shadow-lg shadow-spotify-green'
                      : 'border-white/70'
                  }`}
                />
                <div
                  className={`absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg transition-colors duration-300 ${
                    isEdgeAligned
                      ? 'border-spotify-green shadow-lg shadow-spotify-green'
                      : 'border-white/70'
                  }`}
                />
                <div
                  className={`absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg transition-colors duration-300 ${
                    isEdgeAligned
                      ? 'border-spotify-green shadow-lg shadow-spotify-green'
                      : 'border-white/70'
                  }`}
                />
                <div
                  className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 rounded-br-lg transition-colors duration-300 ${
                    isEdgeAligned
                      ? 'border-spotify-green shadow-lg shadow-spotify-green'
                      : 'border-white/70'
                  }`}
                />

                {/* Laser scan line for Barcode mode */}
                {scanMode === 'barcode' && (
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
                )}
              </div>

              {/* Edge Detection Feedback Indicator */}
              <div className="mt-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/70 border border-white/10 backdrop-blur-md text-[11px] font-medium text-zinc-300">
                {scanMode === 'barcode' ? (
                  <>
                    <Barcode className="w-3.5 h-3.5 text-amber-400" />
                    <span>Center the barcode on the back or spine</span>
                  </>
                ) : isEdgeAligned ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-spotify-green" />
                    <span className="text-spotify-green font-semibold">
                      Sleeve Detected • Ready to Capture
                    </span>
                  </>
                ) : (
                  <span>Align the album cover inside the frame</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar: Zoom Pills + Shutter Button + Upload Button */}
        <div className="relative z-20 flex flex-col items-center gap-3 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          {/* Zoom Level Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyZoom(1)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                zoomLevel <= 1.2
                  ? 'bg-white/20 text-white border border-white/40'
                  : 'bg-black/40 text-zinc-400 hover:text-white'
              }`}
            >
              1x
            </button>
            <button
              onClick={() => applyZoom(2)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                zoomLevel > 1.2 && zoomLevel <= 2.5
                  ? 'bg-white/20 text-white border border-white/40'
                  : 'bg-black/40 text-zinc-400 hover:text-white'
              }`}
            >
              2x
            </button>
            {maxZoom >= 3 && (
              <button
                onClick={() => applyZoom(3)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  zoomLevel > 2.5
                    ? 'bg-white/20 text-white border border-white/40'
                    : 'bg-black/40 text-zinc-400 hover:text-white'
                }`}
              >
                3x
              </button>
            )}
          </div>

          {/* Shutter Row */}
          <div className="w-full flex items-center justify-between px-6 mt-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 rounded-full bg-zinc-800/80 border border-white/10 text-white hover:bg-zinc-700 transition"
              title="Upload photo from library"
            >
              <ImageIcon className="w-5 h-5 text-zinc-300" />
            </button>

            <button
              disabled={isScanning || isInitializing}
              onClick={() => captureAndAnalyze()}
              className={`relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all ${
                isScanning
                  ? 'opacity-80 scale-95'
                  : 'hover:scale-105 active:scale-95 shadow-xl shadow-emerald-500/20'
              }`}
              title="Capture and identify"
            >
              <div
                className={`w-14 h-14 rounded-full transition-all ${
                  isScanning ? 'bg-spotify-green animate-pulse' : 'bg-spotify-green'
                }`}
              />
              {isScanning && <Loader2 className="absolute w-7 h-7 text-black animate-spin" />}
            </button>

            <div className="w-12 h-12" />
          </div>
        </div>

        {/* Loading Overlay */}
        {isScanning && (
          <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <Disc className="w-14 h-14 text-spotify-green animate-spin" />
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-emerald-300 animate-bounce" />
            </div>
            <h4 className="text-base font-bold text-white mb-1.5">Identifying Album</h4>
            <p className="text-xs text-zinc-400 font-mono">{statusText}</p>
          </div>
        )}

        {/* Results Bottom Sheet Drawer */}
        {scanResult && (
          <div className="absolute inset-x-0 bottom-0 z-40 bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-5 shadow-2xl animate-slideUp max-h-[85vh] flex flex-col">
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-spotify-green" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {scanResult.matches.length > 0 ? 'Match Found' : 'Refine Search'}
                </h3>
              </div>
              <button
                onClick={() => setScanResult(null)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
                title="Rescan"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Refine Input Bar */}
            <form onSubmit={handleRefineSearch} className="mb-4">
              <div className="flex items-center gap-2 p-1.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                <Search className="w-4 h-4 text-zinc-500 ml-2" />
                <input
                  type="text"
                  placeholder="Refine artist or album name..."
                  value={refineQuery}
                  onChange={(e) => setRefineQuery(e.target.value)}
                  className="flex-1 bg-transparent px-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={isScanning}
                  className="py-1 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition"
                >
                  Search
                </button>
              </div>
            </form>

            {scanResult.matches.length > 0 ? (
              <div className="overflow-y-auto space-y-3 pr-1">
                {scanResult.matches.map((album) => {
                  const isAdded = addedToLibrary[album.id];
                  return (
                    <div
                      key={album.id}
                      className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {album.cover_url ? (
                          <img
                            src={album.cover_url}
                            alt={album.title}
                            className="w-14 h-14 rounded-lg object-cover shadow flex-shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <Disc className="w-6 h-6 text-zinc-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{album.title}</h4>
                          <p className="text-xs text-zinc-400 truncate">{album.artist}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                            {album.release_date && <span>{album.release_date.slice(0, 4)}</span>}
                            <span className="uppercase text-spotify-green">
                              ({album.source_type})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handlePlayAlbum(album)}
                          className="p-2.5 rounded-full bg-spotify-green text-black hover:scale-105 transition"
                          title="Play Album"
                        >
                          <Play className="w-4 h-4 fill-black" />
                        </button>

                        <button
                          onClick={() =>
                            targetPlaylist
                              ? handleSaveToTargetPlaylist(album)
                              : handleAddToLibrary(album)
                          }
                          disabled={isAdded}
                          className={`p-2.5 rounded-full border transition ${
                            isAdded
                              ? 'bg-emerald-950/50 border-emerald-600 text-emerald-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                          }`}
                          title={
                            isAdded
                              ? targetPlaylist
                                ? `Added to ${targetPlaylist.name}`
                                : 'Added to Library'
                              : targetPlaylist
                                ? `Add all tracks to ${targetPlaylist.name}`
                                : 'Add Album to Library'
                          }
                        >
                          {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-zinc-400">
                <Music className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                <p className="text-xs mb-1">Could not find an exact match for this sleeve.</p>
                <p className="text-[11px] text-zinc-500">
                  Tip: Switch to <b>Barcode mode</b> and scan the back or spine barcode, or refine
                  the name above.
                </p>
                <button
                  onClick={() => setScanResult(null)}
                  className="mt-4 py-2 px-5 rounded-full bg-zinc-800 text-white text-xs font-semibold hover:bg-zinc-700 transition"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
