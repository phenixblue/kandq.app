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

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [topDateById, setTopDateById] = useState<Record<string, string>>({});
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

  const loadPhotos = useCallback(async () => {
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
      setTopDateById((prev) => {
        const next = { ...prev };
        for (const photo of list) {
          if (!next[photo.id]) {
            next[photo.id] = todayDateInput();
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
  }, [authedFetch]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

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
      const response = await authedFetch(`/api/admin/photos/${photo.id}/top-of-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: topDateById[photo.id] || todayDateInput() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to mark photo as top of day.');
      }

      alert(`Marked photo as top-ranked for ${payload.date}.`);
    } catch (markError: unknown) {
      setError(markError instanceof Error ? markError.message : 'Failed to mark top of day.');
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

  const photoCountLabel = useMemo(() => {
    if (loading) return 'Loading…';
    return `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
  }, [loading, photos.length]);

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
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Moderate submissions and inspect image analysis.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted-foreground)]">{photoCountLabel}</span>
          <button
            onClick={() => void loadPhotos()}
            className="text-sm px-3 py-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-3)] transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

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
                        value={topDateById[photo.id] || todayDateInput()}
                        onChange={(event) =>
                          setTopDateById((prev) => ({ ...prev, [photo.id]: event.target.value }))
                        }
                        className="text-xs bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-md px-2 py-1.5"
                      />

                      <button
                        onClick={() => void handleMarkTop(photo)}
                        disabled={busy}
                        className="text-xs px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-40"
                      >
                        Mark Top for Day
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
      </main>
    </div>
  );
}
