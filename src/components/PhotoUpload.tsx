'use client';

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { analyzeImage } from '@/lib/imageAnalysis';
import { AnalysisResult } from '@/types';

interface PhotoUploadProps {
  userId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function PhotoUpload({ userId, onSuccess, onClose }: PhotoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [showStrongOnly, setShowStrongOnly] = useState(false);
  const [previewMetrics, setPreviewMetrics] = useState<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLImageElement>(null);

  const updatePreviewMetrics = useCallback(() => {
    const container = previewContainerRef.current;
    const image = previewImageRef.current;
    if (!container || !image) return;

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();

    setPreviewMetrics({
      offsetX: Math.max(0, imageRect.left - containerRect.left),
      offsetY: Math.max(0, imageRect.top - containerRect.top),
      width: imageRect.width,
      height: imageRect.height,
    });
  }, []);

  const handleFileChange = useCallback(async (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10 MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setAnalysisResult(null);
    setShowDebugOverlay(false);
    setShowStrongOnly(false);
    setPreviewMetrics(null);

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);

    // Run analysis
    setAnalyzing(true);
    try {
      const result = await analyzeImage(selectedFile);
      setAnalysisResult(result);
      if (!result.isValid) {
        setError(
          'Could not detect colored lights from the King or Queen buildings in this photo. ' +
            'Please make sure at least one building crown is visible and illuminated.'
        );
      }
    } catch {
      setError('Failed to analyze the image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFileChange(dropped);
    },
    [handleFileChange]
  );

  const handleUpload = async () => {
    if (!file || !analysisResult || !analysisResult.isValid) return;

    setUploading(true);
    setError(null);

    try {
      // Upload to Supabase Storage
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `photos/${userId}/${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from('kandq-photos')
        .upload(storagePath, file, { contentType: file.type });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from('kandq-photos')
        .getPublicUrl(storagePath);

      // Save to database via API route
      const response = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlData.publicUrl,
          storage_path: storagePath,
          king_color: analysisResult.kingColor,
          queen_color: analysisResult.queenColor,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save photo');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Submit a Photo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Upload a photo of the King and Queen buildings at night showing the illuminated crowns.
          The app will automatically detect the light colors.
        </p>

        {/* Drop zone */}
        {!preview && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-600 hover:border-purple-500 rounded-xl p-10 text-center cursor-pointer transition-colors"
          >
            <div className="text-4xl mb-3">📸</div>
            <p className="text-gray-300 font-medium">Drop your photo here</p>
            <p className="text-gray-500 text-sm mt-1">or click to browse</p>
            <p className="text-gray-600 text-xs mt-2">JPG, PNG, WEBP · Max 10 MB</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileChange(f);
          }}
        />

        {/* Preview */}
        {preview && (
          <div className="space-y-4">
            <div
              ref={previewContainerRef}
              className="relative w-full rounded-xl overflow-hidden bg-black/20 flex justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={previewImageRef}
                src={preview}
                alt="Preview"
                className="block w-auto h-auto max-w-full max-h-80 object-contain"
                onLoad={updatePreviewMetrics}
              />

              {showDebugOverlay && analysisResult?.debug && previewMetrics && (
                <div className="absolute inset-0 pointer-events-none">
                  {analysisResult.debug.pixels
                    .filter((pixel) => (showStrongOnly ? pixel.used : true))
                    .map((pixel, index) => {
                      const { canvasWidth, canvasHeight } = analysisResult.debug as NonNullable<AnalysisResult['debug']>;
                      const left = previewMetrics.offsetX + (pixel.x / canvasWidth) * previewMetrics.width;
                      const top = previewMetrics.offsetY + (pixel.y / canvasHeight) * previewMetrics.height;

                      return (
                        <div
                          key={`px-${pixel.building}-${pixel.label}-${index}`}
                          className="absolute rounded-full"
                          style={{
                            left: `${left}px`,
                            top: `${top}px`,
                            width: '3px',
                            height: '3px',
                            backgroundColor: pixel.used
                              ? (pixel.building === 'king' ? '#22c55e' : '#0ea5e9')
                              : '#94a3b8',
                            opacity: pixel.used ? 0.85 : 0.45,
                            transform: 'translate(-50%, -50%)',
                          }}
                        />
                      );
                    })}

                  {analysisResult.debug.regions
                    .filter((region) => {
                      const isStrong = region.saturation >= 20 && region.coloredPixels >= 12;
                      return showStrongOnly ? isStrong : true;
                    })
                    .map((region, index) => {
                      const { canvasWidth, canvasHeight } = analysisResult.debug as NonNullable<AnalysisResult['debug']>;
                      const left = previewMetrics.offsetX + (region.x / canvasWidth) * previewMetrics.width;
                      const top = previewMetrics.offsetY + (region.y / canvasHeight) * previewMetrics.height;
                      const width = (region.width / canvasWidth) * previewMetrics.width;
                      const height = (region.height / canvasHeight) * previewMetrics.height;
                      const isStrong = region.saturation >= 20 && region.coloredPixels >= 12;
                      const borderColor = region.building === 'king' ? '#a855f7' : '#f59e0b';

                      return (
                        <div
                          key={`${region.building}-${region.label}-${index}`}
                          className="absolute"
                          style={{
                            left: `${left}px`,
                            top: `${top}px`,
                            width: `${width}px`,
                            height: `${height}px`,
                            border: `2px solid ${borderColor}`,
                            backgroundColor: isStrong ? `${borderColor}22` : `${borderColor}10`,
                          }}
                          title={`${region.building} ${region.label} · sat ${Math.round(region.saturation)} · px ${region.coloredPixels}`}
                        >
                          <div
                            className="absolute -top-4 left-0 text-[10px] leading-none px-1 py-0.5 rounded-sm text-white/90 bg-black/60"
                          >
                            {region.building}:{region.label}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {analyzing && (
              <div className="flex items-center gap-2 text-purple-400">
                <span className="animate-spin text-lg">⟳</span>
                <span className="text-sm">Analyzing image…</span>
              </div>
            )}

            {analysisResult && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-300">Analysis Result</p>

                {analysisResult.debug && (
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDebugOverlay}
                        onChange={(e) => setShowDebugOverlay(e.target.checked)}
                      />
                      Show debug sample regions
                    </label>
                    {showDebugOverlay && (
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showStrongOnly}
                            onChange={(e) => setShowStrongOnly(e.target.checked)}
                          />
                          Show strong regions only
                        </label>

                        <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                            Used King pixels
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                            Used Queen pixels
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                            Weak/unused pixels
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="pt-1">
                      <p className="text-[11px] text-gray-500 mb-1">Sample legend</p>
                      <div className="max-h-36 overflow-y-auto rounded-md border border-gray-700 bg-gray-900/40">
                        {analysisResult.debug.regions
                          .filter((region) => {
                            const isStrong = region.saturation >= 20 && region.coloredPixels >= 12;
                            return showStrongOnly ? isStrong : true;
                          })
                          .map((region, index) => {
                            const isStrong = region.saturation >= 20 && region.coloredPixels >= 12;
                            return (
                              <div
                                key={`legend-${region.building}-${region.label}-${index}`}
                                className="flex items-center gap-2 px-2 py-1 border-b border-gray-800 last:border-b-0"
                              >
                                <div
                                  className="w-3.5 h-3.5 rounded-sm border border-white/20"
                                  style={{ backgroundColor: region.sampleColor }}
                                />
                                <span className="text-[11px] text-gray-300 min-w-[88px]">
                                  {region.building}:{region.label}
                                </span>
                                <span className="text-[11px] text-gray-400 font-mono min-w-[68px]">
                                  {region.sampleColor}
                                </span>
                                <span className="text-[11px] text-gray-500">
                                  sat {Math.round(region.saturation)} · px {region.coloredPixels}
                                </span>
                                <span
                                  className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border ${
                                    isStrong
                                      ? 'text-green-300 border-green-700/70 bg-green-900/30'
                                      : 'text-gray-400 border-gray-600 bg-gray-800/60'
                                  }`}
                                >
                                  {isStrong ? 'used' : 'weak'}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      analysisResult.isValid
                        ? 'bg-green-900/50 text-green-400 border border-green-700'
                        : 'bg-red-900/50 text-red-400 border border-red-700'
                    }`}
                  >
                    {analysisResult.isValid ? '✓ Buildings Detected' : '✗ Not Detected'}
                  </span>
                  <span className="text-xs text-gray-500">
                    Confidence: {Math.round(analysisResult.confidence * 100)}%
                  </span>
                </div>

                {analysisResult.diagnostics && (
                  <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-300">Detection diagnostics</p>

                    {[analysisResult.diagnostics.king, analysisResult.diagnostics.queen].map((diag) => (
                      <div key={diag.building} className="text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="uppercase tracking-wide text-gray-400 min-w-12">{diag.building}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full border ${
                              diag.passed
                                ? 'text-green-300 border-green-700/70 bg-green-900/30'
                                : 'text-red-300 border-red-700/70 bg-red-900/30'
                            }`}
                          >
                            {diag.passed ? 'pass' : 'fail'}
                          </span>
                          <span className="text-gray-500">
                            sat {Math.round(diag.saturation)} · px {diag.coloredPixels} · blobs {diag.selectedComponents}/{diag.candidateComponents}
                          </span>
                        </div>
                        {!diag.passed && (
                          <p className="text-gray-400 ml-14">{diag.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {analysisResult.isValid && (
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border border-white/20"
                        style={{ backgroundColor: analysisResult.kingColor }}
                      />
                      <span className="text-xs text-gray-400">King: {analysisResult.kingColor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border border-white/20"
                        style={{ backgroundColor: analysisResult.queenColor }}
                      />
                      <span className="text-xs text-gray-400">Queen: {analysisResult.queenColor}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setAnalysisResult(null);
                  setShowDebugOverlay(false);
                  setShowStrongOnly(false);
                  setPreviewMetrics(null);
                  setError(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                Choose Different Photo
              </button>
              <button
                onClick={handleUpload}
                disabled={!analysisResult?.isValid || uploading || analyzing}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {uploading ? 'Uploading…' : 'Submit Photo'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
