import { describe, it, expect } from 'vitest';
import {
  rgbToHsl,
  rgbToHex,
  computeImageLuminance,
  isNightScene,
  isColoredRegion,
  relativeCrownY,
} from '../imageAnalysisUtils';

// ---------------------------------------------------------------------------
// rgbToHsl
// ---------------------------------------------------------------------------
describe('rgbToHsl', () => {
  it('converts pure red to H=0, S=100, L=50', () => {
    const [h, s, l] = rgbToHsl(255, 0, 0);
    expect(h).toBeCloseTo(0, 1);
    expect(s).toBeCloseTo(100, 1);
    expect(l).toBeCloseTo(50, 1);
  });

  it('converts pure green to H=120, S=100, L=50', () => {
    const [h, s, l] = rgbToHsl(0, 255, 0);
    expect(h).toBeCloseTo(120, 1);
    expect(s).toBeCloseTo(100, 1);
    expect(l).toBeCloseTo(50, 1);
  });

  it('converts pure blue to H=240, S=100, L=50', () => {
    const [h, s, l] = rgbToHsl(0, 0, 255);
    expect(h).toBeCloseTo(240, 1);
    expect(s).toBeCloseTo(100, 1);
    expect(l).toBeCloseTo(50, 1);
  });

  it('converts white to L=100, S=0', () => {
    const [, s, l] = rgbToHsl(255, 255, 255);
    expect(s).toBeCloseTo(0, 1);
    expect(l).toBeCloseTo(100, 1);
  });

  it('converts black to L=0, S=0', () => {
    const [, s, l] = rgbToHsl(0, 0, 0);
    expect(s).toBeCloseTo(0, 1);
    expect(l).toBeCloseTo(0, 1);
  });

  it('converts mid-grey to S=0, L≈50', () => {
    // 128/255 ≈ 0.502, so L is ~50.2 — use 0 decimal places (within ±0.5)
    const [, s, l] = rgbToHsl(128, 128, 128);
    expect(s).toBeCloseTo(0, 0);
    expect(l).toBeCloseTo(50, 0);
  });

  it('returns H in [0, 360], S in [0, 100], L in [0, 100]', () => {
    for (const [r, g, b] of [[255, 165, 0], [0, 128, 255], [200, 50, 150]]) {
      const [h, s, l] = rgbToHsl(r, g, b);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(360);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// rgbToHex
// ---------------------------------------------------------------------------
describe('rgbToHex', () => {
  it('converts pure red', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
  });

  it('converts pure green', () => {
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
  });

  it('converts pure blue', () => {
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
  });

  it('converts black', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('converts white', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  it('pads single-digit hex components', () => {
    // R=1 → '01', G=2 → '02', B=3 → '03'
    expect(rgbToHex(1, 2, 3)).toBe('#010203');
  });

  it('produces lowercase hex', () => {
    expect(rgbToHex(171, 205, 239)).toBe('#abcdef');
  });
});

// ---------------------------------------------------------------------------
// computeImageLuminance
// ---------------------------------------------------------------------------
describe('computeImageLuminance', () => {
  it('returns 0 for an empty array', () => {
    expect(computeImageLuminance(new Uint8ClampedArray(0))).toBe(0);
  });

  it('returns ~0 for a fully-black image', () => {
    // 4 pixels, all black (R=0, G=0, B=0, A=255)
    const data = new Uint8ClampedArray(4 * 4).fill(0);
    // Set alpha channels
    data[3] = data[7] = data[11] = data[15] = 255;
    expect(computeImageLuminance(data)).toBeCloseTo(0, 5);
  });

  it('returns ~255 for a fully-white image', () => {
    const data = new Uint8ClampedArray(4 * 4).fill(255);
    expect(computeImageLuminance(data)).toBeCloseTo(255, 5);
  });

  it('returns ~76.25 for a single pure-red pixel (0.299*255)', () => {
    // RGBA: [255, 0, 0, 255]
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    expect(computeImageLuminance(data)).toBeCloseTo(0.299 * 255, 2);
  });

  it('returns ~149.68 for a single pure-green pixel (0.587*255)', () => {
    const data = new Uint8ClampedArray([0, 255, 0, 255]);
    expect(computeImageLuminance(data)).toBeCloseTo(0.587 * 255, 2);
  });

  it('averages luminance across multiple pixels', () => {
    // One black pixel (lum=0) and one white pixel (lum=255) → average 127.5
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,       // black
      255, 255, 255, 255, // white
    ]);
    expect(computeImageLuminance(data)).toBeCloseTo(127.5, 1);
  });
});

// ---------------------------------------------------------------------------
// isNightScene
// ---------------------------------------------------------------------------
describe('isNightScene', () => {
  it('returns true for very dark images (nighttime)', () => {
    expect(isNightScene(20)).toBe(true);
    expect(isNightScene(50)).toBe(true);
    expect(isNightScene(100)).toBe(true); // threshold boundary (inclusive)
  });

  it('returns false for bright images (daytime)', () => {
    expect(isNightScene(101)).toBe(false);
    expect(isNightScene(150)).toBe(false);
    expect(isNightScene(200)).toBe(false);
  });

  it('respects a custom threshold', () => {
    expect(isNightScene(70, 80)).toBe(true);
    expect(isNightScene(81, 80)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isColoredRegion
// ---------------------------------------------------------------------------
describe('isColoredRegion', () => {
  it('returns true when saturation and pixel count are above thresholds', () => {
    expect(isColoredRegion(25, 40)).toBe(true);
    expect(isColoredRegion(19, 35)).toBe(true); // just above both boundaries
  });

  it('returns false when saturation is too low', () => {
    expect(isColoredRegion(18, 100)).toBe(false); // saturation exactly at boundary → fail
    expect(isColoredRegion(10, 200)).toBe(false);
  });

  it('returns false when pixel count is too low', () => {
    expect(isColoredRegion(50, 34)).toBe(false); // pixel count exactly at boundary → fail
    expect(isColoredRegion(90, 0)).toBe(false);
  });

  it('returns false when both values are below thresholds', () => {
    expect(isColoredRegion(5, 5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// relativeCrownY
// ---------------------------------------------------------------------------
describe('relativeCrownY', () => {
  it('returns 0 when crown is at the very top', () => {
    expect(relativeCrownY(0, 600)).toBe(0);
  });

  it('returns 1 when crown minY equals analysisHeight', () => {
    expect(relativeCrownY(600, 600)).toBe(1);
  });

  it('returns 0.5 for a midpoint crown', () => {
    expect(relativeCrownY(300, 600)).toBeCloseTo(0.5, 5);
  });

  it('clamps values below 0 to 0', () => {
    expect(relativeCrownY(-10, 600)).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    expect(relativeCrownY(700, 600)).toBe(1);
  });

  it('returns 0 when analysisHeight is 0 to avoid division by zero', () => {
    expect(relativeCrownY(50, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// King / Queen building disambiguation – domain invariant
// ---------------------------------------------------------------------------
describe('King vs. Queen crown height invariant', () => {
  it('King crown (Willis Tower, taller) should have a smaller relativeCrownY than Queen crown', () => {
    // Willis Tower is taller → its crown appears closer to the top of the frame
    // (smaller Y in image coordinates) → smaller relativeCrownY value.
    const analysisHeight = 600;
    const kingCrownY = relativeCrownY(60, analysisHeight);   // 10% from top
    const queenCrownY = relativeCrownY(180, analysisHeight); // 30% from top
    expect(kingCrownY).toBeLessThan(queenCrownY);
  });
});
