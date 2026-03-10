'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { analyzeImage } from '@/lib/imageAnalysis';
import ThemeToggle from '@/components/ThemeToggle';
import type { AnalysisResult, Photo } from '@/types';

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function todayDateInput() {
  return new Date().toISOString().split('T')[0];
}

function toEasternDateInput(value: string) {
  return new Date(value).toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  });
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    throw new Error('Enter a valid hex color like #FFAA00');
  }

  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return trimmed.toUpperCase();
}

interface ManualEntrySectionProps {
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

interface AdminReason {
  id: string;
  user_id: string;
  reason_text: string;
  upvotes: number;
  downvotes: number;
  is_valid: boolean;
  submitted_at: string;
}

interface AdminStatsOverall {
  totalPhotos: number;
  validPhotos: number;
  totalReasons: number;
  validReasons: number;
  totalPhotoVotes: number;
  totalReasonVotes: number;
  totalDatesWithPhotos: number;
  totalDatesWithReasons: number;
  totalUniqueSubmitters: number;
  totalPhotoLockedDates: number;
  totalReasonLockedDates: number;
  averagePhotoVotesPerPhoto: number;
  averageReasonVotesPerReason: number;
  highestPhotoScore: number;
  highestReasonNetScore: number;
}

interface AdminStatsByDate {
  date: string;
  photosSubmitted: number;
  validPhotos: number;
  reasonsSubmitted: number;
  validReasons: number;
  photoVotesCast: number;
  reasonVotesCast: number;
  averagePhotoScore: number;
  averageReasonNetScore: number;
  photoTopLocked: boolean;
  reasonTopLocked: boolean;
  topPhotoId: string | null;
  topReasonText: string | null;
}

interface AdminStatsResponse {
  overall: AdminStatsOverall;
  byDate: AdminStatsByDate | null;
}

function ManualReasonSection() {
  const [selectedDate, setSelectedDate] = useState<string>(todayDateInput());
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reasonText.trim()) {
      setError('Please enter a reason');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          reason_text: reasonText.trim(),
          submitted_at: selectedDate + 'T12:00:00Z',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to create reason (${response.status})`);
      }

      setSuccess(`Successfully added reason for ${selectedDate}`);
      setReasonText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create manual reason');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span>💬</span> Manual Reason Entry
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Add a reason for a specific date
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-200 mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-700 bg-green-900/30 px-4 py-3 text-sm text-green-200 mb-4">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={todayDateInput()}
            className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Reason
          </label>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value.slice(0, 180))}
            placeholder="Why these colors on this date?"
            rows={5}
            className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 resize-none"
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            {reasonText.length}/180 characters
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !reasonText.trim()}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-lg transition-colors"
        >
          {submitting ? 'Submitting...' : 'Add Historical Reason'}
        </button>
      </div>
    </section>
  );
}

function ManualEntrySection({ authedFetch }: ManualEntrySectionProps) {
  const [selectedDate, setSelectedDate] = useState<string>(todayDateInput());
  const [kingColor, setKingColor] = useState('#FFFFFF');
  const [queenColor, setQueenColor] = useState('#FFFFFF');
  const [reason, setReason] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      setPhotoFile(file);
      setError(null);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleAutoDetect = async () => {
    if (!photoFile) {
      setError('Please select a photo first');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const analysis = await analyzeImage(photoFile);
      
      if (analysis.isValid) {
        setKingColor(analysis.kingColor.toUpperCase());
        setQueenColor(analysis.queenColor.toUpperCase());
        setSuccess(`Detected colors - Confidence: ${Math.round(analysis.confidence * 100)}%`);
      } else {
        setError('Could not detect valid building colors in this image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!photoFile) {
      setError('Please select a photo to upload');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate colors
      const normalizedKing = normalizeHex(kingColor);
      const normalizedQueen = normalizeHex(queenColor);

      // Upload to storage first
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const fileExt = photoFile.name.split('.').pop() || 'jpg';
      const filePath = `photos/${session.user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('kandq-photos')
        .upload(filePath, photoFile, { contentType: photoFile.type });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('kandq-photos')
        .getPublicUrl(filePath);

      // Create photo via API
      const response = await authedFetch('/api/admin/photos/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          kingColor: normalizedKing,
          queenColor: normalizedQueen,
          reason: reason.trim() || null,
          url: urlData.publicUrl,
          storagePath: filePath,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Manual API failed (${response.status})`);
      }

      setSuccess(`Successfully added entry for ${selectedDate}`);
      setPhotoFile(null);
      setReason('');
      setKingColor('#FFFFFF');
      setQueenColor('#FFFFFF');
      
      // Reset file input
      const fileInput = document.getElementById('manual-photo-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create manual entry');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span>📅</span> Manual Historical Entry
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Add a photo and color data for a specific date
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-200 mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-700 bg-green-900/30 px-4 py-3 text-sm text-green-200 mb-4">
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={todayDateInput()}
              className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Photo
            </label>
            <input
              id="manual-photo-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-purple-600 file:text-white file:text-xs file:font-medium hover:file:bg-purple-500"
            />
            {photoFile && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-[var(--muted-foreground)]">
                  Selected: {photoFile.name}
                </p>
                {previewUrl && (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-32 object-contain rounded-lg bg-[var(--surface-3)]" 
                  />
                )}
                <button
                  onClick={handleAutoDetect}
                  disabled={analyzing}
                  className="w-full text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {analyzing ? 'Analyzing...' : '🔍 Auto-Detect Colors'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">
                King Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={kingColor}
                  onChange={(e) => setKingColor(e.target.value.toUpperCase())}
                  placeholder="#FFFFFF"
                  className="flex-1 text-sm font-mono bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg px-3 py-2"
                />
                <div
                  className="w-10 h-10 rounded-lg border border-white/25"
                  style={{ backgroundColor: kingColor }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Queen Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={queenColor}
                  onChange={(e) => setQueenColor(e.target.value.toUpperCase())}
                  placeholder="#FFFFFF"
                  className="flex-1 text-sm font-mono bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg px-3 py-2"
                />
                <div
                  className="w-10 h-10 rounded-lg border border-white/25"
                  style={{ backgroundColor: queenColor }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 180))}
              placeholder="Why these colors on this date?"
              rows={5}
              className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 resize-none"
            />
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {reason.length}/180 characters
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={uploading || !photoFile}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-lg transition-colors"
          >
            {uploading ? 'Uploading...' : 'Add Historical Entry'}
          </button>
        </div>
      </div>
    </section>
  );
}


export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [reasons, setReasons] = useState<AdminReason[]>([]);
  const [activeTab, setActiveTab] = useState<'photos' | 'reasons' | 'stats'>('photos');
  const [statsDate, setStatsDate] = useState(todayDateInput());
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [topDateById, setTopDateById] = useState<Record<string, string>>({});
  const [topReasonDateById, setTopReasonDateById] = useState<Record<string, string>>({});
  const [topPhotoByDate, setTopPhotoByDate] = useState<Record<string, string>>({});
  const [topReasonByDate, setTopReasonByDate] = useState<Record<string, string>>({});
  const [debugById, setDebugById] = useState<Record<string, AnalysisResult>>({});
  const [overrideById, setOverrideById] = useState<Record<string, { king: string; queen: string }>>({});
  const [showOverlayById, setShowOverlayById] = useState<Record<string, boolean>>({});
  const [strongOnlyById, setStrongOnlyById] = useState<Record<string, boolean>>({});

  const setBusy = (photoId: string, busy: boolean) => {
    setBusyById((prev) => ({ ...prev, [photoId]: busy }));
  };

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('You must be signed in to access admin tools.');
    }

    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);

    const response = await fetch(url, {
      ...init,
      headers,
    });

    return response;
  }, []);

  const loadTopSelections = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('color_history')
      .select('date, photo_id, reason, photo_locked, reason_locked')
      .limit(365);

    if (fetchError) {
      throw new Error(fetchError.message || 'Failed to load top selections.');
    }

    const nextPhotoByDate: Record<string, string> = {};
    const nextReasonByDate: Record<string, string> = {};

    for (const row of data || []) {
      if (row.date && row.photo_id && row.photo_locked) {
        nextPhotoByDate[row.date] = row.photo_id;
      }
      if (row.date && row.reason && row.reason_locked) {
        nextReasonByDate[row.date] = row.reason;
      }
    }

    setTopPhotoByDate(nextPhotoByDate);
    setTopReasonByDate(nextReasonByDate);
  }, []);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await authedFetch('/api/admin/photos');
        const payload = await response.json();

        if (response.status === 403) {
          // Not an admin
          setIsAdmin(false);
          setError('You do not have permission to access admin features.');
        } else if (response.ok) {
          // Is an admin
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          setError(payload.error || 'Failed to verify admin status.');
        }
      } catch (checkError) {
        setIsAdmin(false);
        setError(checkError instanceof Error ? checkError.message : 'Failed to verify admin status.');
      } finally {
        setLoading(false);
      }
    };

    void checkAdminStatus();
  }, [authedFetch]);

  const loadPhotos = useCallback(async () => {
    if (activeTab !== 'photos') return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await authedFetch('/api/admin/photos');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load photos.');
      }

      const list = (payload || []) as Photo[];
      setPhotos(list);
      await loadTopSelections();
      setTopDateById((prev) => {
        const next = { ...prev };
        for (const photo of list) {
          if (!next[photo.id]) {
            next[photo.id] = toEasternDateInput(photo.submitted_at);
          }
        }
        return next;
      });

      setOverrideById((prev) => {
        const next = { ...prev };
        for (const photo of list) {
          if (!next[photo.id]) {
            next[photo.id] = {
              king: (photo.king_color || '#FFFFFF').toUpperCase(),
              queen: (photo.queen_color || '#FFFFFF').toUpperCase(),
            };
          }
        }
        return next;
      });
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, activeTab, loadTopSelections]);

  const loadReasons = useCallback(async () => {
    if (activeTab !== 'reasons') return;
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('reasons')
        .select('id, user_id, reason_text, upvotes, downvotes, is_valid, submitted_at')
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to load reasons.');
      }

      const list = (data || []) as AdminReason[];
      setReasons(list);
      await loadTopSelections();
      setTopReasonDateById((prev) => {
        const next = { ...prev };
        for (const reason of list) {
          if (!next[reason.id]) {
            next[reason.id] = toEasternDateInput(reason.submitted_at);
          }
        }
        return next;
      });
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load reasons.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadTopSelections]);

  const loadStats = useCallback(async () => {
    if (activeTab !== 'stats') return;

    setLoading(true);
    setError(null);

    try {
      const response = await authedFetch(`/api/admin/stats?date=${encodeURIComponent(statsDate)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load statistics.');
      }

      setStats(payload as AdminStatsResponse);
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load statistics.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, authedFetch, statsDate]);

  useEffect(() => {
    if (activeTab === 'photos') {
      void loadPhotos();
    } else if (activeTab === 'reasons') {
      void loadReasons();
    } else {
      void loadStats();
    }
  }, [loadPhotos, loadReasons, loadStats, activeTab]);

  const handleDelete = async (photoId: string) => {
    const confirmed = window.confirm('Delete this photo and its storage object? This cannot be undone.');
    if (!confirmed) return;

    setBusy(photoId, true);
    setError(null);
    try {
      const response = await authedFetch(`/api/admin/photos/${photoId}`, {
        method: 'DELETE',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Delete failed.');
      }

      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      setDebugById((prev) => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      setOverrideById((prev) => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      setShowOverlayById((prev) => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      setStrongOnlyById((prev) => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed.');
    } finally {
      setBusy(photoId, false);
    }
  };

  const handleMarkTop = async (photo: Photo) => {
    setBusy(photo.id, true);
    setError(null);

    try {
      const selectedDate = topDateById[photo.id] || todayDateInput();
      const isCurrentlyTop = topPhotoByDate[selectedDate] === photo.id;

      const response = await authedFetch(`/api/admin/photos/${photo.id}/top-of-day`, {
        method: isCurrentlyTop ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to toggle top photo for day.');
      }

      setTopPhotoByDate((prev) => {
        const next = { ...prev };
        if (isCurrentlyTop) {
          delete next[selectedDate];
        } else {
          next[selectedDate] = photo.id;
        }
        return next;
      });

      alert(
        isCurrentlyTop
          ? `Removed top photo for ${payload.date}.`
          : `Marked photo as top-ranked for ${payload.date}.`
      );
    } catch (markError: unknown) {
      setError(markError instanceof Error ? markError.message : 'Failed to toggle top of day.');
    } finally {
      setBusy(photo.id, false);
    }
  };

  const handleApplyOverride = async (photo: Photo) => {
    const current = overrideById[photo.id] || { king: '#FFFFFF', queen: '#FFFFFF' };

    let kingColor = '';
    let queenColor = '';
    try {
      kingColor = normalizeHex(current.king);
      queenColor = normalizeHex(current.queen);
    } catch (validationError: unknown) {
      setError(validationError instanceof Error ? validationError.message : 'Invalid hex color values.');
      return;
    }

    setBusy(photo.id, true);
    setError(null);
    try {
      const response = await authedFetch(`/api/admin/photos/${photo.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kingColor, queenColor }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to apply override.');
      }

      if (payload.photo) {
        setPhotos((prev) =>
          prev.map((entry) => (entry.id === photo.id ? { ...entry, ...payload.photo } : entry))
        );
      }

      setOverrideById((prev) => ({
        ...prev,
        [photo.id]: { king: kingColor, queen: queenColor },
      }));
    } catch (overrideError: unknown) {
      setError(overrideError instanceof Error ? overrideError.message : 'Failed to apply override.');
    } finally {
      setBusy(photo.id, false);
    }
  };

  const handleRunDebug = async (photo: Photo) => {
    setBusy(photo.id, true);
    setError(null);

    try {
      const fileResponse = await fetch(photo.url);
      if (!fileResponse.ok) {
        throw new Error('Could not fetch image for debug analysis.');
      }

      const blob = await fileResponse.blob();
      const ext = photo.url.split('.').pop() || 'jpg';
      const debugFile = new File([blob], `debug-${photo.id}.${ext}`, {
        type: blob.type || 'image/jpeg',
      });

      const analysis = await analyzeImage(debugFile);
      setDebugById((prev) => ({ ...prev, [photo.id]: analysis }));

      if (analysis.isValid) {
        const persistResponse = await authedFetch(`/api/admin/photos/${photo.id}/analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kingColor: analysis.kingColor,
            queenColor: analysis.queenColor,
            isValid: analysis.isValid,
          }),
        });

        const persistPayload = await persistResponse.json();
        if (!persistResponse.ok) {
          throw new Error(persistPayload.error || 'Failed to persist analysis results.');
        }

        if (persistPayload.updated && persistPayload.photo) {
          setPhotos((prev) =>
            prev.map((entry) => (entry.id === photo.id ? { ...entry, ...persistPayload.photo } : entry))
          );
          setOverrideById((prev) => ({
            ...prev,
            [photo.id]: {
              king: (persistPayload.photo.king_color || analysis.kingColor).toUpperCase(),
              queen: (persistPayload.photo.queen_color || analysis.queenColor).toUpperCase(),
            },
          }));
        }
      }

      setShowOverlayById((prev) => ({ ...prev, [photo.id]: true }));
    } catch (debugError: unknown) {
      setError(debugError instanceof Error ? debugError.message : 'Debug analysis failed.');
    } finally {
      setBusy(photo.id, false);
    }
  };

  const handleDeleteReason = async (reasonId: string) => {
    const confirmed = window.confirm('Delete this reason? This cannot be undone.');
    if (!confirmed) return;

    setBusy(reasonId, true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('reasons')
        .delete()
        .eq('id', reasonId);

      if (deleteError) throw deleteError;

      setReasons((prev) => prev.filter((reason) => reason.id !== reasonId));
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed.');
    } finally {
      setBusy(reasonId, false);
    }
  };

  const handleMarkTopReason = async (reasonId: string) => {
    setBusy(reasonId, true);
    setError(null);

    try {
      const selectedDate = topReasonDateById[reasonId] || todayDateInput();
      const reason = reasons.find((entry) => entry.id === reasonId);
      if (!reason) {
        throw new Error('Reason not found.');
      }
      const isCurrentlyTop = topReasonByDate[selectedDate] === reason.reason_text;

      const response = await authedFetch('/api/admin/reasons/top-of-day', {
        method: isCurrentlyTop ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason_id: reasonId, date: selectedDate }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to toggle top reason for day.');
      }

      setTopReasonByDate((prev) => {
        const next = { ...prev };
        if (isCurrentlyTop) {
          delete next[selectedDate];
        } else {
          next[selectedDate] = reason.reason_text;
        }
        return next;
      });

      alert(
        isCurrentlyTop
          ? `Removed top reason for ${payload.date}.`
          : `Marked reason as top for ${payload.date}.`
      );
    } catch (markError: unknown) {
      setError(markError instanceof Error ? markError.message : 'Failed to toggle top reason.');
    } finally {
      setBusy(reasonId, false);
    }
  };

  const photoCountLabel = useMemo(() => {
    if (loading) return 'Loading…';
    if (activeTab === 'photos') {
      return `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
    }
    if (activeTab === 'reasons') {
      return `${reasons.length} reason${reasons.length === 1 ? '' : 's'}`;
    }
    return 'Statistics';
  }, [loading, photos.length, reasons.length, activeTab]);

  return (
    <div className="min-h-screen flex flex-col text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xl tracking-tight">KANDQ</span>
            <span className="hidden sm:inline text-sm text-[var(--muted-foreground)]">Admin</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm px-3 py-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-3)] transition-colors"
            >
              Back to site
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
      {!isAdmin ? (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-6 text-center text-red-200">
          <p className="font-semibold mb-2">Access Denied</p>
          <p>{error || 'You do not have permission to access admin features.'}</p>
        </div>
      ) : (
        <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Moderate submissions and inspect image analysis.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted-foreground)]">{photoCountLabel}</span>
          <button
            onClick={() =>
              activeTab === 'photos' ? void loadPhotos() :
              activeTab === 'reasons' ? void loadReasons() :
              void loadStats()
            }
            className="text-sm px-3 py-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-3)] transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-px">
        <button
          onClick={() => setActiveTab('photos')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'photos'
              ? 'border-purple-500 text-[var(--foreground)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          📸 Photos
        </button>
        <button
          onClick={() => setActiveTab('reasons')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'reasons'
              ? 'border-purple-500 text-[var(--foreground)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          💬 Reasons
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'stats'
              ? 'border-purple-500 text-[var(--foreground)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          📊 Statistics
        </button>
      </div>

      {activeTab === 'photos' ? (
        <>
          <ManualEntrySection authedFetch={authedFetch} />

          {error && (
            <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-[var(--muted-foreground)]">Loading submitted photos…</div>
          ) : photos.length === 0 ? (
            <div className="text-sm text-[var(--muted-foreground)]">No submitted photos found.</div>
          ) : (
            <div className="space-y-5">
              {photos.map((photo) => {
            const busy = Boolean(busyById[photo.id]);
            const debug = debugById[photo.id];
            const selectedDate = topDateById[photo.id] || todayDateInput();
            const isTopForSelectedDate = topPhotoByDate[selectedDate] === photo.id;

            return (
              <article key={photo.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 space-y-4">
                <div className="grid md:grid-cols-[220px_1fr] gap-4">
                  <div className="rounded-lg overflow-hidden bg-[var(--surface-2)] relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="Submitted photo" className="w-full h-auto object-contain" />

                    {debug?.debug && showOverlayById[photo.id] && (
                      <div className="absolute inset-0 pointer-events-none">
                        {debug.debug.pixels
                          .filter((pixel) => (strongOnlyById[photo.id] ? pixel.used : true))
                          .map((pixel, index) => {
                            const left = (pixel.x / debug.debug!.canvasWidth) * 100;
                            const top = (pixel.y / debug.debug!.canvasHeight) * 100;
                            return (
                              <div
                                key={`admin-px-${photo.id}-${index}`}
                                className="absolute rounded-full"
                                style={{
                                  left: `${left}%`,
                                  top: `${top}%`,
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

                        {debug.debug.regions
                          .filter((region) => {
                            const strong = region.saturation >= 20 && region.coloredPixels >= 12;
                            return strongOnlyById[photo.id] ? strong : true;
                          })
                          .map((region, index) => {
                            const left = (region.x / debug.debug!.canvasWidth) * 100;
                            const top = (region.y / debug.debug!.canvasHeight) * 100;
                            const width = (region.width / debug.debug!.canvasWidth) * 100;
                            const height = (region.height / debug.debug!.canvasHeight) * 100;
                            const strong = region.saturation >= 20 && region.coloredPixels >= 12;
                            const borderColor = region.building === 'king' ? '#a855f7' : '#f59e0b';

                            return (
                              <div
                                key={`admin-region-${photo.id}-${index}`}
                                className="absolute"
                                style={{
                                  left: `${left}%`,
                                  top: `${top}%`,
                                  width: `${width}%`,
                                  height: `${height}%`,
                                  border: `2px solid ${borderColor}`,
                                  backgroundColor: strong ? `${borderColor}22` : `${borderColor}10`,
                                }}
                              />
                            );
                          })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">{photo.id}</span>
                      <span>•</span>
                      <span>{formatTimestamp(photo.submitted_at)}</span>
                      <span>•</span>
                      <span>score {photo.vote_score}</span>
                      <span>•</span>
                      <span>{photo.is_valid ? 'valid' : 'invalid'}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-white/25" style={{ backgroundColor: photo.king_color || '#808080' }} />
                        King: {photo.king_color || 'n/a'}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-white/25" style={{ backgroundColor: photo.queen_color || '#808080' }} />
                        Queen: {photo.queen_color || 'n/a'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void handleRunDebug(photo)}
                        disabled={busy}
                        className="text-xs px-3 py-2 rounded-lg border border-purple-500/40 text-purple-300 hover:bg-purple-900/30 disabled:opacity-40"
                      >
                        {busy ? 'Working…' : 'Run Debug Analysis'}
                      </button>

                      {debug?.debug && (
                        <>
                          <button
                            onClick={() =>
                              setShowOverlayById((prev) => ({ ...prev, [photo.id]: !prev[photo.id] }))
                            }
                            className="text-xs px-3 py-2 rounded-lg border border-blue-500/40 text-blue-300 hover:bg-blue-900/30"
                          >
                            {showOverlayById[photo.id] ? 'Hide Debug Overlay' : 'Show Debug Overlay'}
                          </button>
                          {showOverlayById[photo.id] && (
                            <label className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] px-2">
                              <input
                                type="checkbox"
                                checked={Boolean(strongOnlyById[photo.id])}
                                onChange={(event) =>
                                  setStrongOnlyById((prev) => ({ ...prev, [photo.id]: event.target.checked }))
                                }
                              />
                              Strong only
                            </label>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={overrideById[photo.id]?.king ?? (photo.king_color || '#FFFFFF')}
                        onChange={(event) =>
                          setOverrideById((prev) => ({
                            ...prev,
                            [photo.id]: {
                              king: event.target.value,
                              queen: prev[photo.id]?.queen ?? (photo.queen_color || '#FFFFFF'),
                            },
                          }))
                        }
                        className="text-xs font-mono bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-md px-2 py-1.5 w-28"
                        placeholder="King #HEX"
                      />
                      <input
                        type="text"
                        value={overrideById[photo.id]?.queen ?? (photo.queen_color || '#FFFFFF')}
                        onChange={(event) =>
                          setOverrideById((prev) => ({
                            ...prev,
                            [photo.id]: {
                              king: prev[photo.id]?.king ?? (photo.king_color || '#FFFFFF'),
                              queen: event.target.value,
                            },
                          }))
                        }
                        className="text-xs font-mono bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-md px-2 py-1.5 w-28"
                        placeholder="Queen #HEX"
                      />
                      <button
                        onClick={() => void handleApplyOverride(photo)}
                        disabled={busy}
                        className="text-xs px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-900/30 disabled:opacity-40"
                      >
                        Apply Override
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(event) =>
                          setTopDateById((prev) => ({ ...prev, [photo.id]: event.target.value }))
                        }
                        className="text-xs bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-md px-2 py-1.5"
                      />

                      <button
                        onClick={() => void handleMarkTop(photo)}
                        disabled={busy}
                        className={`text-xs px-3 py-2 rounded-lg border disabled:opacity-40 ${
                          isTopForSelectedDate
                            ? 'border-orange-500/40 text-orange-300 hover:bg-orange-900/30'
                            : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/30'
                        }`}
                      >
                        {isTopForSelectedDate ? 'Unselect Top for Day' : 'Mark Top for Day'}
                      </button>

                      <button
                        onClick={() => void handleDelete(photo.id)}
                        disabled={busy}
                        className="text-xs px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-900/30 disabled:opacity-40"
                      >
                        Delete Photo
                      </button>
                    </div>
                  </div>
                </div>

                {debug && (
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 space-y-3">
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className={`px-2 py-1 rounded-full border ${debug.isValid ? 'text-green-300 border-green-700 bg-green-900/30' : 'text-red-300 border-red-700 bg-red-900/30'}`}>
                        {debug.isValid ? 'Detected' : 'Not Detected'}
                      </span>
                      <span className="text-[var(--muted-foreground)]">confidence {Math.round(debug.confidence * 100)}%</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full border border-white/25" style={{ backgroundColor: debug.kingColor }} />
                        King {debug.kingColor}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full border border-white/25" style={{ backgroundColor: debug.queenColor }} />
                        Queen {debug.queenColor}
                      </span>
                    </div>

                    {debug.diagnostics && (
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        {[debug.diagnostics.king, debug.diagnostics.queen].map((diag) => (
                          <div key={diag.building} className="rounded border border-[var(--border-subtle)] bg-[var(--surface-3)] p-2">
                            <div className="flex items-center justify-between">
                              <span className="uppercase tracking-wide text-[var(--muted-foreground)]">{diag.building}</span>
                              <span className={diag.passed ? 'text-green-300' : 'text-red-300'}>
                                {diag.passed ? 'pass' : 'fail'}
                              </span>
                            </div>
                            <p className="text-[var(--muted-foreground)] mt-1">
                              sat {Math.round(diag.saturation)} · px {diag.coloredPixels} · blobs {diag.selectedComponents}/{diag.candidateComponents}
                            </p>
                            {!diag.passed && <p className="text-[var(--muted-foreground)] mt-1">{diag.reason}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-[var(--muted-foreground)]">
                      Debug regions: {debug.debug?.regions.length ?? 0} · debug pixels: {debug.debug?.pixels.length ?? 0}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
        </>
      ) : activeTab === 'reasons' ? (
        <>
          <ManualReasonSection />

          {error && (
            <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-[var(--muted-foreground)]">Loading reasons…</div>
          ) : reasons.length === 0 ? (
            <div className="text-sm text-[var(--muted-foreground)]">No reasons found.</div>
          ) : (
            <div className="space-y-3">
              {reasons.map((reason) => {
                const busy = Boolean(busyById[reason.id]);
                const selectedDate = topReasonDateById[reason.id] || todayDateInput();
                const isTopForSelectedDate = topReasonByDate[selectedDate] === reason.reason_text;
                return (
                  <article 
                    key={reason.id} 
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm break-words">{reason.reason_text}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400">↑ {reason.upvotes}</span>
                        <span className="text-xs text-red-400">↓ {reason.downvotes}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)] mb-3">
                      <span className="font-mono text-[11px]">{reason.id}</span>
                      <span>•</span>
                      <span>{formatTimestamp(reason.submitted_at)}</span>
                      <span>•</span>
                      <span className={reason.is_valid ? 'text-green-400' : 'text-red-400'}>
                        {reason.is_valid ? 'valid' : 'invalid'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(event) =>
                          setTopReasonDateById((prev) => ({ ...prev, [reason.id]: event.target.value }))
                        }
                        className="text-xs bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-md px-2 py-1.5"
                      />

                      <button
                        onClick={() => void handleMarkTopReason(reason.id)}
                        disabled={busy}
                        className={`text-xs px-3 py-2 rounded-lg border disabled:opacity-40 ${
                          isTopForSelectedDate
                            ? 'border-orange-500/40 text-orange-300 hover:bg-orange-900/30'
                            : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/30'
                        }`}
                      >
                        {isTopForSelectedDate ? 'Unselect Top for Day' : 'Mark Top for Day'}
                      </button>

                      <button
                        onClick={() => void handleDeleteReason(reason.id)}
                        disabled={busy}
                        className="text-xs px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-900/30 disabled:opacity-40"
                      >
                        Delete Reason
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Date</label>
                <input
                  type="date"
                  value={statsDate}
                  onChange={(event) => setStatsDate(event.target.value)}
                  className="text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-md px-3 py-2"
                />
              </div>
              <button
                onClick={() => void loadStats()}
                className="text-sm px-3 py-2 rounded-lg border border-purple-500/40 text-purple-300 hover:bg-purple-900/30"
              >
                Load Date Stats
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-[var(--muted-foreground)]">Loading statistics…</p>
            ) : !stats ? (
              <p className="text-sm text-[var(--muted-foreground)]">No statistics available.</p>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Overall Site Statistics</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Total Photos</p><p className="text-xl font-bold">{stats.overall.totalPhotos}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Total Reasons</p><p className="text-xl font-bold">{stats.overall.totalReasons}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Dates w/ Photos</p><p className="text-xl font-bold">{stats.overall.totalDatesWithPhotos}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Dates w/ Reasons</p><p className="text-xl font-bold">{stats.overall.totalDatesWithReasons}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Photo Votes</p><p className="text-xl font-bold">{stats.overall.totalPhotoVotes}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Reason Votes</p><p className="text-xl font-bold">{stats.overall.totalReasonVotes}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Unique Submitters</p><p className="text-xl font-bold">{stats.overall.totalUniqueSubmitters}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Highest Photo Score</p><p className="text-xl font-bold">{stats.overall.highestPhotoScore}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Highest Reason Net</p><p className="text-xl font-bold">{stats.overall.highestReasonNetScore}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Avg Votes / Photo</p><p className="text-xl font-bold">{stats.overall.averagePhotoVotesPerPhoto}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Avg Votes / Reason</p><p className="text-xl font-bold">{stats.overall.averageReasonVotesPerReason}</p></div>
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Locked Days (P/R)</p><p className="text-xl font-bold">{stats.overall.totalPhotoLockedDates} / {stats.overall.totalReasonLockedDates}</p></div>
                  </div>
                </div>

                {stats.byDate && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Statistics for {stats.byDate.date}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Photos Submitted</p><p className="text-xl font-bold">{stats.byDate.photosSubmitted}</p></div>
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Reasons Submitted</p><p className="text-xl font-bold">{stats.byDate.reasonsSubmitted}</p></div>
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Photo Votes Cast</p><p className="text-xl font-bold">{stats.byDate.photoVotesCast}</p></div>
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Reason Votes Cast</p><p className="text-xl font-bold">{stats.byDate.reasonVotesCast}</p></div>
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Valid Photos</p><p className="text-xl font-bold">{stats.byDate.validPhotos}</p></div>
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Valid Reasons</p><p className="text-xl font-bold">{stats.byDate.validReasons}</p></div>
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Avg Photo Score</p><p className="text-xl font-bold">{stats.byDate.averagePhotoScore}</p></div>
                      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Avg Reason Net</p><p className="text-xl font-bold">{stats.byDate.averageReasonNetScore}</p></div>
                    </div>
                    <div className="mt-3 text-xs text-[var(--muted-foreground)]">
                      Top locks: Photo {stats.byDate.photoTopLocked ? '✅' : '—'} · Reason {stats.byDate.reasonTopLocked ? '✅' : '—'}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
        </>
      )}
      </main>
    </div>
  );
}
