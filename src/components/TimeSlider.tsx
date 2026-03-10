'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ColorHistory } from '@/types';
import { useTheme } from './ThemeProvider';

interface TimeSliderProps {
  onColorsChange: (kingColor: string, queenColor: string) => void;
  onDateChange?: (date: string) => void;
  currentKingColor: string;
  currentQueenColor: string;
}

const DEFAULT_KING = '#FFFFFF';
const DEFAULT_QUEEN = '#FFFFFF';

const toEasternDateKey = (timestamp: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));

const isNearWhite = (color: string) => {
  const hex = color.trim().replace('#', '');
  const normalized =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex.slice(0, 6);

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return false;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return r >= 230 && g >= 230 && b >= 230;
};

export default function TimeSlider({
  onColorsChange,
  onDateChange,
  currentKingColor,
  currentQueenColor,
}: TimeSliderProps) {
  const { theme } = useTheme();
  const [history, setHistory] = useState<ColorHistory[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const kingCircleBorderColor =
    theme === 'light' && isNearWhite(currentKingColor)
      ? 'rgba(15,23,42,0.88)'
      : 'rgba(255,255,255,0.20)';
  const queenCircleBorderColor =
    theme === 'light' && isNearWhite(currentQueenColor)
      ? 'rgba(15,23,42,0.88)'
      : 'rgba(255,255,255,0.20)';

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data: colorHistoryData } = await supabase
        .from('color_history')
        .select('*')
        .order('date', { ascending: false })
        .limit(90);

      const { data: photosData } = await supabase
        .from('photos')
        .select('id, king_color, queen_color, submitted_at, vote_score')
        .eq('is_valid', true)
        .not('king_color', 'is', null)
        .not('queen_color', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(500);

      if (cancelled) return;

      const byDate = new Map<string, ColorHistory>();

      if (colorHistoryData && colorHistoryData.length > 0) {
        (colorHistoryData as ColorHistory[]).forEach((entry) => {
          if (!byDate.has(entry.date)) {
            byDate.set(entry.date, entry);
          }
        });
      }

      if (photosData && photosData.length > 0) {
        type PhotoRow = {
          id: string;
          king_color: string | null;
          queen_color: string | null;
          submitted_at: string;
          vote_score: number;
        };

        const bestPhotoByDate = new Map<string, PhotoRow>();

        (photosData as PhotoRow[]).forEach((photo) => {
          const date = toEasternDateKey(photo.submitted_at);
          const existing = bestPhotoByDate.get(date);

          if (!existing) {
            bestPhotoByDate.set(date, photo);
            return;
          }

          if (
            photo.vote_score > existing.vote_score ||
            (photo.vote_score === existing.vote_score && photo.submitted_at > existing.submitted_at)
          ) {
            bestPhotoByDate.set(date, photo);
          }
        });

        bestPhotoByDate.forEach((photo, date) => {
          const existing = byDate.get(date);

          if (!existing) {
            byDate.set(date, {
              id: `photo-${photo.id}`,
              date,
              king_color: photo.king_color,
              queen_color: photo.queen_color,
              reason: null,
              photo_id: photo.id,
              updated_at: photo.submitted_at,
            });
            return;
          }

          if (existing.photo_locked) {
            if (!existing.king_color || !existing.queen_color) {
              byDate.set(date, {
                ...existing,
                king_color: existing.king_color || photo.king_color,
                queen_color: existing.queen_color || photo.queen_color,
                photo_id: existing.photo_id || photo.id,
              });
            }
            return;
          }

          byDate.set(date, {
            ...existing,
            king_color: photo.king_color,
            queen_color: photo.queen_color,
            photo_id: photo.id,
          });
        });
      }

      const dailyHistory = Array.from(byDate.values()).sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : 0
      );

      if (dailyHistory.length > 0) {
        setHistory(dailyHistory);
        setSelectedIndex(dailyHistory.length - 1);
        const latest = dailyHistory[dailyHistory.length - 1];
        onColorsChange(latest.king_color || DEFAULT_KING, latest.queen_color || DEFAULT_QUEEN);
        if (onDateChange) {
          onDateChange(latest.date);
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [onColorsChange, onDateChange]);

  const updateSelectedIndex = (idx: number) => {
    if (history.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(idx, history.length - 1));
    setSelectedIndex(clampedIndex);
    const entry = history[clampedIndex];
    if (entry) {
      onColorsChange(entry.king_color || DEFAULT_KING, entry.queen_color || DEFAULT_QUEEN);
      if (onDateChange) {
        onDateChange(entry.date);
      }
    }
  };

  const setToPresent = () => {
    updateSelectedIndex(history.length - 1);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSelectedIndex(Number(e.target.value));
  };

  const handleSliderInput = (e: React.FormEvent<HTMLInputElement>) => {
    updateSelectedIndex(Number(e.currentTarget.value));
  };

  const selectedEntry = history[selectedIndex];
  const canSlide = history.length > 1;

  const formatDate = (dateStr: string) => {
    // Use noon UTC to avoid timezone boundary issues with date-only strings
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-6">
        <span className="text-gray-600 text-sm animate-pulse">Loading history…</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-600 text-sm">No color history yet. Submit photos to build history!</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Current selected date display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={setToPresent}
            className="text-xs text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
            title="Jump to present day"
          >
            {selectedIndex === history.length - 1 ? 'Current' : formatDate(selectedEntry?.date || '')}
          </button>
          {selectedIndex < history.length - 1 && (
            <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full">
              Historical
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full border"
              style={{
                backgroundColor: currentKingColor,
                borderColor: kingCircleBorderColor,
              }}
            />
            <span className="text-xs text-gray-400">King</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full border"
              style={{
                backgroundColor: currentQueenColor,
                borderColor: queenCircleBorderColor,
              }}
            />
            <span className="text-xs text-gray-400">Queen</span>
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={history.length - 1}
          step={1}
          value={selectedIndex}
          onInput={handleSliderInput}
          onChange={handleSliderChange}
          disabled={!canSlide}
          className={`w-full accent-purple-500 ${canSlide ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          aria-label="Time travel slider"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>Past</span>
          <button
            type="button"
            onClick={setToPresent}
            className="hover:text-gray-400 transition-colors"
          >
            Present →
          </button>
        </div>
        {!canSlide && (
          <p className="text-xs text-gray-500 mt-2">Add photos on another day to unlock time travel.</p>
        )}
      </div>

      {/* Color swatch row for history (mini timeline) */}
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {history.slice(0, 30).map((entry, i) => {
          const king = entry.king_color || '#444';
          const queen = entry.queen_color || '#444';
          const isSelected = i === selectedIndex;
          const isLightSwatch = isNearWhite(king) || isNearWhite(queen);
          const useDarkOutline = theme === 'light' && isLightSwatch;

          return (
            <button
              key={entry.id}
              onClick={() => updateSelectedIndex(i)}
              title={formatDate(entry.date)}
              className={`relative flex-shrink-0 w-6 h-6 rounded-sm border transition-transform hover:scale-110 ${
                isSelected ? 'scale-110' : ''
              }`}
              style={{
                background: `linear-gradient(135deg, ${king} 50%, ${queen} 50%)`,
                borderColor: 'transparent',
                boxShadow: isSelected
                  ? (useDarkOutline
                    ? 'inset 0 0 0 1px rgba(15,23,42,0.95), 0 0 0 1.25px rgba(15,23,42,0.95)'
                    : 'inset 0 0 0 1px rgba(255,255,255,0.95), 0 0 0 1.25px rgba(255,255,255,0.95)')
                  : (useDarkOutline
                    ? 'inset 0 0 0 1px rgba(15,23,42,0.72)'
                    : 'inset 0 0 0 1px rgba(255,255,255,0.12)'),
                zIndex: isSelected ? 2 : 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
