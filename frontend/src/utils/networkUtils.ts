export interface NetworkInfo {
  isWifiOrFast: boolean;
  isCellular: boolean;
  saveData: boolean;
  effectiveType: string;
}

export function getNetworkInfo(): NetworkInfo {
  if (typeof navigator === 'undefined') {
    return { isWifiOrFast: true, isCellular: false, saveData: false, effectiveType: '4g' };
  }
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!conn) {
    return { isWifiOrFast: true, isCellular: false, saveData: false, effectiveType: '4g' };
  }

  const type = conn.type || '';
  const isCellular = type === 'cellular';
  const isWifi = type === 'wifi' || type === 'ethernet';
  const saveData = Boolean(conn.saveData);
  const effectiveType = conn.effectiveType || '4g';
  const isFast = effectiveType === '4g' || effectiveType === '5g';

  return {
    isWifiOrFast: (isWifi || isFast) && !saveData,
    isCellular,
    saveData,
    effectiveType,
  };
}
