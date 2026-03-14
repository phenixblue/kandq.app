/**
 * Pure utility functions for image colour analysis.
 * These functions have no browser-API dependencies and can be unit-tested in Node.js.
 */

/**
 * Convert RGB (0–255 each) to HSL (H: 0–360, S: 0–100, L: 0–100).
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

/**
 * Convert RGB (0–255 each) to a lowercase hex colour string (e.g. "#ff0000").
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Compute the perceived luminance (0–255) averaged across all pixels.
 * Uses ITU-R BT.601 coefficients.
 *
 * @param data - Raw RGBA pixel data (Uint8ClampedArray from ImageData).
 */
export function computeImageLuminance(data: Uint8ClampedArray): number {
  const pixelCount = data.length / 4;
  if (pixelCount === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / pixelCount;
}

/**
 * Determine whether an image is a nighttime scene based on average perceived
 * luminance. Returns `true` when the image is dark enough for illuminated
 * building crowns to be plausibly visible (i.e. nighttime). Returns `false`
 * for images that appear to be taken during daylight.
 *
 * @param avgLuminance - Average luminance (0–255) of the full image.
 * @param threshold    - Luminance ceiling for "night"; defaults to 100.
 */
export function isNightScene(avgLuminance: number, threshold = 100): boolean {
  return avgLuminance <= threshold;
}

/**
 * Return whether a sampled crown region has enough colour saturation and
 * pixel coverage to be considered a valid colour detection.
 *
 * @param saturation    - Average HSL saturation (0–100) of selected blobs.
 * @param coloredPixels - Number of coloured pixels that passed the filter.
 */
export function isColoredRegion(saturation: number, coloredPixels: number): boolean {
  return saturation > 18 && coloredPixels >= 35;
}

/**
 * Compute the relative vertical position (0 = top of region, 1 = bottom of
 * image) of the topmost detected crown component.
 *
 * @param crownMinY      - Minimum Y coordinate of the top-most crown blob (pixels).
 * @param analysisHeight - Height of the analysis region in pixels.
 */
export function relativeCrownY(crownMinY: number, analysisHeight: number): number {
  if (analysisHeight <= 0) return 0;
  return Math.max(0, Math.min(1, crownMinY / analysisHeight));
}
