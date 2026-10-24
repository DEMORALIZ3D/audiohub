export function detectDeviceTypeFromUa(ua: string): 'mobile' | 'tablet' | 'desktop' | 'tv' {
  if (!ua) return 'desktop';
  const lower = ua.toLowerCase();
  if (/(smart-tv|tizen|webos|appletv|googletv|hbbtv|pov_tv|netcast|viera|roku)/i.test(lower)) {
    return 'tv';
  }
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(lower)) {
    return 'tablet';
  }
  if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
      lower,
    )
  ) {
    return 'mobile';
  }
  return 'desktop';
}

export function detectDeviceNameFromUa(ua: string): string {
  if (!ua) return 'Web Player';

  if (/tizen/i.test(ua) || /samsungbrowser.*tv/i.test(ua)) return 'Samsung TV';
  if (/webos/i.test(ua) || /lg browser/i.test(ua)) return 'LG Smart TV';
  if (/appletv/i.test(ua)) return 'Apple TV';
  if (/googletv|android.*tv/i.test(ua)) return 'Android TV';

  let browser = 'Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = 'Device';
  if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

export function isAudioSinkSupported(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}
