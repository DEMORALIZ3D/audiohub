import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  AlbumViewSkeleton,
  ArtistViewSkeleton,
  DetailHeaderSkeleton,
  HomeSkeleton,
  LikedSongsSkeleton,
  PlaylistItemSkeleton,
  PlaylistViewSkeleton,
  SearchSkeleton,
  SkeletonBox,
  TrackListSkeleton,
  TrackRowSkeleton,
} from './SkeletonLoaders';

describe('SkeletonLoaders', () => {
  it('renders SkeletonBox with shimmer animation class', () => {
    const { container } = render(<SkeletonBox className="w-20 h-4" />);
    const box = container.querySelector('.animate-shimmer');
    expect(box).toBeTruthy();
    expect(box?.classList.contains('w-20')).toBe(true);
  });

  it('renders TrackRowSkeleton structure', () => {
    const { container } = render(<TrackRowSkeleton index={0} />);
    const shimmers = container.querySelectorAll('.animate-shimmer');
    expect(shimmers.length).toBeGreaterThanOrEqual(4);
  });

  it('renders TrackListSkeleton with specified count', () => {
    const { container } = render(<TrackListSkeleton count={5} />);
    const trackRows = container.firstChild?.childNodes;
    expect(trackRows?.length).toBe(5);
  });

  it('renders DetailHeaderSkeleton in album mode', () => {
    const { container } = render(<DetailHeaderSkeleton isCircleAvatar={false} />);
    const avatar = container.querySelector('.rounded-2xl');
    expect(avatar).toBeTruthy();
  });

  it('renders DetailHeaderSkeleton in artist circular mode', () => {
    const { container } = render(<DetailHeaderSkeleton isCircleAvatar={true} />);
    const avatar = container.querySelector('.rounded-full');
    expect(avatar).toBeTruthy();
  });

  it('renders full AlbumViewSkeleton', () => {
    const { container } = render(<AlbumViewSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(10);
  });

  it('renders full PlaylistViewSkeleton', () => {
    const { container } = render(<PlaylistViewSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(10);
  });

  it('renders full LikedSongsSkeleton', () => {
    const { container } = render(<LikedSongsSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(10);
  });

  it('renders full ArtistViewSkeleton', () => {
    const { container } = render(<ArtistViewSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(10);
  });

  it('renders full HomeSkeleton', () => {
    const { container } = render(<HomeSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(15);
  });

  it('renders full SearchSkeleton', () => {
    const { container } = render(<SearchSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(10);
  });

  it('renders PlaylistItemSkeleton', () => {
    const { container } = render(<PlaylistItemSkeleton count={4} />);
    const items = container.firstChild?.childNodes;
    expect(items?.length).toBe(4);
  });
});
