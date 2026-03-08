'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import BuildingDisplay from '@/components/BuildingDisplay';
import AuthModal from '@/components/AuthModal';
import PhotoUpload from '@/components/PhotoUpload';
import PhotoGallery from '@/components/PhotoGallery';
import TimeSlider from '@/components/TimeSlider';

const DEFAULT_KING_COLOR = '#7C3AED';
const DEFAULT_QUEEN_COLOR = '#D97706';

// Pre-computed star positions (module-level, not computed during render)
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  width: ((i * 13 + 7) % 19) / 9 + 1,
  height: ((i * 11 + 3) % 17) / 8 + 1,
  top: ((i * 37 + 11) % 70),
  left: ((i * 61 + 23) % 100),
  opacity: ((i * 7 + 1) % 6) / 10 + 0.2,
}));

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [kingColor, setKingColor] = useState(DEFAULT_KING_COLOR);
  const [queenColor, setQueenColor] = useState(DEFAULT_QUEEN_COLOR);
  const [showAuth, setShowAuth] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);
  const configured = isSupabaseConfigured();

  // Listen for auth changes
  useEffect(() => {
    if (!configured) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleColorsUpdate = useCallback((king: string, queen: string) => {
    setKingColor(king);
    setQueenColor(queen);
  }, []);

  const handleUploadSuccess = () => {
    setGalleryRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#07080f]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div
                className="w-3 h-3 rounded-full animate-pulse border border-white/30"
                style={{ backgroundColor: kingColor, boxShadow: `0 0 8px ${kingColor}` }}
                aria-label={`King building light color: ${kingColor}`}
              />
              <div
                className="w-3 h-3 rounded-full animate-pulse border border-white/30"
                style={{ backgroundColor: queenColor, boxShadow: `0 0 8px ${queenColor}`, animationDelay: '0.5s' }}
                aria-label={`Queen building light color: ${queenColor}`}
              />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">KANDQ</span>
            <span className="hidden sm:inline text-gray-500 text-sm">King &amp; Queen</span>
          </div>

          <nav className="flex items-center gap-4">
            <a
              href="https://www.concourse-atl.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block"
            >
              About the Buildings
            </a>

            {!configured && (
              <span className="text-xs text-amber-400 bg-amber-900/20 px-2 py-1 rounded-full border border-amber-700/40">
                Demo Mode
              </span>
            )}

            {configured && (
              <>
                {user ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowUpload(true)}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      + Submit Photo
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="text-gray-400 hover:text-white text-sm transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAuth(true)}
                    className="bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors border border-white/10"
                  >
                    Sign In
                  </button>
                )}
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero / Building Display ─────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center pt-16 pb-8 px-4 overflow-hidden">
        {/* Starfield background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {STARS.map((star) => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white"
              style={{
                width: `${star.width}px`,
                height: `${star.height}px`,
                top: `${star.top}%`,
                left: `${star.left}%`,
                opacity: star.opacity,
              }}
            />
          ))}
        </div>

        {/* Title */}
        <h1 className="text-center mb-2 text-gray-400 text-sm tracking-[0.3em] uppercase font-medium">
          Concourse Corporate Center · Sandy Springs, GA
        </h1>
        <p className="text-center text-white/30 text-xs mb-10 max-w-sm">
          Showing colors from the highest-rated photo submission
        </p>

        {/* Buildings */}
        <BuildingDisplay kingColor={kingColor} queenColor={queenColor} />

        {/* City skyline silhouette */}
        <div className="w-full mt-4 overflow-hidden" aria-hidden="true">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="w-full h-20 opacity-20"
            fill="#1e293b"
          >
            {/* Generic city skyline silhouette */}
            <path d="M0,120 L0,80 L30,80 L30,60 L50,60 L50,40 L70,40 L70,30 L90,30 L90,50 L110,50 L110,60 L140,60 L140,20 L160,20 L160,10 L180,10 L180,20 L200,20 L200,60 L230,60 L230,50 L250,50 L250,35 L270,35 L270,50 L290,50 L290,70 L320,70 L320,45 L340,45 L340,30 L360,30 L360,45 L380,45 L380,70 L410,70 L410,55 L430,55 L430,40 L450,40 L450,55 L470,55 L470,75 L500,75 L500,50 L520,50 L520,30 L540,30 L540,15 L560,15 L560,30 L580,30 L580,50 L610,50 L610,65 L640,65 L640,45 L660,45 L660,65 L690,65 L690,80 L720,80 L720,55 L740,55 L740,40 L760,40 L760,55 L780,55 L780,75 L810,75 L810,55 L830,55 L830,35 L850,35 L850,55 L870,55 L870,70 L900,70 L900,50 L920,50 L920,35 L940,35 L940,50 L960,50 L960,65 L990,65 L990,80 L1020,80 L1020,60 L1040,60 L1040,40 L1060,40 L1060,60 L1080,60 L1080,75 L1110,75 L1110,55 L1130,55 L1130,70 L1160,70 L1160,80 L1200,80 L1200,120 Z" />
          </svg>
        </div>
      </section>

      {/* ── Time Slider ────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 border-t border-white/5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span>🕰</span> Time Travel
        </h2>
        {configured ? (
          <TimeSlider
            onColorsChange={handleColorsUpdate}
            currentKingColor={kingColor}
            currentQueenColor={queenColor}
          />
        ) : (
          <div className="text-center py-6 text-gray-600 text-sm">
            Connect Supabase to enable historical color tracking.
          </div>
        )}
      </section>

      {/* ── Photo Gallery ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 border-t border-white/5 flex-1">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span>📸</span> Community Submissions
          </h2>
          {configured && !user && (
            <button
              onClick={() => setShowAuth(true)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Sign in to vote &amp; submit
            </button>
          )}
          {configured && user && (
            <button
              onClick={() => setShowUpload(true)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              + Add your photo
            </button>
          )}
        </div>

        {configured ? (
          <PhotoGallery
            userId={user?.id ?? null}
            refreshKey={galleryRefreshKey}
            onColorsUpdate={handleColorsUpdate}
          />
        ) : (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🌃</p>
            <h3 className="text-xl font-bold text-white mb-2">Welcome to KANDQ</h3>
            <p className="text-gray-400 max-w-md mx-auto text-sm leading-relaxed">
              Connect your Supabase project to enable photo submissions, voting, and historical
              color tracking for Atlanta&apos;s King &amp; Queen buildings.
            </p>
            <div className="mt-6 bg-gray-900 border border-gray-700 rounded-xl p-4 text-left max-w-sm mx-auto">
              <p className="text-xs text-gray-500 font-mono mb-1">1. Copy the env example:</p>
              <code className="text-xs text-green-400 font-mono">cp .env.local.example .env.local</code>
              <p className="text-xs text-gray-500 font-mono mt-3 mb-1">2. Add your Supabase credentials</p>
              <p className="text-xs text-gray-500 font-mono mt-3 mb-1">3. Run the migration in Supabase SQL editor:</p>
              <code className="text-xs text-green-400 font-mono">supabase/migrations/001_initial.sql</code>
            </div>
          </div>
        )}
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-6 text-center text-gray-600 text-xs">
        <p>
          KANDQ ·{' '}
          <a
            href="https://www.concourse-atl.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Concourse Corporate Center
          </a>{' '}
          · Sandy Springs, GA
        </p>
      </footer>

      {/* ── Modals ──────────────────────────────────────────── */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
        />
      )}

      {showUpload && user && (
        <PhotoUpload
          userId={user.id}
          onSuccess={handleUploadSuccess}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
