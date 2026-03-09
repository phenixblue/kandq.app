import { AnalysisBuildingDiagnostic, AnalysisDebugPixel, AnalysisDebugRegion, AnalysisResult } from '@/types';

interface ColorSample {
  color: string;
  saturation: number;
  coloredPixels: number;
  confidence: number;
}

interface ComponentStats {
  id: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  sumL: number;
  sumS: number;
  sumR: number;
  sumG: number;
  sumB: number;
  score: number;
  sampledPoints: Array<{ x: number; y: number }>;
}

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

function countNeighbors(mask: Uint8Array, width: number, height: number, x: number, y: number): number {
  let total = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (mask[ny * width + nx] === 1) total++;
    }
  }
  return total;
}

function smoothMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  const denoised = new Uint8Array(mask.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0) continue;
      const neighbors = countNeighbors(mask, width, height, x, y);
      denoised[idx] = neighbors >= 2 ? 1 : 0;
    }
  }

  const closed = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const neighbors = countNeighbors(denoised, width, height, x, y);
      closed[idx] = denoised[idx] === 1 || neighbors >= 5 ? 1 : 0;
    }
  }

  return closed;
}

function computeIoU(a: ComponentStats, b: ComponentStats): number {
  const x1 = Math.max(a.minX, b.minX);
  const y1 = Math.max(a.minY, b.minY);
  const x2 = Math.min(a.maxX, b.maxX);
  const y2 = Math.min(a.maxY, b.maxY);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1 + 1) * (y2 - y1 + 1);
  const areaA = (a.maxX - a.minX + 1) * (a.maxY - a.minY + 1);
  const areaB = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1);
  const union = areaA + areaB - intersection;

  return union <= 0 ? 0 : intersection / union;
}

function extractComponents(
  data: Uint8ClampedArray,
  saturation: Float32Array,
  lightness: Float32Array,
  mask: Uint8Array,
  width: number,
  height: number
): { components: ComponentStats[]; componentIds: Int32Array } {
  const componentIds = new Int32Array(mask.length);
  componentIds.fill(-1);

  const components: ComponentStats[] = [];
  let componentIndex = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const startIdx = y * width + x;
      if (mask[startIdx] === 0 || componentIds[startIdx] !== -1) continue;

      const queue: number[] = [startIdx];
      let queuePtr = 0;
      let area = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let sumL = 0;
      let sumS = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      const sampledPoints: Array<{ x: number; y: number }> = [];

      componentIds[startIdx] = componentIndex;

      while (queuePtr < queue.length) {
        const idx = queue[queuePtr++];
        const px = idx % width;
        const py = Math.floor(idx / width);
        const dataIdx = idx * 4;

        area++;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);

        const l = lightness[idx];
        const s = saturation[idx];
        sumL += l;
        sumS += s;
        sumR += data[dataIdx];
        sumG += data[dataIdx + 1];
        sumB += data[dataIdx + 2];

        if (sampledPoints.length < 180 && area % 8 === 0) {
          sampledPoints.push({ x: px, y: py });
        }

        const neighbors = [
          idx - 1,
          idx + 1,
          idx - width,
          idx + width,
        ];

        for (const neighbor of neighbors) {
          if (neighbor < 0 || neighbor >= mask.length) continue;
          const nx = neighbor % width;
          const ny = Math.floor(neighbor / width);
          if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue;
          if (mask[neighbor] === 0 || componentIds[neighbor] !== -1) continue;
          componentIds[neighbor] = componentIndex;
          queue.push(neighbor);
        }
      }

      if (area >= 18) {
        const avgL = sumL / area;
        const avgS = sumS / area;
        const bboxWidth = maxX - minX + 1;
        const bboxHeight = maxY - minY + 1;
        const compactness = area / Math.max(1, bboxWidth * bboxHeight);
        const centerY = (minY + maxY) / 2;
        const yBias = Math.max(0.2, 1.35 - centerY / height);
        const score = area * (0.45 + avgL / 100) * (0.25 + avgS / 100) * yBias * (0.5 + compactness);

        components.push({
          id: componentIndex,
          area,
          minX,
          minY,
          maxX,
          maxY,
          sumL,
          sumS,
          sumR,
          sumG,
          sumB,
          score,
          sampledPoints,
        });
      }

      componentIndex++;
    }
  }

  return { components, componentIds };
}

function extractBuildingCrownColor(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  building: 'king' | 'queen',
  startX: number,
  halfWidth: number,
  analysisHeight: number
): {
  aggregate: ColorSample;
  debugRegions: AnalysisDebugRegion[];
  debugPixels: AnalysisDebugPixel[];
  candidateComponents: number;
  selectedComponents: number;
} {
  const imageData = ctx.getImageData(startX, 0, halfWidth, analysisHeight);
  const data = imageData.data;
  const saturation = new Float32Array(halfWidth * analysisHeight);
  const lightness = new Float32Array(halfWidth * analysisHeight);
  const candidateMask = new Uint8Array(halfWidth * analysisHeight);

  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 96) continue;

    const [, s, l] = rgbToHsl(r, g, b);
    saturation[idx] = s;
    lightness[idx] = l;

    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const brightEnough = l >= 28 && maxChannel >= 100;
    const chromaLike = s >= 8 || maxChannel - minChannel <= 25;
    if (brightEnough && chromaLike) {
      candidateMask[idx] = 1;
    }
  }

  const cleanedMask = smoothMask(candidateMask, halfWidth, analysisHeight);
  const { components, componentIds } = extractComponents(
    data,
    saturation,
    lightness,
    cleanedMask,
    halfWidth,
    analysisHeight
  );

  const sorted = components
    .filter((component) => component.maxY < analysisHeight * 0.95)
    .sort((a, b) => b.score - a.score);

  const selected: ComponentStats[] = [];
  for (const component of sorted) {
    if (selected.length >= 3) break;
    const overlaps = selected.some((picked) => computeIoU(component, picked) > 0.58);
    if (!overlaps) selected.push(component);
  }

  const selectedIds = new Set<number>(selected.map((component) => component.id));
  const debugRegions: AnalysisDebugRegion[] = [];
  const debugPixels: AnalysisDebugPixel[] = [];

  const regionComponents = sorted.slice(0, 8);
  for (let i = 0; i < regionComponents.length; i++) {
    const component = regionComponents[i];
    const label = `blob-${i + 1}`;
    const area = Math.max(1, component.area);
    const avgR = Math.round(component.sumR / area);
    const avgG = Math.round(component.sumG / area);
    const avgB = Math.round(component.sumB / area);
    const avgS = component.sumS / area;

    debugRegions.push({
      building,
      label,
      x: startX + component.minX,
      y: component.minY,
      width: component.maxX - component.minX + 1,
      height: component.maxY - component.minY + 1,
      sampleColor: rgbToHex(avgR, avgG, avgB),
      saturation: avgS,
      coloredPixels: component.area,
    });

    const used = selectedIds.has(component.id);
    for (const point of component.sampledPoints) {
      debugPixels.push({
        building,
        label,
        x: startX + point.x,
        y: point.y,
        used,
      });
    }
  }

  let weightedR = 0;
  let weightedG = 0;
  let weightedB = 0;
  let weightedS = 0;
  let totalWeight = 0;
  let coloredPixels = 0;

  for (let idx = 0; idx < componentIds.length; idx++) {
    if (!selectedIds.has(componentIds[idx])) continue;

    const dataIdx = idx * 4;
    const r = data[dataIdx];
    const g = data[dataIdx + 1];
    const b = data[dataIdx + 2];
    const s = saturation[idx];
    const l = lightness[idx];
    const maxChannel = Math.max(r, g, b);

    const isColored = s >= 10 && l >= 14 && l <= 96 && maxChannel >= 80;
    if (!isColored) continue;

    const weight = (s + 8) * (0.6 + l / 100);
    weightedR += r * weight;
    weightedG += g * weight;
    weightedB += b * weight;
    weightedS += s * weight;
    totalWeight += weight;
    coloredPixels++;
  }

  const averageSaturation = totalWeight > 0 ? weightedS / totalWeight : 0;
  const confidence = Math.min(1, (coloredPixels / 260) * 0.6 + (averageSaturation / 40) * 0.4);

  const aggregate: ColorSample = totalWeight > 0
    ? {
        color: rgbToHex(
          Math.round(weightedR / totalWeight),
          Math.round(weightedG / totalWeight),
          Math.round(weightedB / totalWeight)
        ),
        saturation: averageSaturation,
        coloredPixels,
        confidence,
      }
    : {
        color: '#808080',
        saturation: 0,
        coloredPixels: 0,
        confidence: 0,
      };

  return {
    aggregate,
    debugRegions,
    debugPixels,
    candidateComponents: sorted.length,
    selectedComponents: selected.length,
  };
}

function isColoredLight(sample: ColorSample): boolean {
  return sample.saturation > 18 && sample.coloredPixels >= 35;
}

function getFailureReason(
  sample: ColorSample,
  candidateComponents: number,
  selectedComponents: number
): string {
  if (candidateComponents === 0) {
    return 'No bright crown-like blobs detected in this half of the image.';
  }
  if (selectedComponents === 0) {
    return 'Detected bright blobs, but none passed overlap/quality selection.';
  }
  if (sample.coloredPixels < 35) {
    return `Too few colored pixels (${sample.coloredPixels} < 35) in selected blobs.`;
  }
  if (sample.saturation <= 18) {
    return `Low color saturation (${Math.round(sample.saturation)} <= 18) in selected blobs.`;
  }
  return 'Detection passed.';
}

function buildDiagnostic(
  building: 'king' | 'queen',
  sample: ColorSample,
  passed: boolean,
  candidateComponents: number,
  selectedComponents: number
): AnalysisBuildingDiagnostic {
  return {
    building,
    passed,
    reason: passed
      ? 'Detection passed.'
      : getFailureReason(sample, candidateComponents, selectedComponents),
    saturation: sample.saturation,
    coloredPixels: sample.coloredPixels,
    confidence: sample.confidence,
    candidateComponents,
    selectedComponents,
  };
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

      // Analyze upper 60% of image to tolerate lower framing
      const analysisHeight = Math.max(1, Math.floor(canvas.height * 0.6));
      const halfWidth = Math.max(1, Math.floor(canvas.width / 2));

      // Left half → King building; Right half → Queen building
      const kingAnalysis = extractBuildingCrownColor(
        ctx,
        canvas.width,
        canvas.height,
        'king',
        0,
        halfWidth,
        analysisHeight
      );
      const queenAnalysis = extractBuildingCrownColor(
        ctx,
        canvas.width,
        canvas.height,
        'queen',
        halfWidth,
        canvas.width - halfWidth,
        analysisHeight
      );

      const kingResult = kingAnalysis.aggregate;
      const queenResult = queenAnalysis.aggregate;

      const kingValid = isColoredLight(kingResult);
      const queenValid = isColoredLight(queenResult);
      const isValid = kingValid || queenValid;
      const confidence = Math.min(1, (kingResult.confidence + queenResult.confidence) / 2);
      const kingDiagnostic = buildDiagnostic(
        'king',
        kingResult,
        kingValid,
        kingAnalysis.candidateComponents,
        kingAnalysis.selectedComponents
      );
      const queenDiagnostic = buildDiagnostic(
        'queen',
        queenResult,
        queenValid,
        queenAnalysis.candidateComponents,
        queenAnalysis.selectedComponents
      );

      URL.revokeObjectURL(url);

      resolve({
        kingColor: kingValid ? kingResult.color : '#808080',
        queenColor: queenValid ? queenResult.color : '#808080',
        isValid,
        confidence,
        diagnostics: {
          king: kingDiagnostic,
          queen: queenDiagnostic,
        },
        debug: {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          regions: [...kingAnalysis.debugRegions, ...queenAnalysis.debugRegions],
          pixels: [...kingAnalysis.debugPixels, ...queenAnalysis.debugPixels],
        },
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
