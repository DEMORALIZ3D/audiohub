export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  rgb: [number, number, number];
}

export const DEFAULT_PALETTE: ColorPalette = {
  primary: 'rgb(30, 215, 96)',
  secondary: 'rgb(20, 140, 70)',
  accent: 'rgb(80, 230, 130)',
  rgb: [30, 215, 96],
};

/**
 * Extracts a dominant, saturated color palette from an image URL using
 * a lightweight 32x32 offscreen canvas.
 */
export async function extractPaletteFromImageUrl(imageUrl: string): Promise<ColorPalette> {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve(DEFAULT_PALETTE);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(DEFAULT_PALETTE);

        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32).data;

        let bestR = 30,
          bestG = 215,
          bestB = 96;
        let maxScore = -1;

        // Sample pixels to find highest saturation / vibrancy color
        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const brightness = (r + g + b) / 3;

          // Filter out near-black, near-white, or muddy grays
          if (brightness < 30 || brightness > 235 || delta < 15) continue;

          // Saturation score: delta weighted by moderate brightness
          const score = delta * (1 - Math.abs(brightness - 128) / 128);
          if (score > maxScore) {
            maxScore = score;
            bestR = r;
            bestG = g;
            bestB = b;
          }
        }

        // Secondary & accent: tonal shifts for harmonious glows
        const secR = Math.max(0, Math.floor(bestR * 0.65));
        const secG = Math.max(0, Math.floor(bestG * 0.65));
        const secB = Math.max(0, Math.floor(bestB * 0.65));

        const accR = Math.min(255, Math.floor(bestR * 1.3));
        const accG = Math.min(255, Math.floor(bestG * 1.3));
        const accB = Math.min(255, Math.floor(bestB * 1.3));

        resolve({
          primary: `rgb(${bestR}, ${bestG}, ${bestB})`,
          secondary: `rgb(${secR}, ${secG}, ${secB})`,
          accent: `rgb(${accR}, ${accG}, ${accB})`,
          rgb: [bestR, bestG, bestB],
        });
      } catch (err) {
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_PALETTE);
    };

    img.src = imageUrl;
  });
}
