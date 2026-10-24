import {
  Check,
  Copy,
  Disc,
  Download,
  ExternalLink,
  ListMusic,
  Loader2,
  MessageCircle,
  Music,
  QrCode,
  Send,
  Share2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { BRAND_CONFIG } from '../config/branding';
import type { ShareOptions } from '../utils/shareUtils';
import { AzifyLogoMark } from './AzifyLogoMark';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareOptions | null;
}

interface QRResponse {
  success: boolean;
  short_code: string;
  qr_svg_url: string;
  local_proxy_url?: string;
  scan_url: string;
  destination_url: string;
}

type QrStylePreset = 'spikes' | 'liquid' | 'diamond' | 'circle';

const QR_STYLE_PRESETS: {
  id: QrStylePreset;
  label: string;
  icon: string;
  dotShape: string;
  eyeShape: string;
}[] = [
  { id: 'spikes', label: 'Radiating Spikes', icon: '✨', dotShape: 'star', eyeShape: 'leaf' },
  { id: 'liquid', label: 'Liquid Organic', icon: '💧', dotShape: 'liquid', eyeShape: 'rounded' },
  { id: 'diamond', label: 'Crystal Prisms', icon: '💎', dotShape: 'diamond', eyeShape: 'leaf' },
  { id: 'circle', label: 'Smooth Dots', icon: '⚪', dotShape: 'circle', eyeShape: 'circle' },
];

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, data }) => {
  const [copied, setCopied] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<QRResponse | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'qr' | 'link'>('qr');
  const [selectedStyle, setSelectedStyle] = useState<QrStylePreset>('spikes');

  useEffect(() => {
    if (!isOpen || !data?.url) {
      setQrData(null);
      setQrError(null);
      setCopied(false);
      return;
    }

    let isMounted = true;
    const fetchQr = async () => {
      setQrLoading(true);
      setQrError(null);
      try {
        const preset = QR_STYLE_PRESETS.find((p) => p.id === selectedStyle) || QR_STYLE_PRESETS[0];
        const res = await fetch('/api/v1/share/qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: data.url,
            title: data.title,
            dot_shape: preset.dotShape,
            eye_shape: preset.eyeShape,
            animation: 'spin-eyes',
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to generate QR: HTTP ${res.status}`);
        }

        const json = await res.json();
        if (isMounted) {
          setQrData(json);
        }
      } catch (err: any) {
        if (isMounted) {
          setQrError(err.message || 'Could not load QR code');
        }
      } finally {
        if (isMounted) {
          setQrLoading(false);
        }
      }
    };

    fetchQr();

    return () => {
      isMounted = false;
    };
  }, [isOpen, data?.url, data?.title, selectedStyle]);

  if (!isOpen || !data) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url,
        });
      } catch {}
    }
  };

  const handleDownloadSvg = () => {
    if (!qrData) return;
    const downloadUrl = qrData.local_proxy_url || qrData.qr_svg_url;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `azify-qr-${qrData.short_code}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Messenger share URLs
  const encodedUrl = encodeURIComponent(data.url);
  const encodedText = encodeURIComponent(data.text);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(data.text + ' ' + data.url)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;

  const renderTypeIcon = () => {
    switch (data.type) {
      case 'album':
        return <Disc className="w-3.5 h-3.5 text-spotify-green" />;
      case 'artist':
        return <User className="w-3.5 h-3.5 text-spotify-green" />;
      case 'playlist':
        return <ListMusic className="w-3.5 h-3.5 text-spotify-green" />;
      default:
        return <Music className="w-3.5 h-3.5 text-spotify-green" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-spotify-green" />
            <h3 className="text-lg font-bold text-white tracking-wide">Share Music</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Preview Card */}
        <div className="p-4 mx-6 mt-4 bg-zinc-950/80 rounded-xl border border-zinc-800/80 flex items-center gap-3.5">
          {data.coverUrl ? (
            <img
              src={data.coverUrl}
              alt={data.title}
              className="w-14 h-14 rounded-lg object-cover shadow-md flex-shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <Music className="w-6 h-6 text-zinc-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              {renderTypeIcon()}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-spotify-green">
                {data.type || 'Track'}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white truncate">{data.title}</h4>
            {data.subtitle && <p className="text-xs text-zinc-400 truncate">{data.subtitle}</p>}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex px-6 pt-3 gap-2 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'qr'
                ? 'border-spotify-green text-spotify-green'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            QR Code
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'link'
                ? 'border-spotify-green text-spotify-green'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Copy className="w-4 h-4" />
            Direct Link & Social
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === 'qr' ? (
            <div className="flex flex-col items-center">
              {/* QR Container */}
              <div className="relative w-56 h-56 bg-white p-3 rounded-2xl shadow-xl border-2 border-emerald-500/30 flex items-center justify-center overflow-hidden">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-2 text-zinc-600">
                    <Loader2 className="w-8 h-8 animate-spin text-spotify-green" />
                    <span className="text-xs font-medium">Generating QR code...</span>
                  </div>
                ) : qrError ? (
                  <div className="p-4 text-center text-red-500 text-xs">
                    <p className="font-semibold mb-1">QR Generation Unavailable</p>
                    <p className="text-zinc-500">{qrError}</p>
                  </div>
                ) : qrData ? (
                  <div className="relative w-full h-full">
                    <img
                      src={qrData.local_proxy_url || qrData.qr_svg_url}
                      alt={`QR code for ${data.title}`}
                      className="w-full h-full object-contain select-none"
                    />
                    {/* Center Brand Logo Overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 bg-[#121214] rounded-xl shadow-lg border border-emerald-500/30 p-1 flex items-center justify-center pointer-events-none">
                      <AzifyLogoMark className="w-full h-full" animated={false} glow={false} />
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Aesthetic Style Selector Pills */}
              <div className="mt-3 flex items-center justify-center flex-wrap gap-1 bg-zinc-950/80 p-1 rounded-full border border-zinc-800/80 max-w-full">
                {QR_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedStyle(preset.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      selectedStyle === preset.id
                        ? 'bg-spotify-green text-black font-bold shadow'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>

              {/* Tagline */}
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-zinc-400">
                <Sparkles className="w-3.5 h-3.5 text-spotify-green" />
                <span>Scan with phone camera to listen instantly</span>
              </div>

              <div className="mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-[10px] font-medium text-emerald-400">
                  ⚡ Dynamic Music Pass
                </span>
              </div>

              {/* Action Buttons for QR */}
              <div className="w-full flex gap-2 mt-5">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-spotify-green" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
                </button>
                {qrData && (
                  <button
                    onClick={handleDownloadSvg}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition"
                    title="Download Vector SVG"
                  >
                    <Download className="w-4 h-4" />
                    <span>SVG</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Copy URL Bar */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Share Link</label>
                <div className="flex items-center gap-2 p-1.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <input
                    type="text"
                    readOnly
                    value={data.url}
                    className="flex-1 bg-transparent px-2 text-xs text-zinc-300 outline-none select-all font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-spotify-green text-black text-xs font-bold hover:brightness-110 transition flex-shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Social Channels */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Send Directly To
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 hover:bg-emerald-900/40 transition group"
                  >
                    <MessageCircle className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-medium text-emerald-300">WhatsApp</span>
                  </a>

                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-sky-950/40 border border-sky-800/40 hover:bg-sky-900/40 transition group"
                  >
                    <Send className="w-5 h-5 text-sky-400 group-hover:scale-110 transition" />
                    <span className="text-[11px] font-medium text-sky-300">Telegram</span>
                  </a>

                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50 transition group"
                  >
                    <span className="text-base font-black text-white group-hover:scale-110 transition leading-none">
                      𝕏
                    </span>
                    <span className="text-[11px] font-medium text-zinc-300">Twitter / X</span>
                  </a>
                </div>
              </div>

              {/* System Share (if supported) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-white text-xs font-semibold transition"
                >
                  <ExternalLink className="w-4 h-4 text-spotify-green" />
                  <span>Open System Share Sheet</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
