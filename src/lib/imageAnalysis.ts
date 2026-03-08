import { AnalysisResult } from '@/types';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function extractDominantColor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): { color: string; saturation: number } {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;

  // Count quantized colors, skipping near-neutral pixels
  const colorMap = new Map<
    string,
    { count: number; r: number; g: number; b: number; totalSat: number }
  >();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;

    const [, s, l] = rgbToHsl(r, g, b);
    // Only consider colored pixels (skip grey, black, white)
    if (s < 15 || l < 8 || l > 92) continue;

    // Quantize to 8-step buckets for clustering
    const rq = Math.round(r / 32) * 32;
    const gq = Math.round(g / 32) * 32;
    const bq = Math.round(b / 32) * 32;
    const key = `${rq},${gq},${bq}`;

    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
      existing.totalSat += s;
    } else {
      colorMap.set(key, { count: 1, r: rq, g: gq, b: bq, totalSat: s });
    }
  }

  if (colorMap.size === 0) {
    return { color: '#808080', saturation: 0 };
  }

  // Find the most frequent colored cluster
  let maxCount = 0;
  let dominant = { r: 128, g: 128, b: 128, totalSat: 0, count: 1 };

  for (const entry of colorMap.values()) {
    if (entry.count > maxCount) {
      maxCount = entry.count;
      dominant = entry;
    }
  }

  const avgSat = dominant.totalSat / dominant.count;
  return {
    color: rgbToHex(
      Math.min(255, dominant.r),
      Math.min(255, dominant.g),
      Math.min(255, dominant.b)
    ),
    saturation: avgSat,
  };
}

function isColoredLight(saturation: number): boolean {
  return saturation > 20;
}

export async function analyzeImage(file: File): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas not supported'));
        return;
      }

      // Scale down for performance (max 800px wide)
      const scale = Math.min(1, 800 / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Analyze upper 40% of image where lights would be
      const analysisHeight = Math.max(1, Math.floor(canvas.height * 0.4));
      const halfWidth = Math.max(1, Math.floor(canvas.width / 2));

      // Left half → King building; Right half → Queen building
      const kingResult = extractDominantColor(ctx, 0, 0, halfWidth, analysisHeight);
      const queenResult = extractDominantColor(
        ctx,
        halfWidth,
        0,
        canvas.width - halfWidth,
        analysisHeight
      );

      const kingValid = isColoredLight(kingResult.saturation);
      const queenValid = isColoredLight(queenResult.saturation);
      const isValid = kingValid || queenValid;
      const confidence = (kingValid ? 0.5 : 0) + (queenValid ? 0.5 : 0);

      URL.revokeObjectURL(url);

      resolve({
        kingColor: kingValid ? kingResult.color : '#808080',
        queenColor: queenValid ? queenResult.color : '#808080',
        isValid,
        confidence,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
