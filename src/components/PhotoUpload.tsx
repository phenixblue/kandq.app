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
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="w-full rounded-xl object-cover max-h-64"
            />

            {analyzing && (
              <div className="flex items-center gap-2 text-purple-400">
                <span className="animate-spin text-lg">⟳</span>
                <span className="text-sm">Analyzing image…</span>
              </div>
            )}

            {analysisResult && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-300">Analysis Result</p>

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
