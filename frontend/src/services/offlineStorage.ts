import type { Track } from '../types';

const DB_NAME = 'audiohub_offline';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('audio_blobs')) {
        db.createObjectStore('audio_blobs', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function downloadTrack(track: Track): Promise<boolean> {
  try {
    const res = await fetch(`/api/v1/stream/${track.id}`);
    if (!res.ok) throw new Error('Stream fetch failed');
    const blob = await res.blob();

    const db = await openDB();
    const tx = db.transaction(['tracks', 'audio_blobs'], 'readwrite');
    const tracksStore = tx.objectStore('tracks');
    const blobsStore = tx.objectStore('audio_blobs');

    tracksStore.put({ ...track, is_downloaded: true });
    blobsStore.put({
      id: track.id,
      blob,
      size: blob.size,
      downloaded_at: Date.now(),
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error(`Failed to download track ${track.id}:`, e);
    return false;
  }
}

export async function isDownloaded(trackId: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('audio_blobs', 'readonly');
      const req = tx.objectStore('audio_blobs').get(trackId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getDownloadedBlob(trackId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('audio_blobs', 'readonly');
      const req = tx.objectStore('audio_blobs').get(trackId);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function removeDownloadedTrack(trackId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(['tracks', 'audio_blobs'], 'readwrite');
    tx.objectStore('tracks').delete(trackId);
    tx.objectStore('audio_blobs').delete(trackId);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    console.error(e);
  }
}

export async function getDownloadedTracks(): Promise<Track[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('tracks', 'readonly');
      const req = tx.objectStore('tracks').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
