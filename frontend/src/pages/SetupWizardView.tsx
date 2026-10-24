import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Disc,
  Eye,
  EyeOff,
  Flame,
  Headphones,
  Lock,
  Mail,
  Music,
  Palette,
  Radio,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { AzifyLogoMark } from '../components/AzifyLogoMark';
import { fetchServerBranding } from '../config/branding';
import { resolveApiUrl } from '../utils/apiConfig';

export interface SetupWizardViewProps {
  onComplete?: (user: any) => void;
}

const PRESET_COLORS = [
  { name: 'Emerald Green', hex: '#1ed760' },
  { name: 'Mint Teal', hex: '#10b981' },
  { name: 'Cyan Neon', hex: '#06b6d4' },
  { name: 'Royal Purple', hex: '#a855f7' },
  { name: 'Hot Pink', hex: '#ec4899' },
  { name: 'Sunset Amber', hex: '#f59e0b' },
];

const PRESET_ICONS = [
  { id: 'music', label: 'Music', Icon: Music },
  { id: 'headphones', label: 'Headphones', Icon: Headphones },
  { id: 'disc', label: 'Vinyl', Icon: Disc },
  { id: 'radio', label: 'Broadcast', Icon: Radio },
  { id: 'flame', label: 'Energy', Icon: Flame },
];

export const SetupWizardView: React.FC<SetupWizardViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Branding State
  const [appName, setAppName] = useState('AudioHub');
  const [tagline, setTagline] = useState('Homelab Hi-Fi Streaming & Infinite Catalog');
  const [logoUrl, setLogoUrl] = useState('');
  const [accentColor, setAccentColor] = useState('#1ed760');
  const [selectedIconPreset, setSelectedIconPreset] = useState<string>('music');

  // Step 2: Instance Owner State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Execution State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<any>(null);

  // Validation
  const validateStep1 = () => {
    if (!appName.trim()) {
      setError('Please provide an instance name for your server.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmitSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError('Username is required for the instance owner.');
      return;
    }
    if (cleanUser.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        app_name: appName.trim() || 'AudioHub',
        tagline: tagline.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
        accent_color: accentColor.trim() || '#1ed760',
        username: cleanUser,
        email: email.trim() || undefined,
        display_name: displayName.trim() || undefined,
        password: password,
      };

      const res = await fetch(resolveApiUrl('/api/v1/setup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorDetail =
          data?.detail || data?.message || 'Server setup encountered an error. Please try again.';
        setError(errorDetail);
        setLoading(false);
        return;
      }

      // Store created user & active session
      if (data?.user?.id) {
        localStorage.setItem('audiohub_user_id', data.user.id);
        setCreatedUser(data.user);
      }

      // Refresh global branding cache & event bus
      await fetchServerBranding();

      // Proceed to Step 3 Confirmation
      setLoading(false);
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to the server. Please verify your connection.');
      setLoading(false);
    }
  };

  const handleLaunchApp = () => {
    if (onComplete) {
      onComplete(createdUser);
    } else {
      window.location.hash = '#/home';
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#090909] text-white flex flex-col justify-between selection:bg-[#1ed760] selection:text-black">
      {/* Dynamic Ambient Background Glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] opacity-20 blur-[140px] pointer-events-none rounded-full"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-10 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AzifyLogoMark size={40} glow animated />
          <div>
            <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              {appName || 'AudioHub'}
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-black font-mono"
                style={{ backgroundColor: accentColor }}
              >
                OOBE
              </span>
            </span>
            <p className="text-xs text-neutral-400 font-medium">First-Run Setup Wizard</p>
          </div>
        </div>

        {/* Wizard Stepper Progress Bar */}
        <div className="flex items-center gap-2">
          {[
            { num: 1, label: 'Branding' },
            { num: 2, label: 'Owner' },
            { num: 3, label: 'Launch' },
          ].map((item) => {
            const isActive = step === item.num;
            const isDone = step > item.num;
            return (
              <div key={item.num} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                    isDone
                      ? 'bg-neutral-800 text-white border border-white/20'
                      : isActive
                        ? 'text-black shadow-lg scale-105'
                        : 'bg-neutral-900 text-neutral-500 border border-white/5'
                  }`}
                  style={isActive ? { backgroundColor: accentColor } : {}}
                >
                  {isDone ? <Check className="w-4 h-4 text-[#1ed760]" /> : item.num}
                </div>
                <span
                  className={`text-xs font-semibold hidden sm:inline ${
                    isActive ? 'text-white' : 'text-neutral-500'
                  }`}
                >
                  {item.label}
                </span>
                {item.num < 3 && <div className="w-4 h-0.5 bg-neutral-800 hidden sm:block" />}
              </div>
            );
          })}
        </div>
      </header>

      {/* Main Container Card */}
      <main className="relative z-10 flex-1 max-w-2xl w-full mx-auto px-6 py-6 flex flex-col justify-center">
        <div className="bg-[#121212]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Error Banner */}
          {error && (
            <div
              data-testid="setup-error-banner"
              className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-start gap-3 animate-fadeIn"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* ================= STEP 1: SERVER BRANDING ================= */}
          {step === 1 && (
            <form onSubmit={handleNextStep1} className="space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-neutral-300">
                  <Palette className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  Step 1 of 3: Instance Customization
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Brand Your Server
                </h1>
                <p className="text-sm text-neutral-400">
                  Customize the look, name, and identity of your personal music streaming server.
                </p>
              </div>

              {/* Live Preview Pill Card */}
              <div className="p-4 rounded-xl bg-neutral-900/90 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg text-black transition-colors"
                    style={{ backgroundColor: accentColor }}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-8 h-8 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      (() => {
                        const IconComponent =
                          PRESET_ICONS.find((p) => p.id === selectedIconPreset)?.Icon || Music;
                        return <IconComponent className="w-5 h-5 text-black" />;
                      })()
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{appName.trim() || 'AudioHub'}</h3>
                    <p className="text-xs text-neutral-400 line-clamp-1">
                      {tagline.trim() || 'homelab entertainment'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest px-2 py-1 rounded bg-black/40 border border-white/5">
                  Live Preview
                </span>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Instance Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                    Instance / Server Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Server className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                    <input
                      data-testid="setup-app-name"
                      type="text"
                      required
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="e.g. AudioHub, SonicCloud, GroovyStream"
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-[#1ed760] transition-colors"
                    />
                  </div>
                </div>

                {/* Server Tagline */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                    Server Tagline / Subtitle
                  </label>
                  <div className="relative">
                    <Tag className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                    <input
                      data-testid="setup-tagline"
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="e.g. Homelab Hi-Fi Streaming & Infinite Catalog"
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-[#1ed760] transition-colors"
                    />
                  </div>
                </div>

                {/* Accent Color Palette */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                    Accent Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setAccentColor(preset.hex)}
                        title={preset.name}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          accentColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'ring-2 ring-white scale-110 shadow-lg'
                            : 'opacity-80 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.hex }}
                      >
                        {accentColor.toLowerCase() === preset.hex.toLowerCase() && (
                          <Check className="w-4 h-4 text-black stroke-[3]" />
                        )}
                      </button>
                    ))}
                    {/* Custom Hex Input */}
                    <div className="flex items-center gap-1.5 ml-2 bg-neutral-900 border border-neutral-700/80 rounded-xl px-2.5 py-1">
                      <span className="text-xs text-neutral-500 font-mono">#</span>
                      <input
                        data-testid="setup-accent-color"
                        type="text"
                        value={accentColor.replace('#', '')}
                        onChange={(e) =>
                          setAccentColor(`#${e.target.value.replace(/[^0-9A-Fa-f]/g, '')}`)
                        }
                        maxLength={6}
                        placeholder="1ed760"
                        className="w-16 bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Logo Preset Icons & URL */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                    Logo / Icon Symbol
                  </label>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {PRESET_ICONS.map((p) => {
                      const IconComp = p.Icon;
                      const isSel = selectedIconPreset === p.id && !logoUrl;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedIconPreset(p.id);
                            setLogoUrl('');
                          }}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs transition-all ${
                            isSel
                              ? 'bg-neutral-800 border-[#1ed760] text-white shadow-md'
                              : 'bg-neutral-900/60 border-white/5 text-neutral-400 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <IconComp
                            className="w-5 h-5 mb-1"
                            style={isSel ? { color: accentColor } : {}}
                          />
                          <span className="text-[10px] truncate max-w-full">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <input
                    data-testid="setup-logo-url"
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="Or enter custom external Logo URL (e.g. https://.../logo.png)"
                    className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1ed760] transition-colors"
                  />
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="pt-2">
                <button
                  data-testid="setup-continue-step1"
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-full font-bold text-sm text-black flex items-center justify-center gap-2 shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: accentColor }}
                >
                  Continue to Owner Account
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ================= STEP 2: OWNER ACCOUNT ================= */}
          {step === 2 && (
            <form onSubmit={handleSubmitSetup} className="space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-neutral-300">
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  Step 2 of 3: Instance Owner
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Create Super Admin
                </h1>
                <p className="text-sm text-neutral-400">
                  Set up the primary administrator profile with supreme authority over this AudioHub
                  server.
                </p>
              </div>

              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                    Super Admin Username <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                    <input
                      data-testid="setup-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. alex, admin, owner"
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-[#1ed760] transition-colors"
                    />
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                    Display Name
                  </label>
                  <div className="relative">
                    <Sparkles className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                    <input
                      data-testid="setup-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Rivera (Friendly Name)"
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-[#1ed760] transition-colors"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                    Email Address <span className="text-neutral-500 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                    <input
                      data-testid="setup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@homelab.local"
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-[#1ed760] transition-colors"
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                      Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                      <input
                        data-testid="setup-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-[#1ed760] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-neutral-400 hover:text-white"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                      <input
                        data-testid="setup-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-[#1ed760] transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Security Privilege Callout */}
                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-white/5 text-xs text-neutral-400 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#1ed760] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-neutral-200">
                      Super Administrator Access:
                    </span>{' '}
                    This owner profile can configure storage caching, create family accounts, and
                    manage system tokens.
                  </div>
                </div>
              </div>

              {/* Step 2 Actions */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                  className="py-3 px-5 rounded-full font-bold text-sm text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <button
                  data-testid="setup-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 px-6 rounded-full font-bold text-sm text-black flex items-center justify-center gap-2 shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: accentColor }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Initializing Server...
                    </>
                  ) : (
                    <>
                      Initialize & Provision Server
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= STEP 3: FINISH & LAUNCH ================= */}
          {step === 3 && (
            <div className="space-y-6 text-center py-2 animate-fadeIn">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-[#1ed760]/20 border border-[#1ed760]/40 text-[#1ed760] shadow-xl">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  You're Ready to Stream!
                </h1>
                <p className="text-sm text-neutral-400 max-w-md mx-auto">
                  <span className="text-white font-semibold">{appName}</span> has been provisioned
                  and configured successfully.
                </p>
              </div>

              {/* Configuration Summary Card */}
              <div className="p-4 rounded-xl bg-neutral-900 border border-white/10 text-left space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                    Server Name
                  </span>
                  <span className="text-sm font-bold text-white">{appName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                    Super Administrator
                  </span>
                  <span className="text-sm font-bold text-white">
                    {displayName || username} (@{username})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                    Accent Theme
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/30"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span className="text-xs font-mono text-neutral-300">{accentColor}</span>
                  </div>
                </div>
              </div>

              {/* System Ready Verification Badges */}
              <div className="grid grid-cols-2 gap-2 text-left">
                {[
                  'Database Initialized',
                  'Admin Token Generated',
                  'Branding System Synced',
                  'Stream Proxy Ready',
                ].map((item) => (
                  <div
                    key={item}
                    className="p-2.5 rounded-lg bg-neutral-900/60 border border-white/5 flex items-center gap-2 text-xs text-neutral-300"
                  >
                    <Check className="w-3.5 h-3.5 text-[#1ed760]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Launch Button */}
              <div className="pt-4">
                <button
                  data-testid="setup-launch-app-btn"
                  type="button"
                  onClick={handleLaunchApp}
                  className="w-full py-4 px-6 rounded-full font-black text-sm text-black flex items-center justify-center gap-2 shadow-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                  style={{ backgroundColor: accentColor }}
                >
                  <Rocket className="w-5 h-5" />
                  Launch {appName || 'AudioHub'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-6 text-xs text-neutral-500 font-medium">
        AudioHub Homelab Entertainment • Self-Hosted Hi-Fi Sound
      </footer>
    </div>
  );
};
