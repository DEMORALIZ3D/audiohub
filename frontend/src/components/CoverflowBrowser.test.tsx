import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CoverflowBrowser, type CoverflowItem } from './CoverflowBrowser';

const mockItems: CoverflowItem[] = [
  {
    id: '1',
    title: 'Dark Side of the Moon',
    subtitle: 'Pink Floyd',
    badge: 'Vinyl',
    coverUrl: 'https://example.com/cover1.jpg',
  },
  {
    id: '2',
    title: 'Abbey Road',
    subtitle: 'The Beatles',
    badge: 'LP',
    coverUrl: 'https://example.com/cover2.jpg',
  },
  {
    id: '3',
    title: 'Kind of Blue',
    subtitle: 'Miles Davis',
    badge: 'Wax',
    coverUrl: 'https://example.com/cover3.jpg',
  },
];

describe('CoverflowBrowser Component', () => {
  it('renders empty message when no items provided', () => {
    render(<CoverflowBrowser items={[]} />);
    expect(screen.getByText(/no albums or tracks in this crate/i)).toBeInTheDocument();
  });

  it('renders active item title and subtitle', () => {
    render(<CoverflowBrowser items={mockItems} initialIndex={0} />);
    expect(screen.getByRole('heading', { name: 'Dark Side of the Moon' })).toBeInTheDocument();
    expect(screen.getByText('Pink Floyd')).toBeInTheDocument();
  });

  it('navigates next on right arrow button click', () => {
    render(<CoverflowBrowser items={mockItems} initialIndex={0} />);
    const nextBtn = screen.getByRole('button', { name: /next album/i });
    fireEvent.click(nextBtn);
    expect(screen.getByRole('heading', { name: 'Abbey Road' })).toBeInTheDocument();
    expect(screen.getByText('The Beatles')).toBeInTheDocument();
  });

  it('navigates previous on left arrow button click', () => {
    render(<CoverflowBrowser items={mockItems} initialIndex={1} />);
    const prevBtn = screen.getByRole('button', { name: /previous album/i });
    fireEvent.click(prevBtn);
    expect(screen.getByRole('heading', { name: 'Dark Side of the Moon' })).toBeInTheDocument();
  });

  it('fires onItemPlay when Play Now button is clicked', () => {
    const handlePlay = vi.fn();
    render(<CoverflowBrowser items={mockItems} initialIndex={1} onItemPlay={handlePlay} />);
    const playBtn = screen.getByRole('button', { name: /play now/i });
    fireEvent.click(playBtn);
    expect(handlePlay).toHaveBeenCalledTimes(1);
    expect(handlePlay).toHaveBeenCalledWith(mockItems[1], 1);
  });

  it('navigates on keyboard arrow presses', () => {
    render(<CoverflowBrowser items={mockItems} initialIndex={0} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Abbey Road' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { name: 'Dark Side of the Moon' })).toBeInTheDocument();
  });
});
