'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ColorHistory } from '@/types';

interface TimeSliderProps {
  onColorsChange: (kingColor: string, queenColor: string) => void;
  currentKingColor: string;
  currentQueenColor: string;
}

const DEFAULT_KING = '#FFFFFF';
const DEFAULT_QUEEN = '#FFFFFF';

export default function TimeSlider({
  onColorsChange,
  currentKingColor,
  currentQueenColor,
}: TimeSliderProps) {
  const [history, setHistory] = useState<ColorHistory[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from('color_history')
        .select('*')
        .order('date', { ascending: false })
        .limit(90);

      if (cancelled) return;

      if (data && data.length > 0) {
        setHistory(data as ColorHistory[]);
        setSelectedIndex(0);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = Number(e.target.value);
    setSelectedIndex(idx);
    const entry = history[idx];
    if (entry) {
      onColorsChange(entry.king_color || DEFAULT_KING, entry.queen_color || DEFAULT_QUEEN);
    }
  };

  const selectedEntry = history[selectedIndex];

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
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            {selectedIndex === 0 ? 'Current' : formatDate(selectedEntry?.date || '')}
          </span>
          {selectedIndex > 0 && (
            <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full">
              Historical
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full border border-white/20"
              style={{ backgroundColor: selectedEntry?.king_color || currentKingColor }}
            />
            <span className="text-xs text-gray-400">King</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full border border-white/20"
              style={{ backgroundColor: selectedEntry?.queen_color || currentQueenColor }}
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
          value={selectedIndex}
          onChange={handleSliderChange}
          className="w-full accent-purple-500 cursor-pointer"
          aria-label="Time travel slider"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>Present</span>
          <span>← Past</span>
        </div>
      </div>

      {/* Color swatch row for history (mini timeline) */}
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {history.slice(0, 30).map((entry, i) => (
          <button
            key={entry.id}
            onClick={() => {
              setSelectedIndex(i);
              onColorsChange(
                entry.king_color || DEFAULT_KING,
                entry.queen_color || DEFAULT_QUEEN
              );
            }}
            title={formatDate(entry.date)}
            className={`flex-shrink-0 w-6 h-6 rounded-sm border transition-transform hover:scale-110 ${
              i === selectedIndex ? 'border-white scale-110' : 'border-transparent'
            }`}
            style={{
              background: `linear-gradient(135deg, ${entry.king_color || '#444'} 50%, ${entry.queen_color || '#444'} 50%)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
