import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  Baby,
  CheckCircle2,
  Cookie,
  Download,
  ExternalLink,
  FileText,
  Film,
  HardDrive,
  Heart,
  Key,
  Lock,
  LogOut,
  Mail,
  Palette,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  Server,
  Shield,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  Tv,
  Upload,
  UserPlus,
  Users,
  UserX,
  Volume2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AzifyLogoMark } from '../components/AzifyLogoMark';
import { MusicImporter } from '../components/MusicImporter';
import { NfcInviteModal } from '../components/NfcInviteModal';
import { PairDeviceModal } from '../components/PairDeviceModal';
import { forcePwaUpdate } from '../components/PwaUpdateBanner';
import { fetchServerBranding, useBranding } from '../config/branding';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { usePwaInstall } from '../context/PwaInstallContext';
import { getServerBaseUrl, isStandaloneApp } from '../utils/apiConfig';

type TabType =
  | 'app'
  | 'storage'
  | 'importer'
  | 'users'
  | 'cookies'
  | 'email'
  | 'activity'
  | 'diagnostics'
  | 'branding';

export const SettingsView: React.FC = () => {
  const {
    storageStats,
    setStorageMode,
    refreshStorageStats,
    autoVideoOnWifi,
    setAutoVideoOnWifi,
    networkInfo,
    crossfadeDuration,
    setCrossfadeDuration,
    isAutoplayEnabled,
    setIsAutoplayEnabled,
    isNormalizationEnabled,
    setIsNormalizationEnabled,
  } = usePlayer();
  const { currentUser, logout, switchProfile } = useAuth();
  const { isInstalled, isInstallable, promptInstall } = usePwaInstall();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = isSuperAdmin || currentUser?.role === 'admin' || currentUser?.is_admin;
  const isUnder13 = currentUser?.is_under_13;

  const [activeTab, setActiveTab] = useState<TabType>(isAdmin || isSuperAdmin ? 'storage' : 'app');
  const [showPairModal, setShowPairModal] = useState(false);
  const [showNfcModal, setShowNfcModal] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null,
  );

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ---------------- APK Sideload & PWA State ----------------
  const [apkInfo, setApkInfo] = useState<{
    available: boolean;
    size_mb?: number;
    filename?: string;
  } | null>(null);
  const [isUploadingApk, setIsUploadingApk] = useState(false);

  const fetchApkInfo = () => {
    fetch('/api/v1/download/apk/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setApkInfo(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchApkInfo();
  }, []);

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingApk(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/v1/admin/apk/upload', {
        method: 'POST',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
        body: formData,
      });
      if (res.ok) {
        showFeedback(`Successfully uploaded ${file.name}! Sideload APK is now live.`);
        fetchApkInfo();
      } else {
        const err = await res.json();
        showFeedback(err.detail || 'Upload failed', 'error');
      }
    } catch (e: any) {
      showFeedback(e.message || 'Network error', 'error');
    } finally {
      setIsUploadingApk(false);
      e.target.value = '';
    }
  };

  // ---------------- White-Label & Branding State ----------------
  const brand = useBranding();
  const [brandAppName, setBrandAppName] = useState(brand.appName);
  const [brandTagline, setBrandTagline] = useState(brand.tagline);
  const [brandAccentColor, setBrandAccentColor] = useState(brand.accentColor);
  const [savingBrand, setSavingBrand] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setBrandAppName(brand.appName);
    setBrandTagline(brand.tagline);
    setBrandAccentColor(brand.accentColor);
  }, [brand]);

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBrand(true);
    try {
      const res = await fetch('/api/v1/settings/branding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'X-User-Id': currentUser.id } : {}),
        },
        body: JSON.stringify({
          appName: brandAppName,
          tagline: brandTagline,
          accentColor: brandAccentColor,
        }),
      });
      if (res.ok) {
        showFeedback('Branding updated successfully! Reflecting across the app.');
        await fetchServerBranding();
      } else {
        const err = await res.json();
        showFeedback(err.detail || 'Failed to update branding', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message, 'error');
    } finally {
      setSavingBrand(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/v1/settings/branding/logo', {
        method: 'POST',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
        body: fd,
      });
      if (res.ok) {
        showFeedback('Custom logo uploaded successfully!');
        await fetchServerBranding();
      } else {
        const err = await res.json();
        showFeedback(err.detail || 'Failed to upload logo', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message, 'error');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleResetLogo = async () => {
    if (!confirm('Reset custom logo to default AudioHub icon?')) return;
    try {
      const res = await fetch('/api/v1/settings/branding/logo', {
        method: 'DELETE',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
      });
      if (res.ok) {
        showFeedback('Reset logo to default.');
        await fetchServerBranding();
      }
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  // ---------------- Storage & Engines State ----------------
  const [clearing, setClearing] = useState(false);
  const [engineVersions, setEngineVersions] = useState<{ yt_dlp?: string; ytmusicapi?: string }>(
    {},
  );
  const [updatingEngines, setUpdatingEngines] = useState(false);
  const isStreamOnly = storageStats?.storage_mode === 'stream_only';

  const fetchEngineVersions = () => {
    fetch('/api/v1/settings/engine-versions', {
      headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
    })
      .then((res) => res.json())
      .then((data) => setEngineVersions(data))
      .catch(console.error);
  };

  const handleUpdateEngines = async () => {
    setUpdatingEngines(true);
    try {
      const res = await fetch('/api/v1/settings/update-engines', {
        method: 'POST',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
      });
      const data = await res.json();
      if (data.versions) setEngineVersions(data.versions);
      if (data.success) {
        showFeedback('Engines updated to the latest versions successfully!');
      } else {
        showFeedback(data.error || 'Failed to update engines', 'error');
      }
    } catch (e: any) {
      showFeedback('Error: ' + e.message, 'error');
    } finally {
      setUpdatingEngines(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to delete all cached audio files?')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/v1/settings/storage/clear-cache', {
        method: 'POST',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
      });
      if (res.ok) {
        const data = await res.json();
        showFeedback(`Deleted ${data.deleted_files} cached tracks.`);
        await refreshStorageStats();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  };

  // ---------------- User Management (RBAC) State ----------------
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'super_admin' | 'admin' | 'user'>('user');
  const [newUnder13, setNewUnder13] = useState(false);
  const [newSendInvite, setNewSendInvite] = useState(false);

  // Password reset modal state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetSendEmail, setResetSendEmail] = useState(false);

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus(null);
    try {
      const res = await fetch(`/api/v1/version?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const dateStr = data.build_time ? new Date(data.build_time).toLocaleTimeString() : 'latest';
        setUpdateStatus(`Server release: ${data.etag || 'v1.0'} (${dateStr})`);
        showFeedback(`Checked server version: Build timestamp ${dateStr}`);
      } else {
        setUpdateStatus('Server online, version OK');
      }
    } catch {
      setUpdateStatus('Could not reach server to check version.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const fetchUsers = () => {
    if (!isAdmin) return;
    fetch('/api/v1/admin/users', {
      headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(console.error);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser?.id || '',
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          email: newEmail.trim() || null,
          display_name: newDisplayName.trim() || newUsername.trim(),
          password: newPassword,
          role: newRole,
          is_under_13: newUnder13,
          send_invite_email: newSendInvite,
        }),
      });

      if (res.ok) {
        setShowAddUser(false);
        setNewUsername('');
        setNewEmail('');
        setNewDisplayName('');
        setNewPassword('');
        setNewRole('user');
        setNewUnder13(false);
        setNewSendInvite(false);
        showFeedback('User account created successfully!');
        fetchUsers();
      } else {
        const err = await res.json();
        showFeedback(err.detail || 'Failed to create user', 'error');
      }
    } catch (e: any) {
      showFeedback(e.message, 'error');
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`/api/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
      });
      if (res.ok) {
        showFeedback(`User ${name} deleted.`);
        fetchUsers();
      } else {
        const err = await res.json();
        showFeedback(err.detail || 'Failed to delete', 'error');
      }
    } catch (e: any) {
      showFeedback(e.message, 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId || !resetPasswordVal.trim()) return;

    try {
      const res = await fetch(`/api/v1/admin/users/${resetUserId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser?.id || '',
        },
        body: JSON.stringify({
          new_password: resetPasswordVal,
          send_email: resetSendEmail,
        }),
      });
      if (res.ok) {
        setResetUserId(null);
        setResetPasswordVal('');
        setResetSendEmail(false);
        showFeedback('Password updated successfully!');
      } else {
        const err = await res.json();
        showFeedback(err.detail || 'Password reset failed', 'error');
      }
    } catch (e: any) {
      showFeedback(e.message, 'error');
    }
  };

  // ---------------- YouTube Cookies State ----------------
  const [cookieStatus, setCookieStatus] = useState<any>(null);
  const [pastedCookies, setPastedCookies] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);

  const fetchCookieStatus = () => {
    if (!isAdmin) return;
    fetch('/api/v1/admin/cookies/status', {
      headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
    })
      .then((res) => res.json())
      .then((data) => setCookieStatus(data))
      .catch(console.error);
  };

  const handleCookieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSavingCookies(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/v1/admin/cookies/upload', {
        method: 'POST',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        showFeedback(`Uploaded cookies file (${data.active_cookie_entries} entries loaded).`);
        fetchCookieStatus();
      } else {
        const err = await res.json();
        showFeedback(err.detail || 'Cookie upload failed', 'error');
      }
    } catch (e: any) {
      showFeedback(e.message, 'error');
    } finally {
      setSavingCookies(false);
    }
  };

  const handlePasteCookies = async () => {
    if (!pastedCookies.trim()) return;
    setSavingCookies(true);
    try {
      const res = await fetch('/api/v1/admin/cookies/paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser?.id || '',
        },
        body: JSON.stringify({ cookie_content: pastedCookies }),
      });
      if (res.ok) {
        const data = await res.json();
        setPastedCookies('');
        showFeedback(`Cookies saved (${data.active_cookie_entries} active entries).`);
        fetchCookieStatus();
      } else {
        const err = await res.json();
        showFeedback(err.detail || 'Failed to save cookies', 'error');
      }
    } catch (e: any) {
      showFeedback(e.message, 'error');
    } finally {
      setSavingCookies(false);
    }
  };

  const handleDeleteCookies = async () => {
    if (!confirm('Remove installed YouTube cookies?')) return;
    try {
      await fetch('/api/v1/admin/cookies', {
        method: 'DELETE',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
      });
      showFeedback('YouTube cookies removed.');
      fetchCookieStatus();
    } catch (e: any) {
      showFeedback(e.message, 'error');
    }
  };

  // ---------------- Transactional Email State ----------------
  const [smtpConfig, setSmtpConfig] = useState<any>({
    email_provider: 'smtp',
    mail_api_url: '',
    mail_api_key: '',
    mail_enabled: 'true',
    smtp_enabled: 'false',
    smtp_host: 'smtp.example.com',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from: 'noreply@example.com',
    smtp_security: 'STARTTLS',
  });
  const [testEmailAddr, setTestEmailAddr] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const fetchEmailSettings = () => {
    if (!isSuperAdmin) return;
    fetch('/api/v1/admin/email/settings', {
      headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
    })
      .then((res) => res.json())
      .then((data) => setSmtpConfig((prev: any) => ({ ...prev, ...data })))
      .catch(console.error);
  };

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/admin/email/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser?.id || '',
        },
        body: JSON.stringify(smtpConfig),
      });
      if (res.ok) {
        showFeedback('Mail server settings saved successfully!');
      } else {
        showFeedback('Failed to save email settings', 'error');
      }
    } catch (e: any) {
      showFeedback(e.message, 'error');
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddr.trim()) return;
    setSendingTestEmail(true);
    try {
      const res = await fetch('/api/v1/admin/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser?.id || '',
        },
        body: JSON.stringify({ target_email: testEmailAddr.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`Test email sent to ${testEmailAddr}! Check inbox.`);
      } else {
        showFeedback(data.error || 'Failed to send test email', 'error');
      }
    } catch (e: any) {
      showFeedback(e.message, 'error');
    } finally {
      setSendingTestEmail(false);
    }
  };

  // ---------------- Activity Logs State ----------------
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchActivityLogs = () => {
    if (!isAdmin) return;
    setLoadingLogs(true);
    fetch('/api/v1/admin/activity-logs?limit=80', {
      headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
    })
      .then((res) => res.json())
      .then((data) => setActivityLogs(data))
      .catch(console.error)
      .finally(() => setLoadingLogs(false));
  };

  // ---------------- Engine Diagnostics State ----------------
  const [diagnosticData, setDiagnosticData] = useState<{ has_bot_alert: boolean; logs: any[] }>({
    has_bot_alert: false,
    logs: [],
  });
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  const fetchDiagnostics = () => {
    if (!isAdmin) return;
    setLoadingDiagnostics(true);
    fetch('/api/v1/admin/engine-diagnostics?limit=50', {
      headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
    })
      .then((res) => res.json())
      .then((data) => setDiagnosticData(data))
      .catch(console.error)
      .finally(() => setLoadingDiagnostics(false));
  };

  const handleClearDiagnostics = async () => {
    try {
      await fetch('/api/v1/admin/engine-diagnostics/clear', {
        method: 'DELETE',
        headers: currentUser ? { 'X-User-Id': currentUser.id } : {},
      });
      showFeedback('Diagnostic logs cleared.');
      fetchDiagnostics();
    } catch (e: any) {
      showFeedback(e.message, 'error');
    }
  };

  // Initial data loading
  useEffect(() => {
    fetchEngineVersions();
    if (isAdmin) {
      fetchUsers();
      fetchCookieStatus();
      fetchDiagnostics();
    }
    if (isSuperAdmin) {
      fetchEmailSettings();
    }
  }, [currentUser]);

  // Tab change triggers
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'cookies') fetchCookieStatus();
    if (activeTab === 'email') fetchEmailSettings();
    if (activeTab === 'activity') fetchActivityLogs();
    if (activeTab === 'diagnostics') fetchDiagnostics();
  }, [activeTab]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#121212] p-4 md:p-8 text-white max-w-5xl w-full mx-auto pb-40">
      {/* Feedback Alert Toast */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2 text-sm font-semibold transition-all ${
            feedback.type === 'error'
              ? 'bg-red-500/20 border-red-500 text-red-300'
              : 'bg-spotify-green/20 border-spotify-green text-spotify-green'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Header & User Profile Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10 pt-[max(env(safe-area-inset-top,0px),1.75rem)] md:pt-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              AudioHub Admin & Settings
            </h1>
            {isSuperAdmin && (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold">
                Super Admin
              </span>
            )}
            {currentUser?.role === 'admin' && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[11px] font-bold">
                Admin
              </span>
            )}
            {isUnder13 && (
              <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[11px] font-bold flex items-center gap-1">
                <Baby className="w-3 h-3" /> Under 13 Account
              </span>
            )}
          </div>
          <p className="text-xs text-spotify-gray mt-1">
            Logged in as{' '}
            <b className="text-white">{currentUser?.display_name || currentUser?.username}</b> (
            {currentUser?.email || currentUser?.username})
          </p>
        </div>

        <div className="self-start sm:self-center flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowNfcModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all shadow-sm active:scale-95"
              title="Invite Guest by tapping phones back-to-back (Web NFC)"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>NFC Invite</span>
            </button>
          )}

          <button
            onClick={() => setShowPairModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all shadow-sm active:scale-95"
            title="Log in on phone or tablet by scanning a QR code"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Pair Device</span>
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Device Pairing Transfer Modal */}
      <PairDeviceModal isOpen={showPairModal} onClose={() => setShowPairModal(false)} />

      {/* Web NFC Guest Invite Modal */}
      <NfcInviteModal isOpen={showNfcModal} onClose={() => setShowNfcModal(false)} />

      {/* Bot Detection Warning Banner */}
      {diagnosticData.has_bot_alert && (
        <div className="bg-red-500/10 border-2 border-red-500/60 rounded-xl p-4 mb-6 flex items-start justify-between gap-3 text-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0 animate-bounce" />
            <div>
              <h3 className="text-sm font-bold text-white">YouTube Anti-Bot Challenge Flagged</h3>
              <p className="text-xs text-red-300/90 mt-0.5">
                YouTube has challenged stream requests with bot verification. Please export your
                YouTube cookies and use the <b>YouTube Cookies</b> tab to upload them.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('cookies')}
            className="px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold whitespace-nowrap transition-all shadow-md"
          >
            Upload Cookies
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6 border-b border-white/10 scrollbar-none">
        <button
          onClick={() => setActiveTab('app')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'app'
              ? 'bg-spotify-green text-black'
              : 'text-spotify-gray hover:text-white hover:bg-white/5'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>App & Playback</span>
        </button>

        <button
          onClick={() => setActiveTab('importer')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'importer'
              ? 'bg-spotify-green text-black'
              : 'text-spotify-gray hover:text-white hover:bg-white/5'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          <span>Music Importer</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('storage')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'storage'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white hover:bg-white/5'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Storage & Engines</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'users'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Family & RBAC</span>
            </button>

            <button
              onClick={() => setActiveTab('cookies')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'cookies'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white hover:bg-white/5'
              }`}
            >
              <Cookie className="w-4 h-4" />
              <span>YouTube Cookies</span>
              {cookieStatus?.has_cookies && (
                <span className="w-2 h-2 rounded-full bg-spotify-green ml-0.5" />
              )}
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('email')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'email'
                    ? 'bg-spotify-green text-black'
                    : 'text-spotify-gray hover:text-white hover:bg-white/5'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Email & SMTP</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('activity')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'activity'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white hover:bg-white/5'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Activity Logs</span>
            </button>

            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'diagnostics'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white hover:bg-white/5'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Engine Diagnostics</span>
              {diagnosticData.has_bot_alert && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping ml-0.5" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('branding')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'branding'
                  ? 'bg-spotify-green text-black'
                  : 'text-spotify-gray hover:text-white hover:bg-white/5'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Family Name & Logo</span>
            </button>
          </>
        )}
      </div>

      {/* ---------------- TAB 0: App, PWA Updates & Playback Settings ---------------- */}
      {activeTab === 'app' && (
        <div className="flex flex-col gap-6">
          {/* PWA & Mobile App Version & Updates */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-spotify-green" />
                  <span>PWA Version & App Updates</span>
                </h2>
                <p className="text-xs text-spotify-gray mt-1">
                  Installed mobile apps and PWAs cache frontend assets. Force your device to purge
                  cached bundles and run the latest release immediately.
                </p>
              </div>
              {updateStatus && (
                <span className="text-[11px] font-mono text-spotify-green bg-spotify-green/10 border border-spotify-green/20 px-2.5 py-1 rounded-full flex-shrink-0">
                  {updateStatus}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
                <span>{checkingUpdate ? 'Checking Server...' : 'Check for Updates'}</span>
              </button>

              <button
                onClick={() => forcePwaUpdate()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-spotify-green text-black hover:bg-[#1fdf64] active:scale-95 text-xs font-extrabold transition-all shadow-md"
                title="Unregisters stale service workers, clears cache, and reloads"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span>Purge Cache & Force Reload PWA</span>
              </button>
            </div>
          </div>

          {/* Progressive Web App (PWA) Card */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-spotify-green" />
                <span>AudioHub Web App (PWA)</span>
              </h2>
              {isInstalled ? (
                <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-spotify-green/20 text-spotify-green font-bold border border-spotify-green/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Installed (Standalone)
                </span>
              ) : (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-spotify-gray font-medium">
                  Browser Tab
                </span>
              )}
            </div>
            <p className="text-xs text-spotify-gray mb-4 leading-relaxed">
              Install AudioHub as a standalone desktop or mobile application for continuous
              lock-screen playback, hardware media keys, and zero browser tab clutter.
            </p>

            {isInstalled ? (
              <div className="bg-spotify-green/10 border border-spotify-green/20 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-spotify-green flex-shrink-0" />
                <div className="text-xs text-spotify-gray">
                  <span className="font-semibold text-white block">
                    You are running the installed application.
                  </span>
                  Hardware media keys, background lockscreen audio, and offline caching are fully
                  active.
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#242424] p-4 rounded-xl border border-white/5">
                <div>
                  <h4 className="text-xs font-semibold text-white">One-Click App Install</h4>
                  <p className="text-[11px] text-spotify-gray mt-0.5">
                    {isInstallable
                      ? 'Add AudioHub to your taskbar, home screen, or desktop in 1 click.'
                      : 'Use your browser options to install AudioHub or launch on mobile Safari.'}
                  </p>
                </div>
                <button
                  onClick={promptInstall}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-spotify-green text-black font-extrabold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Install AudioHub App</span>
                </button>
              </div>
            )}
          </div>

          {/* Music Video & Wi-Fi Strategy Card */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Film className="w-5 h-5 text-spotify-green" />
                <span>Music Video & Wi-Fi Strategy</span>
              </h2>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold w-fit">
                {networkInfo.isWifiOrFast ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-spotify-green" />
                    <span className="text-white">Connected to Wi-Fi / High-Speed</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-yellow-400">Mobile Data / Metered</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-spotify-gray mb-4 leading-relaxed">
              Every YouTube song includes official music videos. You can switch between pure audio
              and 1080p HD video anytime using the{' '}
              <span className="text-white font-semibold">Song / Video</span> toggle in Now Playing
              or the Stage visualizer.
            </p>

            <div className="bg-[#242424] p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-semibold text-white">Auto-Switch to Video on Wi-Fi</h4>
                <p className="text-[11px] text-spotify-gray mt-0.5">
                  Automatically switch to the official music video when playback begins on a Wi-Fi
                  connection, saving mobile data when on cellular.
                </p>
              </div>
              <button
                onClick={() => setAutoVideoOnWifi(!autoVideoOnWifi)}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  autoVideoOnWifi ? 'bg-spotify-green' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                    autoVideoOnWifi ? 'left-6.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Audio Playback & Crossfade Engine */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-spotify-green" />
                <span>Audio Playback & Crossfade Engine</span>
              </h2>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-spotify-green/20 text-spotify-green font-bold border border-spotify-green/30 w-fit">
                Dual-Deck Gapless 0ms
              </span>
            </div>

            <p className="text-xs text-spotify-gray leading-relaxed">
              AudioHub's dual-deck audio engine pre-buffers upcoming songs in the background to
              completely eliminate track loading latency, offering zero-delay gapless playback or
              seamless studio crossfading.
            </p>

            {/* Crossfade Duration Slider */}
            <div className="bg-[#242424] p-4 sm:p-5 rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Crossfade Duration</h4>
                  <p className="text-[11px] text-spotify-gray mt-0.5">
                    Smoothly transitions between songs by fading out the current track while fading
                    in the next.
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      crossfadeDuration === 0
                        ? 'bg-spotify-green/20 text-spotify-green border-spotify-green/30'
                        : 'bg-white/10 text-white border-white/20'
                    }`}
                  >
                    {crossfadeDuration === 0
                      ? 'Off (Gapless - 0ms)'
                      : `${crossfadeDuration}s Crossfade`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-[11px] text-spotify-gray font-mono">0s</span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={crossfadeDuration}
                  onChange={(e) => setCrossfadeDuration(parseInt(e.target.value, 10))}
                  className="w-full accent-spotify-green h-1.5 bg-white/20 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] text-spotify-gray font-mono">12s</span>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { label: 'Gapless (0s)', val: 0 },
                  { label: 'Subtle (2s)', val: 2 },
                  { label: 'Standard (4s)', val: 4 },
                  { label: 'DJ Blend (8s)', val: 8 },
                  { label: 'Deep (12s)', val: 12 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setCrossfadeDuration(preset.val)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      crossfadeDuration === preset.val
                        ? 'bg-spotify-green text-black shadow-md'
                        : 'bg-white/5 text-spotify-gray hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Continuous Autoplay Radio */}
            <div className="bg-[#242424] p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-semibold text-white">Continuous Autoplay Radio</h4>
                <p className="text-[11px] text-spotify-gray mt-0.5">
                  Keep the music flowing. When your playlist or album reaches the end, AudioHub
                  automatically queues related songs based on your queue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoplayEnabled(!isAutoplayEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  isAutoplayEnabled ? 'bg-spotify-green' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                    isAutoplayEnabled ? 'left-6.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Volume Normalization */}
            <div className="bg-[#242424] p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-semibold text-white">Audio Loudness Normalization</h4>
                <p className="text-[11px] text-spotify-gray mt-0.5">
                  Real-time dynamic compressor balances quiet and loud tracks so you don't have to
                  adjust the volume.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNormalizationEnabled(!isNormalizationEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  isNormalizationEnabled ? 'bg-spotify-green' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                    isNormalizationEnabled ? 'left-6.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* App Downloads & Mobile Installation */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Download className="w-5 h-5 text-spotify-green" />
                <span>Get the App (PWA & Android Sideload)</span>
              </h2>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-spotify-green/20 text-spotify-green font-bold border border-spotify-green/30 w-fit">
                Zero Play Store Friction
              </span>
            </div>

            <p className="text-xs text-spotify-gray leading-relaxed">
              AudioHub is designed to be self-hosted without reliance on app store approvals,
              account fees, or tracking. Choose your preferred way to install:
            </p>

            {/* Server Connection & Quick-Pair Bar */}
            <div className="bg-[#1f1f23] p-4 rounded-xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-spotify-green/20 text-spotify-green border border-spotify-green/30 flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">Active Server Endpoint:</span>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      {getServerBaseUrl() || window.location.origin}
                    </span>
                  </div>
                  <p className="text-[11px] text-spotify-gray mt-0.5">
                    Target server for Android TV, APK, and Smart TV companion apps.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('audiohub:open-server-connect'))
                  }
                  className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Configure Server</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Option 1: PWA (Recommended) */}
              <div className="bg-[#242424] p-5 rounded-xl border border-white/5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-spotify-green/20 text-spotify-green flex items-center justify-center font-bold">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-white">Instant PWA</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Zero storage footprint. Instant full-screen playback, audio background controls,
                    and automatic updates whenever the server deploys.
                  </p>
                  <ul className="text-[11px] text-spotify-gray space-y-1 list-disc ml-4">
                    <li>
                      <b>iOS (iPhone/iPad):</b> Safari → Share → Add to Home Screen
                    </li>
                    <li>
                      <b>Android:</b> Chrome / Edge → Install App
                    </li>
                    <li>
                      <b>Smart TV / PC:</b> Add to Home Screen / Desktop
                    </li>
                  </ul>
                </div>

                <button
                  onClick={promptInstall}
                  className="w-full py-2.5 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isInstalled ? '✓ PWA Already Installed' : 'Install PWA on this Device'}
                  </span>
                </button>
              </div>

              {/* Option 2: Android APK Sideload */}
              <div className="bg-[#242424] p-5 rounded-xl border border-white/5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                        <Download className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-white">Android APK (Mobile & TV)</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Mobile + TV
                    </span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Direct installation package (.apk) for Android phones, tablets, Google TV,
                    Android TV, and Fire TV with 10-foot remote support.
                  </p>
                  <div className="text-[11px] text-spotify-gray flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>
                      {apkInfo?.available
                        ? `${apkInfo.filename || 'audiohub.apk'} (${apkInfo.size_mb || '6.3'} MB)`
                        : 'audiohub.apk (6.3 MB)'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href="/api/v1/download/apk"
                    download="audiohub.apk"
                    className="w-full py-2.5 px-4 rounded-full font-bold text-xs transition-all flex items-center justify-center gap-2 bg-spotify-green hover:bg-spotify-green/90 text-black shadow-lg shadow-spotify-green/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Android APK</span>
                  </a>

                  {isAdmin && (
                    <label className="w-full py-1.5 px-3 rounded-lg border border-dashed border-white/20 hover:border-spotify-green/50 text-[11px] text-spotify-gray hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                      <span>
                        {isUploadingApk ? 'Uploading APK...' : 'Admin: Upload New APK Build'}
                      </span>
                      <input
                        type="file"
                        accept=".apk"
                        onChange={handleApkUpload}
                        disabled={isUploadingApk}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Option 3: Samsung Smart TV (.wgt) */}
              <div className="bg-[#242424] p-5 rounded-xl border border-white/5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                        <Tv className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-white">Samsung Smart TV (Tizen)</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Tizen .wgt
                    </span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    W3C Widget package (.wgt) for Samsung Smart TVs (2018+). Sideload via Tizen
                    Studio CLI (SDB) or Developer Mode.
                  </p>
                  <div className="text-[11px] text-spotify-gray flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>audiohub.wgt (~2.0 MB) • Full Media Remote Support</span>
                  </div>
                </div>

                <a
                  href="/api/v1/download/tizen"
                  download="audiohub.wgt"
                  className="w-full py-2.5 px-4 rounded-full font-bold text-xs transition-all flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Tizen TV (.wgt)</span>
                </a>
              </div>

              {/* Option 4: LG Smart TV (.ipk) */}
              <div className="bg-[#242424] p-5 rounded-xl border border-white/5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold">
                        <Tv className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-white">LG Smart TV (webOS)</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      webOS .ipk
                    </span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Native webOS application (.ipk) for LG OLED/NanoCell TVs. Sideload easily using
                    webOS Dev Manager or Homebrew Channel.
                  </p>
                  <div className="text-[11px] text-spotify-gray flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>audiohub.ipk (~2.0 MB) • Magic Remote Support</span>
                  </div>
                </div>

                <a
                  href="/api/v1/download/webos"
                  download="audiohub.ipk"
                  className="w-full py-2.5 px-4 rounded-full font-bold text-xs transition-all flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download LG webOS (.ipk)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Symfonium Companion */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
            <h2 className="text-lg md:text-xl font-bold mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-spotify-green" />
              <span>Symfonium Setup (Android / Android Auto)</span>
            </h2>
            <p className="text-xs text-spotify-gray mb-3 leading-relaxed">
              Connect your phones via Subsonic API using your personal credentials:
            </p>

            <div className="bg-[#242424] p-3.5 rounded-lg font-mono text-xs flex flex-col gap-2">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-spotify-gray">Server Type:</span>
                <span className="text-white font-bold">Subsonic</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-spotify-gray">Server URL:</span>
                <span className="text-spotify-green select-all font-mono">
                  {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4533'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-spotify-gray">Credentials:</span>
                <span className="text-white">Your Username/Email & Password</span>
              </div>
            </div>
          </div>

          {/* Support the Project */}
          <div className="bg-gradient-to-r from-[#181818] via-[#1c1a24] to-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h2 className="text-base md:text-lg font-bold flex items-center gap-2 text-white">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span>Support Open-Source Development</span>
              </h2>
              <p className="text-xs text-spotify-gray leading-relaxed max-w-xl">
                AudioHub is 100% free, open-source, and built with zero tracking or subscription
                walls. If you enjoy running it on your home server, consider buying the developer a
                coffee!
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href="https://paypal.me/AMayo300"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>Donate via PayPal</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 1: Storage & Extraction Engines (Admin / Super Admin Only) ---------------- */}
      {isAdmin && activeTab === 'storage' && (
        <div className="flex flex-col gap-6">
          {/* Storage Mode Selector */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-spotify-green" />
                <span>Storage & Streaming Strategy</span>
              </h2>
              {isSuperAdmin ? (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 w-fit">
                  Super Admin Configured
                </span>
              ) : (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 font-bold border border-yellow-500/30 flex items-center gap-1 w-fit">
                  <Lock className="w-3 h-3" /> Super Admin Only
                </span>
              )}
            </div>
            <p className="text-xs text-spotify-gray mb-4 leading-relaxed">
              Control how audio is handled on your media server. Switch modes anytime.
            </p>

            {!isSuperAdmin && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>
                  Streaming & Storage Strategy is locked. Only the Super Admin can toggle between
                  Stream Only and Stream + Save.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Stream Only */}
              <div
                onClick={() => {
                  if (isSuperAdmin) {
                    setStorageMode('stream_only');
                  } else {
                    showFeedback(
                      'Only the Super Admin can toggle server storage strategies.',
                      'error',
                    );
                  }
                }}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                  isSuperAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                } ${
                  isStreamOnly
                    ? 'border-yellow-400 bg-yellow-400/5'
                    : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span>Stream Only (Active)</span>
                    </div>
                    {isStreamOnly && <CheckCircle2 className="w-4 h-4 text-yellow-400" />}
                  </div>
                  <p className="text-xs text-spotify-gray leading-relaxed">
                    Zero disk footprint on your media server drives. Audio streams directly into
                    memory buffers.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] font-mono text-yellow-400 block">
                    0 MB Disk Usage
                  </span>
                  {!isSuperAdmin && <Lock className="w-3.5 h-3.5 text-spotify-gray" />}
                </div>
              </div>

              {/* Stream + Save */}
              <div
                onClick={() => {
                  if (isSuperAdmin) {
                    setStorageMode('stream_and_cache');
                  } else {
                    showFeedback(
                      'Only the Super Admin can toggle server storage strategies.',
                      'error',
                    );
                  }
                }}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                  isSuperAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                } ${
                  !isStreamOnly
                    ? 'border-spotify-green bg-spotify-green/5'
                    : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <HardDrive className="w-4 h-4 text-spotify-green" />
                      <span>Stream + Save to Disk</span>
                    </div>
                    {!isStreamOnly && <CheckCircle2 className="w-4 h-4 text-spotify-green" />}
                  </div>
                  <p className="text-xs text-spotify-gray leading-relaxed">
                    Plays immediately in &lt;1s while saving and tagging tracks into{' '}
                    <code className="text-white">/music</code>.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] font-mono text-spotify-green block">
                    Permanent Storage
                  </span>
                  {!isSuperAdmin && <Lock className="w-3.5 h-3.5 text-spotify-gray" />}
                </div>
              </div>
            </div>
          </div>

          {/* Disk Space & Cache Management */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
            <h2 className="text-lg md:text-xl font-bold mb-3">Server Disk Usage</h2>
            {storageStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="bg-[#242424] p-3 rounded-lg">
                  <span className="text-[11px] text-spotify-gray block">Cached Songs</span>
                  <span className="text-xl font-bold text-white mt-0.5 block">
                    {storageStats.cached_tracks_count}
                  </span>
                </div>
                <div className="bg-[#242424] p-3 rounded-lg">
                  <span className="text-[11px] text-spotify-gray block">Cached Size</span>
                  <span className="text-xl font-bold text-white mt-0.5 block">
                    {storageStats.cached_size_mb} MB
                  </span>
                </div>
                <div className="bg-[#242424] p-3 rounded-lg">
                  <span className="text-[11px] text-spotify-gray block">Free Space</span>
                  <span className="text-xl font-bold text-spotify-green mt-0.5 block">
                    {storageStats.disk_free_gb} GB
                  </span>
                </div>
                <div className="bg-[#242424] p-3 rounded-lg">
                  <span className="text-[11px] text-spotify-gray block">Total Drive</span>
                  <span className="text-xl font-bold text-white mt-0.5 block">
                    {storageStats.disk_total_gb} GB
                  </span>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div>
                  <h4 className="text-xs font-semibold text-white">Purge Local Cache</h4>
                  <p className="text-[11px] text-spotify-gray">
                    Free up space immediately by deleting cached audio files.
                  </p>
                </div>
                <button
                  onClick={handleClearCache}
                  disabled={clearing}
                  className="px-3.5 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{clearing ? 'Clearing...' : 'Clear Cache'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Extraction Engines */}
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <RefreshCw
                  className={`w-5 h-5 text-spotify-green ${updatingEngines ? 'animate-spin' : ''}`}
                />
                <span>Extraction Engines</span>
              </h2>
              {isSuperAdmin && (
                <button
                  onClick={handleUpdateEngines}
                  disabled={updatingEngines}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-spotify-green text-black hover:bg-spotify-green/90 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${updatingEngines ? 'animate-spin' : ''}`} />
                  <span>{updatingEngines ? 'Updating...' : 'Check for Engine Updates'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-spotify-gray mb-4 leading-relaxed">
              AudioHub automatically checks and updates core extraction packages every 3 days in the
              background so YouTube format shifts never interrupt your music.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-1">
              <div className="bg-[#242424] p-3 rounded-lg border border-white/5">
                <span className="text-[11px] text-spotify-gray block">yt-dlp Engine</span>
                <span className="text-sm font-mono font-bold text-white mt-0.5 block truncate">
                  {engineVersions.yt_dlp || 'Detecting...'}
                </span>
              </div>
              <div className="bg-[#242424] p-3 rounded-lg border border-white/5">
                <span className="text-[11px] text-spotify-gray block">ytmusicapi Engine</span>
                <span className="text-sm font-mono font-bold text-white mt-0.5 block truncate">
                  {engineVersions.ytmusicapi || 'Detecting...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB: Music & Playlist Importer ---------------- */}
      {activeTab === 'importer' && <MusicImporter />}

      {/* ---------------- TAB 2: Family & RBAC Users ---------------- */}
      {isAdmin && activeTab === 'users' && (
        <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-spotify-green" />
                <span>Family Members & RBAC</span>
              </h2>
              <p className="text-xs text-spotify-gray mt-1">
                Public sign-ups are disabled. Only Admins can add or invite family accounts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNfcModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all shadow-sm active:scale-95"
                title="Invite Guest by tapping phones back-to-back (Web NFC)"
              >
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span>NFC Invite</span>
              </button>
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-spotify-green text-black hover:bg-[#1fdf64] text-xs font-bold transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Member</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-white/5">
            {users.map((u) => (
              <div
                key={u.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-spotify-green flex-shrink-0">
                    {u.display_name?.[0]?.toUpperCase() || u.username[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate max-w-[160px] sm:max-w-xs">
                        {u.display_name}
                      </span>
                      {u.role === 'super_admin' && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                          Super Admin
                        </span>
                      )}
                      {u.role === 'admin' && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold">
                          Admin
                        </span>
                      )}
                      {u.is_under_13 && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] font-bold flex items-center gap-0.5">
                          <Baby className="w-3 h-3" /> Under 13
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-spotify-gray flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-white/70">@{u.username}</span>
                      {u.email && (
                        <span className="truncate max-w-[160px] sm:max-w-xs">• {u.email}</span>
                      )}
                      {u.last_login_at && (
                        <span className="text-[11px] opacity-75">
                          • Last active: {new Date(u.last_login_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      const text = `You're invited to our family music streaming server!\nURL: ${window.location.origin}\nUsername: ${u.username}\n(Use the password created by your admin to log in)`;
                      navigator.clipboard.writeText(text);
                      showFeedback(`Copied invite text for @${u.username} to clipboard!`);
                    }}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs flex items-center gap-1"
                    title="Copy Invite Message"
                  >
                    <Send className="w-3.5 h-3.5 text-spotify-green" />
                    <span className="hidden sm:inline">Copy Invite</span>
                  </button>

                  <button
                    onClick={() => {
                      setResetUserId(u.id);
                      setResetPasswordVal('');
                    }}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs flex items-center gap-1"
                    title="Reset Password"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reset Pass</span>
                  </button>

                  {u.id !== currentUser?.id && u.role !== 'super_admin' && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.display_name || u.username)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all text-xs"
                      title="Delete User"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: YouTube Cookies Tool ---------------- */}
      {isAdmin && activeTab === 'cookies' && (
        <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Cookie className="w-5 h-5 text-spotify-green" />
              <span>YouTube Cookie Authorization Tool</span>
            </h2>
            {cookieStatus?.has_cookies && (
              <button
                onClick={handleDeleteCookies}
                className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold"
              >
                Remove Cookies
              </button>
            )}
          </div>
          <p className="text-xs text-spotify-gray mb-5 leading-relaxed">
            If YouTube blocks streaming requests with bot or captcha challenges, export your YouTube
            cookies on any PC and upload or paste them here. AudioHub will immediately use them for
            extraction.
          </p>

          {/* Status Box */}
          <div className="bg-[#242424] p-4 rounded-xl mb-6 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  cookieStatus?.has_cookies ? 'bg-spotify-green animate-pulse' : 'bg-yellow-400'
                }`}
              />
              <div>
                <span className="text-sm font-bold text-white block">
                  {cookieStatus?.has_cookies
                    ? `Active Cookies Loaded (${cookieStatus.active_cookie_entries} entries)`
                    : 'No YouTube Cookies Installed'}
                </span>
                <span className="text-xs text-spotify-gray">
                  {cookieStatus?.has_cookies
                    ? `File size: ${(cookieStatus.file_size_bytes / 1024).toFixed(1)} KB • Path: ${cookieStatus.path}`
                    : 'AudioHub currently streams using standard guest headers.'}
                </span>
              </div>
            </div>
          </div>

          {/* Method 1: File Upload */}
          <div className="bg-[#1f1f1f] p-4 rounded-xl mb-4 border border-white/5">
            <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-2">
              <Upload className="w-4 h-4 text-spotify-green" />
              <span>Method 1: Upload cookies.txt File</span>
            </h4>
            <p className="text-[11px] text-spotify-gray mb-3">
              Use a browser extension like <i>"Get cookies.txt LOCALLY"</i> on YouTube, export the
              file, and upload it here.
            </p>
            <input
              type="file"
              accept=".txt"
              onChange={handleCookieUpload}
              disabled={savingCookies}
              className="text-xs text-spotify-gray file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-spotify-green file:text-black hover:file:bg-[#1fdf64] file:cursor-pointer"
            />
          </div>

          {/* Method 2: Paste Raw Content */}
          <div className="bg-[#1f1f1f] p-4 rounded-xl border border-white/5">
            <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4 text-spotify-green" />
              <span>Method 2: Paste Raw Cookie Text</span>
            </h4>
            <p className="text-[11px] text-spotify-gray mb-3">
              Directly paste the contents of your Netscape-formatted YouTube cookies below.
            </p>
            <textarea
              rows={4}
              placeholder="# Netscape HTTP Cookie File&#10;.youtube.com  TRUE  /  TRUE  1798765432  SID  xxxxxx..."
              value={pastedCookies}
              onChange={(e) => setPastedCookies(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-spotify-green"
            />
            <button
              onClick={handlePasteCookies}
              disabled={savingCookies || !pastedCookies.trim()}
              className="mt-3 px-4 py-2 rounded-full bg-spotify-green text-black font-bold text-xs hover:bg-[#1fdf64] transition-all disabled:opacity-50"
            >
              {savingCookies ? 'Applying...' : 'Save & Reload Engine'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- TAB 4: Transactional Email / SMTP ---------------- */}
      {isSuperAdmin && activeTab === 'email' && (
        <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Mail className="w-5 h-5 text-spotify-green" />
              <span>Transactional Email & SMTP Server</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-spotify-gray font-medium">Status:</span>
              <button
                type="button"
                onClick={() =>
                  setSmtpConfig({
                    ...smtpConfig,
                    mail_enabled: smtpConfig.mail_enabled === 'true' ? 'false' : 'true',
                    smtp_enabled: smtpConfig.mail_enabled === 'true' ? 'false' : 'true',
                  })
                }
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  smtpConfig.mail_enabled === 'true' || smtpConfig.smtp_enabled === 'true'
                    ? 'bg-spotify-green text-black'
                    : 'bg-white/10 text-spotify-gray'
                }`}
              >
                {smtpConfig.mail_enabled === 'true' || smtpConfig.smtp_enabled === 'true'
                  ? 'Enabled'
                  : 'Disabled'}
              </button>
            </div>
          </div>
          <p className="text-xs text-spotify-gray mb-4 leading-relaxed">
            AudioHub sends family member invites and password reset emails. You can send via an HTTP
            Mail Webhook API or direct SMTP.
          </p>

          {/* Provider Selection */}
          <div className="flex items-center gap-2 mb-6 p-1 bg-[#242424] rounded-lg w-fit border border-white/5">
            <button
              type="button"
              onClick={() => setSmtpConfig({ ...smtpConfig, email_provider: 'http_api' })}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                (smtpConfig.email_provider || 'smtp') === 'http_api'
                  ? 'bg-spotify-green text-black shadow'
                  : 'text-spotify-gray hover:text-white'
              }`}
            >
              HTTP Mail API
            </button>
            <button
              type="button"
              onClick={() => setSmtpConfig({ ...smtpConfig, email_provider: 'smtp' })}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                (smtpConfig.email_provider || 'smtp') === 'smtp'
                  ? 'bg-spotify-green text-black shadow'
                  : 'text-spotify-gray hover:text-white'
              }`}
            >
              Direct SMTP
            </button>
          </div>

          <form onSubmit={handleSaveEmailSettings}>
            {(smtpConfig.email_provider || 'smtp') === 'http_api' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-spotify-gray block mb-1">
                    Mail Server API URL
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.mail_api_url || ''}
                    placeholder="https://mail.example.com/send"
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, mail_api_url: e.target.value })}
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-spotify-green"
                    required
                  />
                  <span className="text-[11px] text-spotify-gray mt-1 block">
                    Dedicated HTTP mail endpoint with automated deliverability and SPF/DKIM
                    verification.
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-spotify-gray block mb-1">
                    Mail API Key
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.mail_api_key || ''}
                    placeholder="e.g. your-mail-webhook-api-key"
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, mail_api_key: e.target.value })}
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-spotify-green"
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.smtp_host || 'smtp.example.com'}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-spotify-green"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.smtp_port || '587'}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: e.target.value })}
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-spotify-green"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1">
                    Username / Email
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.smtp_user || ''}
                    placeholder="e.g. music@yourdomain.com"
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-spotify-green"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={smtpConfig.smtp_password || ''}
                    placeholder="SMTP email password"
                    onChange={(e) =>
                      setSmtpConfig({ ...smtpConfig, smtp_password: e.target.value })
                    }
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-spotify-green"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1">
                    From Email Address
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.smtp_from || 'noreply@example.com'}
                    placeholder="e.g. AudioHub <noreply@example.com>"
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from: e.target.value })}
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-spotify-green"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-spotify-gray block mb-1">
                    Encryption Protocol
                  </label>
                  <select
                    value={smtpConfig.smtp_security || 'STARTTLS'}
                    onChange={(e) =>
                      setSmtpConfig({ ...smtpConfig, smtp_security: e.target.value })
                    }
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-spotify-green"
                  >
                    <option value="STARTTLS">STARTTLS (Port 587 - Recommended)</option>
                    <option value="SSL">SSL / TLS (Port 465)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="pt-5">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full bg-spotify-green text-black font-bold text-xs hover:bg-[#1fdf64] transition-all"
              >
                Save Email Settings
              </button>
            </div>
          </form>

          {/* Test Email Card */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-auto">
              <h4 className="text-xs font-bold text-white">Send Test Verification Email</h4>
              <p className="text-[11px] text-spotify-gray">
                Validate your SMTP credentials and delivery.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="email"
                placeholder="test@example.com"
                value={testEmailAddr}
                onChange={(e) => setTestEmailAddr(e.target.value)}
                className="bg-[#242424] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-spotify-green flex-1 sm:w-60"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTestEmail || !testEmailAddr.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingTestEmail ? 'Sending...' : 'Send Test'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 5: User Activity & Stream Logs ---------------- */}
      {isAdmin && activeTab === 'activity' && (
        <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-spotify-green" />
                <span>User Activity & Streaming Logs</span>
              </h2>
              <p className="text-xs text-spotify-gray mt-0.5">
                Audit trail of logins, song streams, and actions for future listening analytics.
              </p>
            </div>
            <button
              onClick={fetchActivityLogs}
              disabled={loadingLogs}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-all text-xs flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#242424] text-spotify-gray border-b border-white/5">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Details / Track</th>
                  <th className="p-3">Client IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-spotify-gray">
                      No activity logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="p-3 text-spotify-gray whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="p-3 text-white font-sans font-bold">{log.username}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.action === 'login'
                              ? 'bg-blue-500/20 text-blue-300'
                              : log.action === 'stream'
                                ? 'bg-spotify-green/20 text-spotify-green'
                                : 'bg-white/10 text-white'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-white/90 font-sans truncate max-w-xs">
                        {log.details || '—'}
                      </td>
                      <td className="p-3 text-spotify-gray">{log.ip_address || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- TAB 6: Engine Diagnostics ---------------- */}
      {isAdmin && activeTab === 'diagnostics' && (
        <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-spotify-green" />
                <span>Engine Diagnostics & Error Logs</span>
              </h2>
              <p className="text-xs text-spotify-gray mt-0.5">
                Real-time tracking for yt-dlp, YouTube bot detection, and audio pipeline exceptions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDiagnostics}
                disabled={loadingDiagnostics}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-all text-xs flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDiagnostics ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleClearDiagnostics}
                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all text-xs"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {diagnosticData.logs.length === 0 ? (
              <div className="p-8 text-center text-spotify-gray text-xs bg-[#242424] rounded-xl">
                No engine errors or bot detection alerts logged! Extraction engines are healthy.
              </div>
            ) : (
              diagnosticData.logs.map((d) => (
                <div
                  key={d.id}
                  className={`p-3.5 rounded-xl border text-xs flex flex-col gap-1 ${
                    d.level === 'BOT_DETECTED'
                      ? 'bg-red-500/10 border-red-500/40 text-red-200'
                      : d.level === 'ERROR'
                        ? 'bg-red-900/10 border-red-500/20 text-red-300'
                        : 'bg-[#242424] border-white/5 text-spotify-gray'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.level === 'BOT_DETECTED'
                            ? 'bg-red-500 text-white animate-pulse'
                            : d.level === 'ERROR'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-white/10 text-spotify-gray'
                        }`}
                      >
                        {d.level}
                      </span>
                      <span className="font-mono text-white/80 font-bold">[{d.source}]</span>
                    </div>
                    <span className="font-mono text-[11px] text-white/40">
                      {d.timestamp ? new Date(d.timestamp).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="font-sans text-white mt-1 font-semibold">{d.message}</p>
                  {d.details && (
                    <pre className="font-mono text-[11px] text-white/60 bg-black/40 p-2 rounded-lg overflow-x-auto mt-1 whitespace-pre-wrap">
                      {d.details}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB: White-Label & Family Name (Admin / Super Admin Only) ---------------- */}
      {isAdmin && activeTab === 'branding' && (
        <div className="flex flex-col gap-6">
          <div className="bg-[#181818] rounded-xl p-5 md:p-6 border border-white/5 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                  <Palette className="w-5 h-5 text-spotify-green" />
                  <span>Custom Server Branding & Family Name</span>
                </h2>
                <p className="text-xs text-spotify-gray mt-1">
                  Customize the name, tagline, and logo displayed across all phones, desktop
                  sidebars, login cards, and TVs connected to your server.
                </p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-spotify-green/20 text-spotify-green font-bold border border-spotify-green/30 w-fit">
                Instant Rebrand
              </span>
            </div>

            {/* Live Interactive Preview */}
            <div className="bg-[#121212] p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#181820] border border-white/10 p-2 flex items-center justify-center shadow-lg">
                  {brand.logoUrl &&
                  brand.logoUrl !== '/icon.svg?v=2' &&
                  brand.logoUrl !== '/icon.svg' ? (
                    <img
                      src={brand.logoUrl}
                      alt={brandAppName}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <AzifyLogoMark className="w-full h-full" animated glow />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-white">
                      {brandAppName || 'Your Family App'}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-spotify-gray uppercase font-bold tracking-wider">
                      Preview
                    </span>
                  </div>
                  <span className="text-xs text-spotify-gray">
                    {brandTagline || 'Private, Self-Hosted Music Streaming'}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                ✓ Live on all client devices
              </span>
            </div>

            {/* Branding Edit Form */}
            <form onSubmit={handleSaveBranding} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* App Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white block">
                    App / Family Server Name
                  </label>
                  <input
                    type="text"
                    value={brandAppName}
                    onChange={(e) => setBrandAppName(e.target.value)}
                    placeholder="e.g. AudioHub, Family Beats, SonicCloud"
                    className="w-full bg-[#242424] text-white px-4 py-2.5 rounded-xl border border-white/10 focus:border-spotify-green outline-none text-sm transition-colors"
                    required
                  />
                  <p className="text-[11px] text-spotify-gray">
                    Appears in the desktop sidebar, mobile header, PWA app title, and lock screen.
                  </p>
                </div>

                {/* Tagline */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white block">
                    Server Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={brandTagline}
                    onChange={(e) => setBrandTagline(e.target.value)}
                    placeholder="e.g. Private, Self-Hosted Music Streaming"
                    className="w-full bg-[#242424] text-white px-4 py-2.5 rounded-xl border border-white/10 focus:border-spotify-green outline-none text-sm transition-colors"
                  />
                  <p className="text-[11px] text-spotify-gray">
                    Displayed on the login card, TV leanback screen, and invite messages.
                  </p>
                </div>
              </div>

              {/* Logo Management */}
              <div className="bg-[#242424] p-4 rounded-xl border border-white/5 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-spotify-green" />
                  <span>Custom App Logo / Icon</span>
                </h4>
                <p className="text-xs text-spotify-gray leading-relaxed">
                  Upload a custom SVG, PNG, or WebP logo (square ratio recommended, e.g. 512x512)
                  for your family or organization.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="py-2 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer border border-white/10">
                    <Upload className="w-3.5 h-3.5 text-spotify-green" />
                    <span>{uploadingLogo ? 'Uploading Logo...' : 'Upload Logo Image'}</span>
                    <input
                      type="file"
                      accept=".png,.svg,.jpg,.jpeg,.webp"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleResetLogo}
                    className="py-2 px-4 rounded-full bg-white/5 hover:bg-white/10 text-spotify-gray hover:text-white text-xs font-semibold transition-all border border-white/5"
                  >
                    Reset to Default Logo
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingBrand}
                  className="py-2.5 px-6 rounded-full bg-spotify-green hover:bg-spotify-green/90 text-black font-extrabold text-sm transition-all shadow-lg shadow-spotify-green/20 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savingBrand ? 'Saving Changes...' : 'Save Branding Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- Add Profile Modal ---------------- */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddUser}
            className="bg-[#242424] p-6 rounded-2xl max-w-md w-full flex flex-col gap-4 shadow-2xl border border-white/10"
          >
            <h3 className="text-white text-lg font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-spotify-green" />
              <span>Create Family Account</span>
            </h3>

            <div>
              <label className="text-xs text-spotify-gray block mb-1">Display Name</label>
              <input
                type="text"
                placeholder="e.g. Alex, Sarah, Dad"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full bg-[#333333] text-white px-3.5 py-2 rounded-lg outline-none focus:ring-2 focus:ring-spotify-green text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs text-spotify-gray block mb-1">Username</label>
              <input
                type="text"
                placeholder="e.g. sarah"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-[#333333] text-white px-3.5 py-2 rounded-lg outline-none focus:ring-2 focus:ring-spotify-green text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs text-spotify-gray block mb-1">Email Address</label>
              <input
                type="email"
                placeholder="sarah@example.com (Required for invites)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-[#333333] text-white px-3.5 py-2 rounded-lg outline-none focus:ring-2 focus:ring-spotify-green text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-spotify-gray block mb-1">Password</label>
              <input
                type="password"
                placeholder="Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#333333] text-white px-3.5 py-2 rounded-lg outline-none focus:ring-2 focus:ring-spotify-green text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs text-spotify-gray block mb-1">Account Role</label>
              <select
                value={newRole}
                onChange={(e: any) => setNewRole(e.target.value)}
                className="w-full bg-[#333333] text-white px-3.5 py-2 rounded-lg outline-none focus:ring-2 focus:ring-spotify-green text-sm"
              >
                <option value="user">Member (Standard Family Profile)</option>
                <option value="admin">Admin (Can manage users & cookies)</option>
                {isSuperAdmin && (
                  <option value="super_admin">Super Admin (Full Server Control)</option>
                )}
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                <input
                  type="checkbox"
                  checked={newUnder13}
                  onChange={(e) => setNewUnder13(e.target.checked)}
                  className="rounded text-spotify-green focus:ring-0"
                />
                <span className="flex items-center gap-1 font-semibold">
                  <Baby className="w-4 h-4 text-yellow-400" />
                  <span>Under 13 Account (Kid Profile)</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                <input
                  type="checkbox"
                  checked={newSendInvite}
                  onChange={(e) => setNewSendInvite(e.target.checked)}
                  className="rounded text-spotify-green focus:ring-0"
                  disabled={!newEmail}
                />
                <span className="font-semibold">Send Welcome Invite Email</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 text-sm mt-3">
              <button
                type="button"
                onClick={() => setShowAddUser(false)}
                className="px-4 py-2 text-spotify-gray font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-spotify-green text-black rounded-full font-bold"
              >
                Save Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- Password Reset Modal ---------------- */}
      {resetUserId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleResetPassword}
            className="bg-[#242424] p-6 rounded-2xl max-w-sm w-full flex flex-col gap-4 shadow-2xl border border-white/10"
          >
            <h3 className="text-white text-lg font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-spotify-green" />
              <span>Reset User Password</span>
            </h3>
            <input
              type="password"
              placeholder="Enter new password"
              value={resetPasswordVal}
              onChange={(e) => setResetPasswordVal(e.target.value)}
              className="w-full bg-[#333333] text-white px-3.5 py-2 rounded-lg outline-none focus:ring-2 focus:ring-spotify-green text-sm"
              required
              autoFocus
            />

            <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
              <input
                type="checkbox"
                checked={resetSendEmail}
                onChange={(e) => setResetSendEmail(e.target.checked)}
                className="rounded text-spotify-green focus:ring-0"
              />
              <span>Send notification email with new password</span>
            </label>

            <div className="flex justify-end gap-2 text-sm mt-2">
              <button
                type="button"
                onClick={() => setResetUserId(null)}
                className="px-4 py-2 text-spotify-gray font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-spotify-green text-black rounded-full font-bold"
              >
                Save Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
