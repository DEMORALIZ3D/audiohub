import {
  AlertCircle,
  ArrowDownToLine,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  FolderEdit,
  Heart,
  HelpCircle,
  Info,
  Link2,
  Pencil,
  Play,
  Radio,
  RefreshCw,
  RotateCw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

export const HelpGuidesView: React.FC<{
  onOpenImporter?: () => void;
  onNavigateTab?: (tab: string) => void;
}> = ({ onOpenImporter, onNavigateTab }) => {
  const [activeCategory, setActiveCategory] = useState<'import' | 'playlists' | 'liked' | 'pwa'>(
    'import',
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#222] via-[#121212] to-[#121212] text-white p-4 sm:p-8 pb-48">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-spotify-green/20 text-spotify-green flex items-center justify-center shadow-lg">
            <BookOpen className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Help & User Guides
            </h1>
            <p className="text-xs sm:text-sm text-spotify-gray">
              Step-by-step walkthroughs, troubleshooting tips, and how-to guides.
            </p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
          <button
            onClick={() => setActiveCategory('import')}
            className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
              activeCategory === 'import'
                ? 'bg-spotify-green text-black border-spotify-green shadow-lg scale-[1.02]'
                : 'bg-[#181818] border-white/5 text-spotify-gray hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Importing Music</span>
          </button>

          <button
            onClick={() => setActiveCategory('playlists')}
            className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
              activeCategory === 'playlists'
                ? 'bg-spotify-green text-black border-spotify-green shadow-lg scale-[1.02]'
                : 'bg-[#181818] border-white/5 text-spotify-gray hover:text-white hover:bg-white/5'
            }`}
          >
            <FolderEdit className="w-4 h-4" />
            <span>Managing Playlists</span>
          </button>

          <button
            onClick={() => setActiveCategory('liked')}
            className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
              activeCategory === 'liked'
                ? 'bg-spotify-green text-black border-spotify-green shadow-lg scale-[1.02]'
                : 'bg-[#181818] border-white/5 text-spotify-gray hover:text-white hover:bg-white/5'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Liked Songs & Offline</span>
          </button>

          <button
            onClick={() => setActiveCategory('pwa')}
            className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border ${
              activeCategory === 'pwa'
                ? 'bg-spotify-green text-black border-spotify-green shadow-lg scale-[1.02]'
                : 'bg-[#181818] border-white/5 text-spotify-gray hover:text-white hover:bg-white/5'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>PWA & App Updates</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* ─────────────────────────────────────────────────────────────
            GUIDE 1: IMPORTING MUSIC
           ───────────────────────────────────────────────────────────── */}
        {activeCategory === 'import' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#181818] border border-white/5 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-spotify-green" />
                    <span>How to Import Playlists & Liked Songs</span>
                  </h2>
                  <p className="text-xs text-spotify-gray mt-0.5">
                    Transfer playlists from Spotify, Apple Music, or CSV files directly into
                    AudioHub.
                  </p>
                </div>
                {onOpenImporter && (
                  <button
                    onClick={onOpenImporter}
                    className="px-4 py-2 rounded-xl bg-spotify-green hover:bg-[#1ed760] text-black text-xs font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-lg"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    <span>Open Importer</span>
                  </button>
                )}
              </div>

              {/* Step 1 */}
              <div className="flex gap-4 items-start">
                <div className="w-7 h-7 rounded-full bg-spotify-green text-black font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="text-sm font-bold text-white">
                    Exporting Spotify Liked Songs or Playlists (Recommended: Exportify)
                  </h3>
                  <p className="text-xs text-spotify-gray leading-relaxed">
                    Spotify's unauthenticated preview links limit playlists to ~10-50 tracks. To
                    import your entire library (hundreds or thousands of songs) with zero missing
                    tracks:
                  </p>
                  <div className="bg-[#242424] border border-white/5 rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Using Exportify:</span>
                    </div>
                    <ol className="list-decimal ml-5 space-y-1.5 text-white/80">
                      <li>
                        Visit{' '}
                        <a
                          href="https://exportify.net"
                          target="_blank"
                          rel="noreferrer"
                          className="text-spotify-green underline inline-flex items-center gap-1"
                        >
                          exportify.net <ExternalLink className="w-3 h-3" />
                        </a>{' '}
                        and sign in with your Spotify account.
                      </li>
                      <li>
                        Look for <b>Liked Songs</b> or your desired playlist in the table.
                      </li>
                      <li>
                        Click the <b>Export</b> button next to that playlist to download a{' '}
                        <code>.csv</code> file.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4 items-start">
                <div className="w-7 h-7 rounded-full bg-spotify-green text-black font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="text-sm font-bold text-white">
                    Preview and Review Tracks in AudioHub
                  </h3>
                  <p className="text-xs text-spotify-gray leading-relaxed">
                    Open the <b>Music Importer</b> in AudioHub and choose{' '}
                    <b>CSV / Exportify File</b>. Drag and drop your downloaded file or paste track
                    text.
                  </p>
                  <div className="bg-[#202020] border border-white/5 rounded-xl p-3.5 space-y-2 text-xs">
                    <p className="text-white font-medium">What you can do in the Review stage:</p>
                    <ul className="list-disc ml-5 space-y-1 text-white/70">
                      <li>
                        <b>Select / Deselect Tracks:</b> Use the checkboxes to choose exactly which
                        songs to include.
                      </li>
                      <li>
                        <b>Search & Filter:</b> Type an artist or song name to find specific tracks.
                      </li>
                      <li>
                        <b>Custom Playlist Name:</b> Name your playlist right then and there.
                      </li>
                      <li>
                        <b>Choose Target:</b> Save to a brand new playlist, an existing playlist, or
                        your Liked Songs library.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Step 3: FAQ / Troubleshooting */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-spotify-gray flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-spotify-green" />
                  <span>Frequently Asked Questions & Troubleshooting</span>
                </h4>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200/90 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Why do imported tracks look "greyed out" or show a 🎵 placeholder?</span>
                  </div>
                  <p className="text-white/80 leading-relaxed">
                    When you import niche indie artists, underground remixes, or local releases,
                    official metadata databases (like Deezer/iTunes) may not have album covers on
                    file yet.
                    <b> They are not broken!</b> AudioHub streams audio on-demand directly from
                    YouTube the moment you tap play, and automatically resolves high-res artwork
                    dynamically.
                  </p>
                </div>

                <div className="bg-[#202020] border border-white/5 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>Why did my playlist import stop at 9 or 10 songs?</span>
                  </div>
                  <p className="text-white/70 leading-relaxed">
                    If you imported a public Spotify URL, Spotify restricts unauthenticated visitors
                    to a small preview widget. To import all 50, 100, or 1,000+ tracks, export the
                    playlist using <b>Exportify CSV</b> and import the CSV file into AudioHub!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            GUIDE 2: MANAGING PLAYLISTS
           ───────────────────────────────────────────────────────────── */}
        {activeCategory === 'playlists' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#181818] border border-white/5 rounded-2xl p-6 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderEdit className="w-5 h-5 text-spotify-green" />
                  <span>Renaming, Organizing & Deleting Playlists</span>
                </h2>
                <p className="text-xs text-spotify-gray mt-0.5">
                  Keep your music organized and customize your playlist titles anytime.
                </p>
              </div>

              {/* Feature 1: Renaming */}
              <div className="bg-[#202020] border border-white/5 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Pencil className="w-4 h-4 text-spotify-green" />
                  <span>How to Rename a Playlist</span>
                </div>
                <ol className="list-decimal ml-5 space-y-1.5 text-xs text-white/80">
                  <li>Navigate to any playlist you created in your library.</li>
                  <li>
                    Click the <b>Pencil icon</b> next to the title, or click the <b>Edit Details</b>{' '}
                    button in the action bar.
                  </li>
                  <li>Type your new playlist name and optional description in the dialog.</li>
                  <li>
                    Click <b>Save Changes</b> — the sidebar and header update immediately!
                  </li>
                </ol>
              </div>

              {/* Feature 2: Managing & Batch deleting */}
              <div className="bg-[#202020] border border-white/5 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <SlidersHorizontal className="w-4 h-4 text-spotify-green" />
                  <span>Batch Select, Reorder & Export</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  Inside any playlist, click the <b>Manage & Export</b> button to open the batch
                  manager. Here you can:
                </p>
                <ul className="list-disc ml-5 space-y-1 text-xs text-white/70">
                  <li>Select multiple songs at once and remove them in one click.</li>
                  <li>
                    Export your playlist as an <b>Exportify-compatible CSV file</b> for backup or
                    sharing.
                  </li>
                  <li>Search through large playlists to find duplicates.</li>
                </ul>
              </div>

              {/* Feature 3: Deleting a Playlist */}
              <div className="bg-[#202020] border border-white/5 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>Deleting a Playlist</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  To permanently delete a playlist, click the red <b>Delete</b> button located next
                  to "Manage & Export" in the playlist action row. Confirm the prompt to remove the
                  playlist from your library.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            GUIDE 3: LIKED SONGS & OFFLINE
           ───────────────────────────────────────────────────────────── */}
        {activeCategory === 'liked' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#181818] border border-white/5 rounded-2xl p-6 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-spotify-green" />
                  <span>Liked Songs & Offline Listening</span>
                </h2>
                <p className="text-xs text-spotify-gray mt-0.5">
                  Save your favorites and listen anywhere without internet access.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#202020] border border-white/5 rounded-xl p-5 space-y-2">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Heart className="w-4 h-4 text-spotify-green fill-spotify-green" />
                    <span>Liking & Saving Songs</span>
                  </h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Tap the heart icon on any track row, player bar, or full-screen view. The heart
                    illuminates green and immediately adds the song to your <b>Liked Songs</b>{' '}
                    collection.
                  </p>
                </div>

                <div className="bg-[#202020] border border-white/5 rounded-xl p-5 space-y-2">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                    <span>Offline Playback (IndexedDB)</span>
                  </h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Click the download icon on any song. AudioHub stores the full decrypted audio
                    file directly into your browser's offline storage. Songs marked with a green
                    checkmark play with 0ms buffering even when offline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            GUIDE 4: PWA INSTALLATION & UPDATING
           ───────────────────────────────────────────────────────────── */}
        {activeCategory === 'pwa' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#181818] border border-white/5 rounded-2xl p-6 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-spotify-green" />
                  <span>Installing as a Mobile App & Forcing Updates</span>
                </h2>
                <p className="text-xs text-spotify-gray mt-0.5">
                  Get the full-screen native mobile experience on iOS and Android.
                </p>
              </div>

              {/* iOS & Android Install */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#202020] border border-white/5 rounded-xl p-5 space-y-2">
                  <h3 className="font-bold text-white text-sm">Apple iPhone / iPad (Safari)</h3>
                  <ol className="list-decimal ml-5 space-y-1.5 text-xs text-white/80">
                    <li>
                      Open{' '}
                      <b>{typeof window !== 'undefined' ? window.location.host : 'AudioHub'}</b> in
                      Safari.
                    </li>
                    <li>
                      Tap the <b>Share</b> button (square with arrow) at the bottom.
                    </li>
                    <li>
                      Scroll down and tap <b>Add to Home Screen</b>.
                    </li>
                    <li>
                      Launch from your home screen for full-screen music without browser bars!
                    </li>
                  </ol>
                </div>

                <div className="bg-[#202020] border border-white/5 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm">Android (PWA or Direct APK)</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      2 Ways to Install
                    </span>
                  </div>
                  <ol className="list-decimal ml-5 space-y-1.5 text-xs text-white/80">
                    <li>
                      <b>PWA (Fastest):</b> Open{' '}
                      <b>{typeof window !== 'undefined' ? window.location.host : 'AudioHub'}</b> in
                      Chrome → Tap <b>Install App</b>.
                    </li>
                    <li>
                      <b>Direct APK (Sideload):</b> Download the standalone{' '}
                      <a
                        href="/api/v1/download/apk"
                        download="audiohub.apk"
                        className="text-spotify-green underline font-bold"
                      >
                        audiohub.apk
                      </a>{' '}
                      for Android phones, tablets, and Android TV / Google TV without Google Play.
                    </li>
                  </ol>
                </div>
              </div>

              {/* How to Force PWA Updates Without DevTools */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <RefreshCw className="w-4 h-4 flex-shrink-0" />
                  <span>How to Force PWA Updates (When New Features Drop)</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  PWAs cache code aggressively so they load instantly. When we push backend or
                  frontend updates, you do not need developer tools or complex clearing to get the
                  latest version:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#181818]/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <span className="font-bold text-white">Method 1: Settings Update Button</span>
                    <p className="text-white/70">
                      Go to <b>Settings &rarr; Storage & Offline</b> and tap{' '}
                      <b>"Check for Updates"</b> or <b>"Force Refresh Cache"</b>. This purges stale
                      service workers and reloads the fresh build automatically.
                    </p>
                  </div>
                  <div className="bg-[#181818]/60 p-3 rounded-xl border border-white/5 space-y-1">
                    <span className="font-bold text-white">Method 2: Pull to Refresh</span>
                    <p className="text-white/70">
                      On Android or iOS, pull down firmly from the top of the Home or Library tab.
                      When an update is detected, an "Update Available — Tap to Reload" banner
                      appears at the top.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
