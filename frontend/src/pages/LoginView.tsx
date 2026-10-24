import jsQR from 'jsqr';
import {
  AlertCircle,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Music,
  QrCode,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  Wifi,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AzifyLogoMark } from '../components/AzifyLogoMark';
import { InAppBrowserBanner } from '../components/InAppBrowserBanner';
import { ServerConnectModal } from '../components/ServerConnectModal';
import { useBranding } from '../config/branding';
import { useAuth } from '../context/AuthContext';
import { getServerBaseUrl, isStandaloneApp, isTvPlatform, resolveApiUrl } from '../utils/apiConfig';
import { openInSystemBrowserOrApp } from '../utils/inAppBrowser';

interface MagicSessionData {
  session_id: string;
  pin: string;
  auth_url: string;
  qr_svg_url: string;
  local_proxy_url: string;
  expires_in: number;
}

export interface LoginViewProps {
  isTvMode?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ isTvMode }) => {
  const brand = useBranding();
  const { login, refreshUser } = useAuth();

  const isDetectedTv =
    typeof window !== 'undefined' &&
    (isTvPlatform() ||
      window.location.hash.includes('tv') ||
      window.location.pathname.includes('/tv') ||
      new URLSearchParams(window.location.search).get('tab') === 'tv');
  const isTv = isTvMode ?? isDetectedTv;
  const isMobile =
    typeof window !== 'undefined' && !isTv && (window.innerWidth < 768 || isStandaloneApp());

  const [tab, setTab] = useState<'qr' | 'password' | 'signup' | 'scan'>(() => {
    if (isTv) return 'qr';
    if (isMobile) return 'password';
    return 'qr';
  });

  const getSuccessRedirectUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return_to');
    if (returnTo) return returnTo;
    if (window.location.protocol === 'file:' || isStandaloneApp()) {
      return isTv ? '#/tv' : '#/';
    }
    if (isTv) return '/#/tv';
    return '/';
  };

  const navigateAfterLogin = async () => {
    await refreshUser();
    if (window.location.protocol === 'file:' || isStandaloneApp()) {
      window.location.hash = isTv ? '#/tv' : '#/';
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return_to');
    if (returnTo) {
      window.location.href = returnTo;
      return;
    }
    if (isTv) {
      window.location.hash = '#/tv';
    } else {
      window.location.href = '/';
    }
  };

  // Password form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [error, setError] = useState('');

  // NFC Guest Invite Signup state
  const [nfcInviteToken, setNfcInviteToken] = useState<string | null>(null);
  const [nfcInvitedBy, setNfcInvitedBy] = useState<string | null>(null);
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Magic QR state (for Desktop & TV displays)
  const [magicData, setMagicData] = useState<MagicSessionData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrSuccess, setQrSuccess] = useState(false);
  const pollTimerRef = useRef<number | null>(null);

  // Camera QR scanner state (for mobile companion scanning)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Server connection modal state
  const [showServerModal, setShowServerModal] = useState<boolean>(() => {
    return isStandaloneApp() && !getServerBaseUrl();
  });
  const currentServerUrl = getServerBaseUrl();

  // Transfer claim state (if opened via ?magic_claim=...)
  const [claimLoading, setClaimLoading] = useState(false);

  // Shared content detection for shared link previews (e.g. from Facebook Messenger)
  const [sharedItem, setSharedItem] = useState<{
    type: 'track' | 'playlist' | 'album';
    id: string;
    title: string;
    artist?: string;
    cover_url?: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track');
    if (trackId) {
      fetch(`/api/v1/stream/${trackId}/info`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.title) {
            setSharedItem({
              type: 'track',
              id: data.id,
              title: data.title,
              artist: data.artist,
              cover_url: data.cover_url,
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (e: any) {
      setCameraError(
        'Camera access denied or unavailable. Please use password login or enable camera permissions.',
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
      });
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (tab === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [tab]);

  const handleScannedCode = async (raw: string) => {
    try {
      if (navigator.vibrate) navigator.vibrate([60]);
    } catch {}

    setClaimLoading(true);
    setError('');

    try {
      let claimToken: string | null = null;
      let claimPin: string | null = null;
      let magicAuth: string | null = null;

      if (raw.includes('magic_claim=') || raw.includes('pin=') || raw.includes('magic_auth=')) {
        const urlStr = raw.startsWith('http') ? raw : `http://dummy.com/${raw}`;
        const u = new URL(urlStr);
        claimToken = u.searchParams.get('magic_claim');
        claimPin = u.searchParams.get('pin');
        magicAuth = u.searchParams.get('magic_auth');
      }

      if (claimToken && claimPin) {
        const res = await fetch('/api/v1/auth/magic/claim-transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: claimToken, pin: claimPin }),
        });
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('audiohub_user_id', data.token);
          setQrSuccess(true);
          await navigateAfterLogin();
          return;
        } else {
          throw new Error(data.detail || 'Transfer QR code expired or invalid');
        }
      }

      if (magicAuth && claimPin) {
        const res = await fetch('/api/v1/auth/magic/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: magicAuth, pin: claimPin }),
        });
        const data = await res.json();
        if (res.ok) {
          setQrSuccess(true);
          setTimeout(() => {
            setTab('password');
          }, 1200);
          return;
        } else {
          throw new Error(data.detail || 'Failed to approve session');
        }
      }

      if (raw.trim().length >= 10 && !raw.includes('/') && !raw.includes(' ')) {
        localStorage.setItem('audiohub_user_id', raw.trim());
        setQrSuccess(true);
        await navigateAfterLogin();
        return;
      }

      throw new Error('Unrecognized AudioHub QR code format');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired QR code.');
      setClaimLoading(false);
      setTimeout(() => {
        setCameraActive(true);
      }, 1500);
    }
  };

  // QR Camera Detection loop
  useEffect(() => {
    if (tab !== 'scan' || !cameraActive) return;

    let stopped = false;
    const interval = setInterval(async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      let scannedText = '';

      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(video);
          if (Array.isArray(barcodes) && barcodes.length > 0 && barcodes[0].rawValue) {
            scannedText = barcodes[0].rawValue;
          }
        } catch {}
      }

      if (!scannedText) {
        try {
          if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
          }
          const canvas = canvasRef.current;
          canvas.width = 320;
          canvas.height = 320;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, 320, 320);
            const imgData = ctx.getImageData(0, 0, 320, 320);
            const code = jsQR(imgData.data, 320, 320);
            if (code && code.data) {
              scannedText = code.data;
            }
          }
        } catch {}
      }

      if (scannedText) {
        stopped = true;
        clearInterval(interval);
        handleScannedCode(scannedText);
      }
    }, 200);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [tab, cameraActive]);

  // Step 1: Check URL for magic_claim, magic_auth, or nfc invite
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicClaim = params.get('magic_claim');
    const claimPin = params.get('pin');
    const invite = params.get('invite');
    const invitedBy = params.get('invited_by') || params.get('by');

    if (invite) {
      setNfcInviteToken(invite);
      setNfcInvitedBy(invitedBy || 'Admin');
      setTab('signup');
    }

    if (magicClaim && claimPin) {
      setClaimLoading(true);
      fetch('/api/v1/auth/magic/claim-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: magicClaim, pin: claimPin }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.token) {
            localStorage.setItem('audiohub_user_id', data.token);
            setQrSuccess(true);
            await navigateAfterLogin();
          } else {
            setError(data.detail || 'Transfer QR code expired or invalid');
            setClaimLoading(false);
          }
        })
        .catch(() => {
          setError('Failed to claim session');
          setClaimLoading(false);
        });
    }
  }, []);

  // Step 2: Request Magic QR session when on 'qr' tab
  const fetchMagicSession = async () => {
    if (isStandaloneApp() && !getServerBaseUrl()) {
      setError('Please connect to your AudioHub server to enable Magic QR.');
      setShowServerModal(true);
      return;
    }
    setQrLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/magic/request', { method: 'POST' });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        throw new Error(
          'Server returned HTML instead of API response. Please verify your backend server address.',
        );
      }
      if (!res.ok) {
        let msg = 'Failed to generate magic login session';
        try {
          const errData = await res.json();
          if (errData.detail) msg = errData.detail;
        } catch {}
        throw new Error(msg);
      }
      const data: MagicSessionData = await res.json();
      setMagicData(data);
    } catch (err: any) {
      setError(err.message || 'Could not load Magic QR');
      if (isStandaloneApp() && !getServerBaseUrl()) {
        setShowServerModal(true);
      }
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'qr' && !qrSuccess) {
      fetchMagicSession();
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [tab]);

  // Step 3: Poll status while Magic QR is displayed
  useEffect(() => {
    if (!magicData?.session_id || tab !== 'qr' || qrSuccess) return;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/auth/magic/status?session_id=${magicData.session_id}`);
        if (!res.ok) return;
        const statusData = await res.json();

        if (statusData.status === 'approved' && statusData.token) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setQrSuccess(true);
          localStorage.setItem('audiohub_user_id', statusData.token);
          setTimeout(() => {
            navigateAfterLogin();
          }, 800);
        } else if (statusData.status === 'expired') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          fetchMagicSession();
        }
      } catch {}
    }, 1500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [magicData?.session_id, tab, qrSuccess]);

  const [tvFocusIndex, setTvFocusIndex] = useState(0);

  useEffect(() => {
    if (!isTv) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Return / Back key (10009 on Samsung TV)
      if (e.keyCode === 10009 || e.key === 'Return' || e.key === 'XF86Back') {
        if (tab === 'password') {
          e.preventDefault();
          setTab('qr');
          return;
        }
      }

      // Samsung Remote Color keys (Red=403, Green=404, Yellow=405, Blue=406)
      if (e.keyCode === 403 || e.keyCode === 404 || e.keyCode === 405 || e.keyCode === 406) {
        e.preventDefault();
        setTab((prev) => (prev === 'qr' ? 'password' : 'qr'));
        return;
      }

      if (tab === 'qr') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          setTvFocusIndex((prev) => (prev + 1) % 3);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setTvFocusIndex((prev) => (prev - 1 + 3) % 3);
        } else if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          if (tvFocusIndex === 0) {
            setTab('password');
          } else if (tvFocusIndex === 1) {
            fetchMagicSession();
          } else if (tvFocusIndex === 2) {
            setShowServerModal(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTv, tab, tvFocusIndex]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStandaloneApp() && !getServerBaseUrl()) {
      setError('Please configure your AudioHub server address first.');
      setShowServerModal(true);
      return;
    }
    if (!identifier.trim() || !password) return;

    setPwLoading(true);
    setError('');

    const res = await login(identifier, password);
    if (!res.success) {
      setError(res.error || 'Failed to sign in');
      setPwLoading(false);
      if (isStandaloneApp() && (!getServerBaseUrl() || res.error?.includes('server'))) {
        setShowServerModal(true);
      }
    } else if (isTv) {
      await navigateAfterLogin();
    }
  };

  const handleNfcSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupUsername.trim() || !signupPassword || !nfcInviteToken) return;

    setSignupLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/nfc/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_token: nfcInviteToken,
          username: signupUsername.trim(),
          password: signupPassword,
          display_name: signupDisplayName.trim() || undefined,
          email: signupEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Sign up failed');
      }

      setSignupSuccess(true);
      if (data.token) {
        localStorage.setItem('audiohub_user_id', data.token);
        await refreshUser();
        setTimeout(() => {
          navigateAfterLogin();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleCancelSignup = () => {
    // Clear URL parameters so reloading doesn't re-trigger invite
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      url.searchParams.delete('invited_by');
      url.searchParams.delete('by');
      url.searchParams.delete('mode');
      window.history.replaceState(null, '', url.pathname);
    } catch {}

    setNfcInviteToken(null);
    setNfcInvitedBy(null);
    setSignupUsername('');
    setSignupPassword('');
    setSignupDisplayName('');
    setSignupEmail('');
    setError('');
    setTab('qr');
  };

  if (isTv) {
    return (
      <div className="min-h-screen w-screen bg-[#060709] text-white flex flex-col justify-between p-8 sm:p-12 relative overflow-hidden select-none">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />

        {/* Top TV Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#181820] border border-emerald-500/30 p-2 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              {brand.logoUrl &&
              brand.logoUrl !== '/icon.svg?v=2' &&
              brand.logoUrl !== '/icon.svg' ? (
                <img
                  src={brand.logoUrl}
                  alt={brand.appName}
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <AzifyLogoMark className="w-full h-full" animated glow />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                <span>{brand.appName} TV</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  10-Foot Leanback Sign-In
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                {brand.tagline || 'Living Room Display'} • Instant pairing with zero TV typing
              </p>
            </div>
          </div>

          {/* Mode Switcher on TV */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowServerModal(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
                tvFocusIndex === 2
                  ? 'bg-emerald-400 text-black ring-4 ring-white font-bold scale-105'
                  : 'bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white border-white/15'
              }`}
              title="Configure AudioHub Backend Server Address"
            >
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-[11px] truncate max-w-[180px]">
                {currentServerUrl
                  ? currentServerUrl.replace(/^https?:\/\//, '')
                  : 'Configure Server'}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase ml-0.5">
                {currentServerUrl ? 'Change' : 'Set'}
              </span>
            </button>

            <button
              onClick={() => setTab(tab === 'qr' ? 'password' : 'qr')}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/15 transition-all"
            >
              {tab === 'qr' ? (
                <>
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Use TV Remote Password</span>
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>Switch to Magic QR</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* TV Center Stage */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-6">
          {tab === 'qr' ? (
            qrSuccess ? (
              <div className="flex flex-col items-center justify-center text-center animate-scaleIn space-y-4">
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/40">
                  <CheckCircle2 className="w-14 h-14" />
                </div>
                <h2 className="text-3xl font-black text-white">Signed In!</h2>
                <p className="text-sm text-zinc-400">Launching your 10-foot TV music player...</p>
              </div>
            ) : (
              <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                {/* Left: Giant High-Contrast Clean QR Code */}
                <div className="flex flex-col items-center">
                  <div className="relative w-72 h-72 sm:w-80 sm:h-80 bg-white p-4 rounded-3xl shadow-2xl ring-4 ring-emerald-500/30 flex items-center justify-center overflow-hidden">
                    {qrLoading ? (
                      <div className="flex flex-col items-center gap-3 text-zinc-600">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                        <span className="text-sm font-semibold">Generating QR code...</span>
                      </div>
                    ) : magicData ? (
                      <div className="relative w-full h-full flex items-center justify-center p-2">
                        <img
                          src={resolveApiUrl(magicData.local_proxy_url) || magicData.qr_svg_url}
                          alt="Magic Login QR Code"
                          onError={(e) => {
                            if (
                              magicData.qr_svg_url &&
                              (e.target as HTMLImageElement).src !== magicData.qr_svg_url
                            ) {
                              (e.target as HTMLImageElement).src = magicData.qr_svg_url;
                            }
                          }}
                          className="w-full h-full object-contain select-none"
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Big TV Remote Password Button */}
                  <button
                    onClick={() => setTab('password')}
                    className={`mt-6 w-full py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all ${
                      tvFocusIndex === 0
                        ? 'bg-emerald-400 text-black shadow-xl shadow-emerald-400/40 ring-4 ring-white scale-105'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
                    }`}
                  >
                    <Lock className="w-5 h-5 text-emerald-400" />
                    <span>Use TV Remote Password</span>
                    <span className="text-[11px] opacity-70 font-mono ml-1">(Press Enter)</span>
                  </button>

                  {/* Refresh QR button */}
                  <button
                    onClick={fetchMagicSession}
                    disabled={qrLoading}
                    className={`mt-2.5 flex items-center gap-2 text-xs py-2 px-3.5 rounded-xl transition ${
                      tvFocusIndex === 1
                        ? 'bg-emerald-400 text-black ring-2 ring-white font-bold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh QR Code</span>
                  </button>
                </div>

                {/* Right: Big PIN & Clear Manual URL Instructions */}
                <div className="space-y-5 text-left">
                  {/* Big PIN Display */}
                  {magicData && (
                    <div className="bg-[#121620] border-2 border-emerald-500/40 rounded-2xl p-5 shadow-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-400">
                        <span className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4" /> TV Security PIN
                        </span>
                        <span className="text-[11px] text-zinc-400 font-normal">
                          Fast Phone Pairing
                        </span>
                      </div>
                      <div className="font-mono text-5xl sm:text-6xl font-black text-emerald-400 tracking-[0.25em] text-center py-1">
                        {magicData.pin}
                      </div>
                    </div>
                  )}

                  {/* Manual Pairing URL if cannot scan */}
                  <div className="bg-[#121620] border border-emerald-500/30 rounded-2xl p-4.5 text-xs space-y-2.5">
                    <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Globe className="w-4 h-4" /> Cannot scan the QR code?
                    </div>
                    <p className="text-zinc-300 text-xs">
                      On your smartphone, tablet, or PC browser, open:
                    </p>
                    <div className="font-mono text-sm bg-black/80 px-3.5 py-2.5 rounded-xl text-emerald-300 font-bold border border-emerald-500/30 text-center tracking-wide">
                      {currentServerUrl
                        ? `${currentServerUrl.replace(/\/+$/, '')}/#/pair`
                        : 'http://localhost:4533/#/pair'}
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Type the 4-digit PIN{' '}
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {magicData?.pin}
                      </span>{' '}
                      and tap "Link TV" to sign in instantly.
                    </p>
                  </div>

                  {/* 3 Step Instructions */}
                  <div className="space-y-3 bg-black/40 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/40">
                        1
                      </div>
                      <p className="text-xs font-medium text-white/90">
                        Scan the QR code with your phone camera, or visit the link above
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/40">
                        2
                      </div>
                      <p className="text-xs font-medium text-white/90">
                        Confirm PIN{' '}
                        <span className="font-mono font-bold text-emerald-400">
                          {magicData?.pin}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Live Status Listening */}
                  <div className="flex items-center gap-2.5 text-xs text-emerald-400 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Waiting for smartphone pairing...</span>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* TV Remote Password Form */
            <div className="max-w-md w-full bg-[#121620] border border-white/15 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-2">TV Remote Password Sign-In</h2>
              <p className="text-xs text-zinc-400 mb-6">
                Enter your username or email using your TV remote control
              </p>

              {error && (
                <div className="w-full bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    autoFocus
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-[#1e1e24] border border-white/15 rounded-xl px-4 py-3.5 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="e.g. admin@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#1e1e24] border border-white/15 rounded-xl px-4 py-3.5 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {pwLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>Sign In to TV</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTab('qr')}
                  className="w-full py-2.5 text-xs text-zinc-400 hover:text-white transition text-center block"
                >
                  ← Switch back to Phone QR Sign-In
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Bottom TV Bar */}
        <div className="relative z-10 border-t border-white/10 pt-4 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted sovereign private music library</span>
          </div>
          <div className="font-mono text-[11px] text-zinc-500">AudioHub TV 10-Foot Receiver</div>
        </div>

        {/* Server Connection Modal for TV */}
        <ServerConnectModal
          isOpen={showServerModal && isStandaloneApp()}
          onClose={() => setShowServerModal(false)}
          canClose={Boolean(currentServerUrl)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#090909] text-white select-none">
      <InAppBrowserBanner />

      <div className="flex-1 w-full flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col items-center">
          {/* Brand Logo & Name */}
          <div className="w-16 h-16 rounded-2xl bg-[#181820] border border-emerald-500/20 p-2.5 shadow-xl shadow-emerald-500/20 mb-3 flex items-center justify-center relative group">
            {brand.logoUrl && brand.logoUrl !== '/icon.svg?v=2' && brand.logoUrl !== '/icon.svg' ? (
              <img
                src={brand.logoUrl}
                alt={brand.appName}
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <AzifyLogoMark className="w-full h-full" animated glow />
            )}
          </div>

          <h1 className="text-2xl font-black tracking-tight mb-1 text-white text-center">
            {brand.appName}
          </h1>
          <p className="text-xs text-spotify-gray mb-4 text-center">{brand.tagline}</p>

          {/* Shared Song / Content Preview Card (for external link clicks) */}
          {sharedItem && (
            <div className="w-full mb-5 p-3.5 bg-gradient-to-br from-emerald-950/80 via-[#142318]/80 to-[#18181c] border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={sharedItem.cover_url || '/icon.svg'}
                  alt={sharedItem.title}
                  className="w-12 h-12 rounded-lg object-cover shadow-md shrink-0 bg-neutral-800"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-spotify-green leading-none mb-1 flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    <span>Shared with you</span>
                  </span>
                  <span className="text-sm font-bold text-white truncate">{sharedItem.title}</span>
                  {sharedItem.artist && (
                    <span className="text-xs text-white/70 truncate">{sharedItem.artist}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openInSystemBrowserOrApp(window.location.href)}
                className="px-3.5 py-2 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black text-xs font-bold shadow-md transition hover:scale-105 active:scale-95 flex items-center gap-1.5 shrink-0"
                title="Launch in installed AudioHub PWA or Native App"
              >
                <span>Open in App</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Server Connection Bar (Only for native packaged apps: Capacitor & Tizen file://) */}
          {isStandaloneApp() && (
            <div className="w-full mb-5 p-2.5 bg-[#18181c] border border-white/10 rounded-xl flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentServerUrl ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400 animate-pulse'}`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 leading-none mb-0.5">
                    Backend Server
                  </span>
                  <span
                    className="text-xs font-mono text-zinc-200 truncate"
                    title={currentServerUrl || 'Not configured'}
                  >
                    {currentServerUrl || 'Not configured (Tap to connect)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(true)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/10 transition active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentServerUrl ? 'Change' : 'Connect'}</span>
              </button>
            </div>
          )}

          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Claiming Transfer Session Banner */}
          {claimLoading && (
            <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-xs flex items-center justify-center gap-2 mb-4 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Pairing with your account via Magic QR...</span>
            </div>
          )}

          {/* Tab Selector: Mobile shows Password vs Camera Scan, Desktop shows Magic QR vs Password */}
          <div className="flex bg-[#1e1e1e] p-1 rounded-full border border-white/10 mb-6 w-full">
            {nfcInviteToken && (
              <button
                onClick={() => setTab('signup')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  tab === 'signup'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>VIP Sign-Up</span>
              </button>
            )}

            {isMobile ? (
              <>
                <button
                  onClick={() => setTab('password')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-bold transition-all ${
                    tab === 'password'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Password</span>
                </button>
                <button
                  onClick={() => setTab('scan')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-bold transition-all ${
                    tab === 'scan'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Desktop / TV</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setTab('qr')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-bold transition-all ${
                    tab === 'qr'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Magic QR</span>
                </button>
                <button
                  onClick={() => setTab('password')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-bold transition-all ${
                    tab === 'password'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Password</span>
                </button>
              </>
            )}
          </div>

          {/* TAB 0: SCAN DESKTOP OR TV QR CODE VIA CAMERA (MOBILE ONLY) */}
          {tab === 'scan' && (
            <div className="w-full flex flex-col items-center">
              {qrSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center animate-scaleIn">
                  <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">Paired Successfully!</h3>
                  <p className="text-xs text-zinc-400">Loading your music library...</p>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  {/* Camera Viewfinder */}
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 bg-black rounded-3xl overflow-hidden border-2 border-emerald-500/40 shadow-2xl flex items-center justify-center mb-4">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Viewfinder Target Reticle */}
                    <div className="absolute inset-8 border-2 border-dashed border-emerald-400/70 rounded-2xl pointer-events-none flex items-center justify-center">
                      <div className="w-full h-0.5 bg-emerald-400/90 shadow-[0_0_10px_#10b981] animate-pulse" />
                    </div>

                    {cameraError && (
                      <div className="absolute inset-0 bg-black/90 p-4 flex flex-col items-center justify-center text-center text-xs text-red-400 gap-2">
                        <AlertCircle className="w-8 h-8 shrink-0" />
                        <span>{cameraError}</span>
                        <button
                          onClick={startCamera}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/10"
                        >
                          Retry Camera
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-center px-4 mb-2">
                    <h4 className="text-sm font-bold text-white mb-1">Scan Desktop or TV QR</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Point your camera at the QR code displayed on your logged-in Desktop (Settings
                      ➔ Link Phone) or TV screen to sign in instantly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: MAGIC QR LOGIN (DESKTOP / TV DISPLAY) */}
          {tab === 'qr' && (
            <div className="w-full flex flex-col items-center">
              {qrSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center animate-scaleIn">
                  <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">Signed In!</h3>
                  <p className="text-xs text-zinc-400">Loading your music library...</p>
                </div>
              ) : (
                <>
                  {/* Dynamic QR Code Container with Center Logo Badge & Rotating Nodes */}
                  <div className="relative w-56 h-56 bg-white p-3 rounded-2xl shadow-xl border-2 border-emerald-500/40 flex items-center justify-center overflow-hidden mb-4">
                    {qrLoading ? (
                      <div className="flex flex-col items-center gap-2 text-zinc-600">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                        <span className="text-xs font-medium">Generating QR code...</span>
                      </div>
                    ) : magicData ? (
                      <div className="relative w-full h-full">
                        <img
                          src={resolveApiUrl(magicData.local_proxy_url) || magicData.qr_svg_url}
                          alt="Magic Login QR Code"
                          onError={(e) => {
                            if (
                              magicData.qr_svg_url &&
                              (e.target as HTMLImageElement).src !== magicData.qr_svg_url
                            ) {
                              (e.target as HTMLImageElement).src = magicData.qr_svg_url;
                            }
                          }}
                          className="w-full h-full object-contain select-none"
                        />
                        {/* Center Brand Logo Overlay */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 bg-[#121214] rounded-xl shadow-lg border border-emerald-500/30 p-1 flex items-center justify-center pointer-events-none">
                          <AzifyLogoMark className="w-full h-full" animated={false} glow={false} />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* 4-Digit Security PIN Badge */}
                  {magicData && (
                    <div className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl p-2.5 mb-4 flex items-center justify-between px-4">
                      <div className="flex items-center gap-2 text-xs text-zinc-300">
                        <KeyRound className="w-4 h-4 text-emerald-400" />
                        <span>Security PIN:</span>
                      </div>
                      <span className="font-mono text-xl font-black text-emerald-400 tracking-widest">
                        {magicData.pin}
                      </span>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="text-center px-2 mb-4">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-white/90 mb-1">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <span>Scan with your logged-in phone</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                      Point your phone camera (or our in-app scanner) at this code and confirm the
                      PIN to sign in with zero typing.
                    </p>
                  </div>

                  {/* Refresh QR */}
                  <div className="w-full flex items-center justify-between text-xs text-zinc-400 border-t border-white/5 pt-3">
                    <button
                      onClick={fetchMagicSession}
                      disabled={qrLoading}
                      className="flex items-center gap-1.5 hover:text-white transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${qrLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh Code</span>
                    </button>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Live Listening</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: PASSWORD LOGIN */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-spotify-gray block mb-1.5">
                  Email or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. admin@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    required
                  />
                  <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-spotify-gray block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    required
                  />
                  <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-full text-sm transition-all shadow-lg shadow-emerald-500/20 mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pwLoading ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: VIP GUEST SIGN-UP (VIA NFC BEAM / INVITE) */}
          {tab === 'signup' && (
            <div className="w-full flex flex-col">
              {signupSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center animate-scaleIn">
                  <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">Account Created!</h3>
                  <p className="text-xs text-zinc-400">
                    Welcome to {brand.appName}. Launching your player...
                  </p>
                </div>
              ) : (
                <form onSubmit={handleNfcSignupSubmit} className="w-full flex flex-col gap-3.5">
                  {/* VIP Invitation Header Badge */}
                  <div className="w-full bg-gradient-to-r from-purple-500/20 via-emerald-500/10 to-transparent border border-purple-500/30 p-3 rounded-xl flex items-center gap-2.5 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-300">
                      <Sparkles
                        className="w-4 h-4 text-yellow-300 animate-spin"
                        style={{ animationDuration: '6s' }}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-purple-200">
                        Exclusive VIP Invitation
                      </span>
                      <span className="text-xs text-white/90">
                        Invited by <b className="text-emerald-400">{nfcInvitedBy || 'Admin'}</b>
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-spotify-gray block mb-1">
                      Choose a Username <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. alex_music"
                        value={signupUsername}
                        onChange={(e) => setSignupUsername(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        required
                        minLength={3}
                        autoFocus
                      />
                      <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-spotify-gray block mb-1">
                      Create Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        required
                        minLength={4}
                      />
                      <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-spotify-gray block mb-1">
                      Your Name / Display Name{' '}
                      <span className="text-zinc-500 text-[10px]">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex"
                      value={signupDisplayName}
                      onChange={(e) => setSignupDisplayName(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-spotify-gray block mb-1">
                      Email Address <span className="text-zinc-500 text-[10px]">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="alex@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-purple-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 mt-2">
                    <button
                      type="button"
                      onClick={handleCancelSignup}
                      className="py-3.5 px-4 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white/80 hover:text-white transition-all border border-white/10 active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={signupLoading}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-emerald-500 hover:from-purple-500 hover:to-emerald-400 text-white font-bold py-3.5 px-4 rounded-full text-sm transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                    >
                      {signupLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Create Account & Join</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/5 w-full flex items-center justify-center gap-2 text-center text-[11px] text-spotify-gray">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Private invite-only server. Public sign-ups are disabled.</span>
          </div>
        </div>
      </div>

      {/* Server Connection Modal for Mobile Standalone */}
      <ServerConnectModal
        isOpen={showServerModal && isStandaloneApp()}
        onClose={() => setShowServerModal(false)}
        canClose={Boolean(currentServerUrl)}
      />
    </div>
  );
};
