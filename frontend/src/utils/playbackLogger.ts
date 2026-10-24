export interface PlaybackLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  category: 'playback' | 'network' | 'cache' | 'stream';
  message: string;
  details?: any;
}

const MAX_LOGS = 100;
const logs: PlaybackLogEntry[] = [];
const listeners: Set<() => void> = new Set();

export const playbackLogger = {
  log: (
    level: 'info' | 'warn' | 'error' | 'success',
    category: 'playback' | 'network' | 'cache' | 'stream',
    message: string,
    details?: any,
  ) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const entry: PlaybackLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timeStr,
      level,
      category,
      message,
      details,
    };

    logs.unshift(entry);
    if (logs.length > MAX_LOGS) {
      logs.pop();
    }

    if (level === 'error') {
      console.error(`[AudioHub ${category.toUpperCase()}] ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[AudioHub ${category.toUpperCase()}] ${message}`, details || '');
    } else {
      console.log(`[AudioHub ${category.toUpperCase()}] ${message}`, details || '');
    }

    listeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  },

  getLogs: () => [...logs],

  clear: () => {
    logs.length = 0;
    listeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  },

  subscribe: (callback: () => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
};
