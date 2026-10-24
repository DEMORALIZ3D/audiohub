import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlbumContextMenu } from './AlbumContextMenu';
import { PlaylistContextMenu } from './PlaylistContextMenu';

const mockPlayTrack = vi.fn();
const mockPlayNext = vi.fn();
const mockAddToQueue = vi.fn();

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => ({
    playTrack: mockPlayTrack,
    playNext: mockPlayNext,
    addToQueue: mockAddToQueue,
  }),
}));

describe('PlaylistContextMenu Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPlaylist = {
    id: 'pl-1',
    name: 'Chill Vibes',
    track_count: 24,
    cover_url: 'https://example.com/playlist.jpg',
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <PlaylistContextMenu playlist={mockPlaylist} isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders playlist title and action options when open', () => {
    render(<PlaylistContextMenu playlist={mockPlaylist} isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Chill Vibes')).toBeInTheDocument();
    expect(screen.getByText(/24 songs/i)).toBeInTheDocument();
    expect(screen.getByText('Play Playlist')).toBeInTheDocument();
    expect(screen.getByText('Play Next')).toBeInTheDocument();
    expect(screen.getByText('Add to Queue')).toBeInTheDocument();
    expect(screen.getByText('Share Playlist')).toBeInTheDocument();
  });

  it('calls onNavigate when Open Playlist is clicked', () => {
    const handleNavigate = vi.fn();
    const handleClose = vi.fn();
    render(
      <PlaylistContextMenu
        playlist={mockPlaylist}
        isOpen={true}
        onClose={handleClose}
        onNavigate={handleNavigate}
      />,
    );
    const openBtn = screen.getByText('Open Playlist Page');
    fireEvent.click(openBtn);
    expect(handleNavigate).toHaveBeenCalled();
  });

  it('calls onClose on Escape key press', () => {
    const handleClose = vi.fn();
    render(<PlaylistContextMenu playlist={mockPlaylist} isOpen={true} onClose={handleClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });
});

describe('AlbumContextMenu Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAlbum = {
    id: 'alb-1',
    title: 'Random Access Memories',
    artist: 'Daft Punk',
    tracks_count: 13,
    year: '2013',
    cover_url: 'https://example.com/ram.jpg',
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AlbumContextMenu album={mockAlbum} isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders album title, artist and actions when open', () => {
    render(<AlbumContextMenu album={mockAlbum} isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Random Access Memories')).toBeInTheDocument();
    expect(screen.getByText(/Daft Punk/i)).toBeInTheDocument();
    expect(screen.getByText('Play Album')).toBeInTheDocument();
    expect(screen.getByText('Play Next')).toBeInTheDocument();
    expect(screen.getByText('Add to Queue')).toBeInTheDocument();
    expect(screen.getByText('Share Album')).toBeInTheDocument();
  });

  it('calls onNavigateAlbum when Open Album is clicked', () => {
    const handleNavigateAlbum = vi.fn();
    render(
      <AlbumContextMenu
        album={mockAlbum}
        isOpen={true}
        onClose={vi.fn()}
        onNavigateAlbum={handleNavigateAlbum}
      />,
    );
    const openBtn = screen.getByText('Open Album Page');
    fireEvent.click(openBtn);
    expect(handleNavigateAlbum).toHaveBeenCalled();
  });
});
