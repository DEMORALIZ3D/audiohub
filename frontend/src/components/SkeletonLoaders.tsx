import type React from 'react';

/**
 * High-performance, layout-exact skeleton loaders for Azify.
 * Uses a smooth ambient shimmer gradient to eliminate Cumulative Layout Shift (CLS).
 */

export const SkeletonBox: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className = '', style }) => (
  <div
    className={`animate-shimmer bg-white/[0.06] rounded select-none pointer-events-none ${className}`}
    style={style}
  />
);

/** Single track row skeleton matching TrackRow layout */
export const TrackRowSkeleton: React.FC<{ index?: number }> = ({ index }) => (
  <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2.5 sm:py-2 rounded-md">
    {/* Index placeholder */}
    <div className="w-5 sm:w-6 flex items-center justify-center flex-shrink-0">
      <SkeletonBox className="w-4 h-3.5 rounded" />
    </div>

    {/* Artwork & Title & Artist */}
    <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
      <SkeletonBox className="w-10 h-10 rounded flex-shrink-0 shadow" />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <SkeletonBox className="h-3.5 w-3/5 max-w-[220px] rounded" />
        <SkeletonBox className="h-2.5 w-2/5 max-w-[140px] rounded" />
      </div>
    </div>

    {/* Album Column (Desktop only) */}
    <div className="w-1/4 hidden md:block">
      <SkeletonBox className="h-3 w-4/5 max-w-[160px] rounded" />
    </div>

    {/* Action buttons placeholder */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <SkeletonBox className="w-4 h-4 rounded-full opacity-60" />
      <SkeletonBox className="w-4 h-4 rounded-full opacity-60" />
    </div>

    {/* Duration */}
    <div className="w-10 sm:w-12 flex justify-end flex-shrink-0">
      <SkeletonBox className="w-8 h-3 rounded" />
    </div>
  </div>
);

/** List of multiple track row skeletons */
export const TrackListSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="flex flex-col gap-1 pb-12">
    {Array.from({ length: count }).map((_, i) => (
      <TrackRowSkeleton key={i} index={i} />
    ))}
  </div>
);

/** Detail Header Skeleton (matching Album, Playlist, Liked Songs, Artist) */
export const DetailHeaderSkeleton: React.FC<{
  isCircleAvatar?: boolean;
  themeGradient?: string;
}> = ({ isCircleAvatar = false, themeGradient = 'from-[#2a2a2a]' }) => (
  <div
    className={`p-4 md:p-8 pb-4 md:pb-6 flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6 text-center sm:text-left bg-gradient-to-b ${themeGradient} via-[#121212] to-[#121212]`}
  >
    {/* Artwork Skeleton */}
    <SkeletonBox
      className={`w-36 h-36 sm:w-48 sm:h-48 md:w-52 md:h-52 flex-shrink-0 shadow-2xl border border-white/5 ${
        isCircleAvatar ? 'rounded-full' : 'rounded-2xl'
      }`}
    />

    {/* Metadata Skeleton */}
    <div className="flex flex-col items-center sm:items-start gap-2.5 flex-1 min-w-0 w-full sm:w-auto">
      {/* Category / Type pill */}
      <SkeletonBox className="h-3 w-20 rounded-full" />
      {/* Big Title */}
      <SkeletonBox className="h-8 sm:h-12 md:h-14 w-4/5 max-w-md rounded-xl" />
      {/* Subtitle / Curator / Stats */}
      <div className="flex items-center gap-2 mt-1">
        <SkeletonBox className="h-3.5 w-28 rounded" />
        <SkeletonBox className="h-3.5 w-16 rounded" />
        <SkeletonBox className="h-3.5 w-20 rounded" />
      </div>
    </div>
  </div>
);

/** Album View Skeleton */
export const AlbumViewSkeleton: React.FC = () => (
  <div className="flex-1 overflow-y-auto bg-[#121212] text-white flex flex-col pb-44 animate-fadeIn">
    <DetailHeaderSkeleton themeGradient="from-[#2e3440]/60" />

    {/* Action Buttons Row */}
    <div className="px-4 md:px-8 py-3 md:py-4 flex items-center gap-3">
      <SkeletonBox className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
      <SkeletonBox className="w-10 h-10 rounded-full" />
      <SkeletonBox className="w-10 h-10 rounded-full" />
    </div>

    {/* Table Header */}
    <div className="px-2 md:px-8 flex-1">
      <div className="grid grid-cols-[24px_1fr_1fr_48px] md:grid-cols-[24px_1fr_1fr_1fr_48px] px-4 py-2 border-b border-white/10 mb-2">
        <SkeletonBox className="w-3 h-3 rounded" />
        <SkeletonBox className="w-16 h-3 rounded" />
        <SkeletonBox className="w-16 h-3 rounded hidden md:block" />
        <div />
        <SkeletonBox className="w-6 h-3 rounded ml-auto" />
      </div>

      <TrackListSkeleton count={8} />
    </div>
  </div>
);

/** Playlist View Skeleton */
export const PlaylistViewSkeleton: React.FC = () => (
  <div className="flex-1 overflow-y-auto bg-[#121212] text-white flex flex-col pb-44 animate-fadeIn">
    <DetailHeaderSkeleton themeGradient="from-[#2a2a2a]" />

    {/* Action Buttons Row */}
    <div className="px-4 md:px-8 py-3 md:py-4 flex items-center gap-3">
      <SkeletonBox className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
      <SkeletonBox className="w-24 h-9 rounded-full" />
      <SkeletonBox className="w-10 h-10 rounded-full" />
    </div>

    {/* Table Header */}
    <div className="px-2 md:px-8 flex-1">
      <div className="grid grid-cols-[24px_1fr_1fr_48px] md:grid-cols-[24px_1fr_1fr_1fr_48px] px-4 py-2 border-b border-white/10 mb-2">
        <SkeletonBox className="w-3 h-3 rounded" />
        <SkeletonBox className="w-16 h-3 rounded" />
        <SkeletonBox className="w-16 h-3 rounded hidden md:block" />
        <div />
        <SkeletonBox className="w-6 h-3 rounded ml-auto" />
      </div>

      <TrackListSkeleton count={10} />
    </div>
  </div>
);

/** Liked Songs Skeleton */
export const LikedSongsSkeleton: React.FC = () => (
  <div className="flex-1 overflow-y-auto bg-[#121212] text-white flex flex-col pb-44 animate-fadeIn">
    <div className="p-4 md:p-8 pb-4 md:pb-6 flex flex-col sm:flex-row items-center sm:items-end gap-4 md:gap-6 text-center sm:text-left bg-gradient-to-b from-[#491f8f]/40 via-[#121212] to-[#121212]">
      <SkeletonBox className="w-36 h-36 sm:w-48 sm:h-48 md:w-52 md:h-52 rounded-xl flex-shrink-0 shadow-2xl bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-pink-900/40" />
      <div className="flex flex-col items-center sm:items-start gap-2.5 flex-1 min-w-0">
        <SkeletonBox className="h-3 w-16 rounded-full" />
        <SkeletonBox className="h-9 sm:h-14 w-60 sm:w-80 rounded-xl" />
        <div className="flex items-center gap-2 mt-1">
          <SkeletonBox className="h-3.5 w-32 rounded" />
          <SkeletonBox className="h-3.5 w-20 rounded" />
        </div>
      </div>
    </div>

    <div className="px-4 md:px-8 py-3 md:py-4 flex flex-wrap items-center gap-3">
      <SkeletonBox className="w-12 h-12 md:w-14 md:h-14 rounded-full" />
      <SkeletonBox className="w-48 h-9 rounded-full" />
      <SkeletonBox className="w-36 h-9 rounded-full" />
    </div>

    <div className="px-2 md:px-8 flex-1">
      <div className="grid grid-cols-[24px_1fr_1fr_48px] md:grid-cols-[24px_1fr_1fr_1fr_48px] px-4 py-2 border-b border-white/10 mb-2">
        <SkeletonBox className="w-3 h-3 rounded" />
        <SkeletonBox className="w-16 h-3 rounded" />
        <SkeletonBox className="w-16 h-3 rounded hidden md:block" />
        <div />
        <SkeletonBox className="w-6 h-3 rounded ml-auto" />
      </div>

      <TrackListSkeleton count={8} />
    </div>
  </div>
);

/** Artist Profile Skeleton */
export const ArtistViewSkeleton: React.FC = () => (
  <div className="flex-1 overflow-y-auto bg-[#121212] text-white flex flex-col pb-44 animate-fadeIn">
    {/* Artist Hero Header */}
    <div className="p-6 md:p-10 pb-6 flex flex-col sm:flex-row items-center sm:items-end gap-6 border-b border-white/5 bg-gradient-to-b from-[#2a3a4a]/40 to-[#121212]">
      <SkeletonBox className="w-40 h-40 sm:w-52 sm:h-52 rounded-full flex-shrink-0 shadow-2xl" />
      <div className="flex flex-col items-center sm:items-start gap-3 text-center sm:text-left">
        <SkeletonBox className="h-3 w-28 rounded-full" />
        <SkeletonBox className="h-10 sm:h-16 w-64 sm:w-96 rounded-xl" />
        <SkeletonBox className="h-4 w-36 rounded" />
      </div>
    </div>

    {/* Action Row */}
    <div className="px-6 md:px-10 py-4 flex items-center gap-4">
      <SkeletonBox className="w-14 h-14 rounded-full" />
      <SkeletonBox className="w-28 h-10 rounded-full" />
    </div>

    {/* Popular Tracks Section */}
    <div className="px-6 md:px-10 mt-4">
      <SkeletonBox className="h-6 w-32 rounded mb-4" />
      <TrackListSkeleton count={5} />
    </div>

    {/* Discography Grid Section */}
    <div className="px-6 md:px-10 mt-6">
      <SkeletonBox className="h-6 w-44 rounded mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-[#181818] p-3.5 rounded-xl flex flex-col gap-2.5">
            <SkeletonBox className="aspect-square w-full rounded-lg" />
            <SkeletonBox className="h-4 w-4/5 rounded" />
            <SkeletonBox className="h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** Home Page Skeleton */
export const HomeSkeleton: React.FC = () => (
  <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#1e3264]/40 via-[#121212] to-[#121212] p-4 md:p-8 text-white pb-44 animate-fadeIn">
    {/* Mobile Top Brand Bar Placeholder */}
    <div className="md:hidden flex items-center gap-2.5 mb-4 pt-[max(env(safe-area-inset-top,0px),4.25rem)] min-w-0">
      <SkeletonBox className="w-8 h-8 rounded-lg flex-shrink-0" />
      <SkeletonBox className="h-6 w-24 rounded-md" />
    </div>

    {/* Greeting Header */}
    <SkeletonBox className="h-9 w-56 sm:w-64 rounded-lg mb-6" />

    {/* Quick Access Grid (Spotify 6-card row) */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center bg-white/5 rounded-md overflow-hidden shadow-md pr-4"
        >
          <SkeletonBox className="w-16 h-16 rounded-none flex-shrink-0" />
          <div className="flex-1 px-3 flex flex-col gap-1.5">
            <SkeletonBox className="h-3.5 w-3/4 rounded" />
            <SkeletonBox className="h-2.5 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>

    {/* Official Curated Charts Section */}
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <SkeletonBox className="w-5 h-5 rounded-full" />
        <SkeletonBox className="h-7 w-60 rounded-md" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#1e1e1e]/60 p-4 rounded-2xl flex flex-col justify-between border border-white/5"
          >
            <SkeletonBox className="aspect-square w-full rounded-xl mb-3" />
            <div className="flex flex-col gap-2">
              <SkeletonBox className="h-4 w-3/4 rounded" />
              <SkeletonBox className="h-3 w-full rounded" />
              <div className="mt-1 flex items-center justify-between">
                <SkeletonBox className="h-2.5 w-16 rounded" />
                <SkeletonBox className="h-2.5 w-14 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Popular Genres & Moods */}
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SkeletonBox className="w-5 h-5 rounded-full" />
          <SkeletonBox className="h-7 w-52 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#1e1e1e]/60 p-4 rounded-2xl border border-white/5">
            <SkeletonBox className="aspect-[4/3] w-full rounded-xl mb-3" />
            <SkeletonBox className="h-4 w-2/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** Search Page Skeleton */
export const SearchSkeleton: React.FC = () => (
  <div className="flex flex-col gap-8 animate-fadeIn">
    {/* Playlists & Charts Row */}
    <div>
      <SkeletonBox className="h-6 w-44 rounded-md mb-3" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#181818] p-3.5 rounded-xl flex flex-col border border-white/5"
          >
            <SkeletonBox className="aspect-square w-full rounded-lg mb-3" />
            <SkeletonBox className="h-4 w-3/4 rounded mb-1" />
            <SkeletonBox className="h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>

    {/* Songs Tracklist Skeleton */}
    <div>
      <SkeletonBox className="h-6 w-32 rounded-md mb-3" />
      <TrackListSkeleton count={6} />
    </div>
  </div>
);

/** Sidebar / Mobile Library Playlist Items Skeleton */
export const PlaylistItemSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="flex flex-col gap-1.5 py-1">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md">
        <SkeletonBox className="w-10 h-10 rounded flex-shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <SkeletonBox className="h-3 w-3/4 rounded" />
          <SkeletonBox className="h-2.5 w-1/2 rounded" />
        </div>
      </div>
    ))}
  </div>
);
