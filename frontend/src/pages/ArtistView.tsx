import {
  Check,
  CheckCircle2,
  Clock,
  Disc,
  Play,
  Share2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AlbumContextMenu } from '../components/AlbumContextMenu';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ArtistViewSkeleton } from '../components/SkeletonLoaders';
import { TrackRow } from '../components/TrackRow';
import { usePlayer } from '../context/PlayerContext';
import { type ArtistDetail, Track } from '../types';
import { getArtistShareData, shareContent } from '../utils/shareUtils';

interface ArtistViewProps {
  artistId: string;
  onSelectAlbum: (albumId: string) => void;
  onSelectArtist: (artistId: string) => void;
}

export const ArtistView: React.FC<ArtistViewProps> = ({
  artistId,
  onSelectAlbum,
  onSelectArtist,
}) => {
  const { playTrack } = usePlayer();
  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeAlbumMenu, setActiveAlbumMenu] = useState<{
    album: any;
    pos: { x: number; y: number };
  } | null>(null);

  const handleToggleFollow = async () => {
    if (!artist || followLoading) return;
    const nextFollowed = !artist.is_followed;
    setArtist((prev) => (prev ? { ...prev, is_followed: nextFollowed } : null));
    setFollowLoading(true);

    try {
      const res = await fetch(`/api/v1/artists/${artist.id}/follow`, {
        method: nextFollowed ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: artist.name,
          picture_url: artist.picture_url,
          fan_count: artist.fan_count || 0,
        }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('library_changed'));
      } else {
        setArtist((prev) => (prev ? { ...prev, is_followed: !nextFollowed } : null));
      }
    } catch (e) {
      console.error('Failed to toggle follow artist', e);
      setArtist((prev) => (prev ? { ...prev, is_followed: !nextFollowed } : null));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    if (!artist) return;
    const res = await shareContent(getArtistShareData(artist.id, artist.name, artist.picture_url));
    if (res === 'copied' || res === 'shared') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/artists/${artistId}`)
      .then((res) => res.json())
      .then((data) => setArtist(data))
      .catch((e) => console.error('Failed to load artist', e))
      .finally(() => setLoading(false));
  }, [artistId]);

  if (loading) {
    return <ArtistViewSkeleton />;
  }

  if (!artist) {
    return <div className="flex-1 bg-[#121212] p-8 text-spotify-gray">Artist not found</div>;
  }

  const artistPlaybackContext = {
    type: 'artist' as const,
    id: artist.id,
    name: artist.name,
    cover_url: artist.picture_url,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#2a3a4a] via-[#121212] to-[#121212] text-white flex flex-col pb-44">
      {/* Navigation Breadcrumbs */}
      <div className="pt-2 px-1">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', tab: 'home' },
            { label: 'Your Library', tab: 'library' },
            { label: artist.name },
          ]}
          backLabel="Library"
          onBack={() => {
            window.dispatchEvent(
              new CustomEvent('audiohub:navigate', { detail: { tab: 'library', id: null } }),
            );
          }}
        />
      </div>

      {/* Artist Hero Header */}
      <div className="p-6 md:p-10 pt-2 md:pt-4 pb-6 flex flex-col sm:flex-row items-center sm:items-end gap-6 border-b border-white/5">
        <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-full overflow-hidden shadow-2xl bg-[#282828] flex-shrink-0 border-2 border-white/10">
          {artist.picture_url ? (
            <img src={artist.picture_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🎤</div>
          )}
        </div>

        <div className="flex flex-col gap-2 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold uppercase tracking-wider text-spotify-green">
            <CheckCircle2 className="w-4 h-4 fill-spotify-green text-black" />
            <span>Verified Artist</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight">
            {artist.name}
          </h1>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs md:text-sm text-spotify-gray mt-1">
            <Users className="w-4 h-4" />
            <span>{artist.fan_count?.toLocaleString() || '1,000,000+'} followers</span>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="px-6 md:px-10 py-4 flex items-center justify-center sm:justify-start gap-4">
        <button
          onClick={() => {
            if (artist.top_tracks.length > 0)
              playTrack(artist.top_tracks[0], artist.top_tracks, artistPlaybackContext);
          }}
          disabled={artist.top_tracks.length === 0}
          className="w-14 h-14 rounded-full bg-spotify-green text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl disabled:opacity-50"
          title="Play Popular"
        >
          <Play className="w-7 h-7 fill-current ml-1" />
        </button>

        <button
          onClick={handleToggleFollow}
          disabled={followLoading}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all border shadow-md hover:scale-105 active:scale-95 ${
            artist.is_followed
              ? 'bg-spotify-green text-black border-spotify-green hover:bg-spotify-green/90'
              : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
          }`}
          title={artist.is_followed ? 'Unfollow Artist' : 'Follow Artist'}
        >
          {artist.is_followed ? (
            <UserCheck className="w-4 h-4 text-black" />
          ) : (
            <UserPlus className="w-4 h-4 text-spotify-green" />
          )}
          <span>{artist.is_followed ? 'Following' : 'Follow'}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-md"
          title={shareCopied ? 'Link Copied!' : 'Share Artist (WhatsApp, Messenger, Copy Link)'}
        >
          {shareCopied ? (
            <Check className="w-4 h-4 text-spotify-green animate-pulse" />
          ) : (
            <Share2 className="w-4 h-4 text-spotify-green" />
          )}
          <span>{shareCopied ? 'Link Copied!' : 'Share Artist'}</span>
        </button>
      </div>

      {/* Popular Tracks Section */}
      <div className="px-4 md:px-10 mb-10">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Popular</h2>
        <div className="flex flex-col gap-1">
          {artist.top_tracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              playlistContext={artist.top_tracks}
              playbackContext={artistPlaybackContext}
            />
          ))}
        </div>
      </div>

      {/* Discography / Albums Section */}
      {artist.albums && artist.albums.length > 0 && (
        <div className="px-4 md:px-10 mb-10">
          <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center gap-2">
            <Disc className="w-6 h-6 text-spotify-green" />
            <span>Discography</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {artist.albums.map((alb) => (
              <div
                key={alb.id}
                onClick={() => onSelectAlbum(alb.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveAlbumMenu({
                    album: {
                      id: alb.id,
                      title: alb.title,
                      artist: artist.name,
                      cover_url: alb.cover_url,
                      tracks_count: alb.track_count,
                    },
                    pos: { x: e.clientX, y: e.clientY },
                  });
                }}
                className="group bg-[#181818] hover:bg-[#282828] p-3.5 rounded-xl transition-all cursor-pointer flex flex-col shadow-lg select-none"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-[#242424] shadow-md">
                  {alb.cover_url ? (
                    <img src={alb.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-spotify-gray">
                      <Disc className="w-10 h-10" />
                    </div>
                  )}
                  <button className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-spotify-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                </div>
                <h3 className="font-bold text-sm text-white truncate">{alb.title}</h3>
                <span className="text-xs text-spotify-gray mt-1">
                  {alb.release_date?.substring(0, 4) || 'Album'} • {alb.track_count || ''} songs
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Artists Section */}
      {artist.related_artists && artist.related_artists.length > 0 && (
        <div className="px-4 md:px-10">
          <h2 className="text-2xl font-bold tracking-tight mb-4">Fans Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artist.related_artists.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onSelectArtist(rel.id)}
                className="group bg-[#181818] hover:bg-[#282828] p-4 rounded-xl transition-all cursor-pointer flex flex-col items-center text-center shadow-lg"
              >
                <div className="w-28 h-28 rounded-full overflow-hidden mb-3 bg-[#242424] shadow-md">
                  {rel.picture_url ? (
                    <img src={rel.picture_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      🎤
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-sm text-white truncate w-full">{rel.name}</h3>
                <span className="text-xs text-spotify-gray mt-1">Artist</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Album Context Menu */}
      {activeAlbumMenu && (
        <AlbumContextMenu
          album={activeAlbumMenu.album}
          isOpen={true}
          onClose={() => setActiveAlbumMenu(null)}
          anchorPosition={activeAlbumMenu.pos}
          onNavigateAlbum={() => {
            onSelectAlbum(activeAlbumMenu.album.id);
            setActiveAlbumMenu(null);
          }}
          onNavigateArtist={(artistId) => {
            onSelectArtist(artistId);
            setActiveAlbumMenu(null);
          }}
        />
      )}
    </div>
  );
};
