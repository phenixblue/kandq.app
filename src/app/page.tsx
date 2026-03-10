'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import BuildingDisplay from '@/components/BuildingDisplay';
import AuthModal from '@/components/AuthModal';
import PhotoUpload from '@/components/PhotoUpload';
import PhotoGallery from '@/components/PhotoGallery';
import TimeSlider from '@/components/TimeSlider';
import ThemeToggle from '@/components/ThemeToggle';
import ReasonsGallery from '@/components/ReasonsGallery';

const DEFAULT_KING_COLOR = '#38bdf8';
const DEFAULT_QUEEN_COLOR = '#a78bfa';

// Pre-computed star positions (module-level, not computed during render)
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  width: ((i * 13 + 7) % 19) / 9 + 1,
  height: ((i * 11 + 3) % 17) / 8 + 1,
  top: ((i * 37 + 11) % 70),
  left: ((i * 61 + 23) % 100),
  opacity: ((i * 7 + 1) % 6) / 10 + 0.2,
}));

const TREES = Array.from({ length: 10 }, (_, i) => {
  const left = ((i * 23 + 11) % 88) + 4;
  const trunkHeight = ((i * 7 + 5) % 8) + 12;
  const canopySize = ((i * 11 + 3) % 10) + 16;
  const bottom = 14.9 + (((i * 5 + 2) % 3) - 1) * 0.2;

  return {
    id: i,
    left,
    bottom,
    trunkHeight,
    canopySize,
  };
});

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [kingColor, setKingColor] = useState(DEFAULT_KING_COLOR);
  const [queenColor, setQueenColor] = useState(DEFAULT_QUEEN_COLOR);
  const [showAuth, setShowAuth] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const configured = isSupabaseConfigured();

  // Listen for auth changes
  useEffect(() => {
    if (!configured) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      // Check admin status by trying to fetch admin data
      if (data.session?.access_token) {
        fetch('/api/admin/photos', {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
          .then((res) => setIsAdmin(res.status !== 403))
          .catch(() => setIsAdmin(false));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Check admin status when auth state changes
      if (session?.access_token) {
        fetch('/api/admin/photos', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then((res) => setIsAdmin(res.status !== 403))
          .catch(() => setIsAdmin(false));
      } else {
        setIsAdmin(false);
      }
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
            <span className="font-bold text-xl tracking-tight text-white dark:text-white">KANDQ</span>
            <span className="hidden sm:inline text-white dark:text-gray-400 text-sm">King &amp; Queen</span>
          </div>

          <nav className="flex items-center gap-4">
            <a
              href="https://www.concourse-atl.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-400 hover:text-black dark:hover:text-white text-sm transition-colors hidden sm:block"
            >
              About the Buildings
            </a>

            <ThemeToggle />

            {!configured && (
              <span className="text-xs text-amber-400 bg-amber-900/20 px-2 py-1 rounded-full border border-amber-700/40">
                Demo Mode
              </span>
            )}

            {configured && (
              <>
                {user ? (
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <a
                        href="/admin"
                        className="text-gray-700 dark:text-gray-400 hover:text-black dark:hover:text-white text-sm transition-colors"
                      >
                        Admin
                      </a>
                    )}
                    <button
                      onClick={() => setShowUpload(true)}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      + Submit Photo
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="text-gray-700 dark:text-gray-400 hover:text-black dark:hover:text-white text-sm transition-colors"
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
      <section className="relative flex flex-col items-center justify-center min-h-[620px] md:min-h-[720px] pt-12 pb-0 px-4 overflow-hidden">
        {/* Starfield background - hidden in light mode */}
        <div className="absolute inset-x-0 top-0 h-[72%] overflow-hidden pointer-events-none" aria-hidden="true">
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
        <h1 className="relative z-10 text-center mb-2 text-lg tracking-[0.3em] uppercase font-medium text-[color:var(--foreground)]">
          The King and Queen · Sandy Springs, GA
        </h1>
        <p className="relative z-10 text-center text-base mb-16 md:mb-20 max-w-sm text-[color:var(--muted-foreground)]">
          What color are the lights tonight? Explore the history, submit your photos, and see how the colors have changed over time.
        </p>

        {/* Buildings + contextual backdrop */}
        <div className="relative z-10 mb-2 md:mb-4 w-full max-w-5xl flex justify-center">
          {/* Ground + greenery + skyline behind building base */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {/* Single soft skyline layer with varied heights */}
            <div className="absolute inset-x-10 md:inset-x-16 bottom-[20%] h-20 md:h-24 text-sky-300/40 dark:text-slate-700/45">
              <svg viewBox="0 0 1000 180" className="h-full w-full fill-current" preserveAspectRatio="none">
                <path d="M0 180V132h74V104h52v28h84V88h44v44h70V72h58v60h62V58h42v74h86V94h50v38h72V64h44v68h78V100h48v32h66V82h52v50h68V108h44v24h60v48H0z" />
              </svg>
            </div>

            {/* Single greenery band */}
            <div className="absolute inset-x-8 md:inset-x-16 bottom-[15.4%] h-5 md:h-6 rounded-full bg-emerald-500/45 dark:bg-emerald-700/45" />

            {/* Visible tree silhouettes (more randomized placements) */}
            {TREES.map((tree) => (
              <div
                key={tree.id}
                className="absolute h-10 w-8 md:h-12 md:w-10"
                style={{ left: `${tree.left}%`, bottom: `${tree.bottom}%` }}
              >
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[2px] md:w-[3px] bg-emerald-900/70 dark:bg-emerald-950/75"
                  style={{ height: `${tree.trunkHeight + 1}px` }}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-full bg-emerald-600/80 dark:bg-emerald-500/75"
                  style={{
                    width: `${tree.canopySize}px`,
                    height: `${tree.canopySize}px`,
                    bottom: `${tree.trunkHeight}px`,
                  }}
                />
              </div>
            ))}

            {/* Ground aligned to building silhouette base line */}
            <div className="absolute inset-x-8 md:inset-x-16 bottom-[14.3%] h-[6px] md:h-2 rounded-full bg-emerald-700/45 dark:bg-slate-500/45" />
          </div>

          <div className="relative z-10">
            <BuildingDisplay kingColor={kingColor} queenColor={queenColor} />
          </div>
        </div>

      </section>

      {/* ── Time Slider ────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 border-t border-white/5">
        <h2 className="text-sm font-bold text-[color:var(--foreground)] uppercase tracking-widest mb-4 flex items-center gap-2">
          <span>🕰</span> Time Travel
        </h2>
        {configured ? (
          <TimeSlider
            onColorsChange={handleColorsUpdate}
            onDateChange={setSelectedDate}
            currentKingColor={kingColor}
            currentQueenColor={queenColor}
          />
        ) : (
          <div className="text-center py-6 text-gray-600 text-sm">
            Connect Supabase to enable historical color tracking.
          </div>
        )}
      </section>

      {/* ── Photo Gallery & Reasons ─────────────────────────── */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 border-t border-white/5 flex-1">
        <div className="mb-6">
          <div className="flex items-center justify-end mb-6">
            {configured && !user && (
              <button
                onClick={() => setShowAuth(true)}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Sign in to vote &amp; submit
              </button>
            )}
          </div>
        </div>

        {configured ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Photo Gallery - Takes 2/3 of width on lg screens */}
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center gap-5">
                <h2 className="text-sm font-bold text-[color:var(--foreground)] uppercase tracking-widest flex items-center gap-2">
                  <span>📸</span> Daily Submissions
                </h2>
                {user && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    + Add photo
                  </button>
                )}
              </div>
              <PhotoGallery
                userId={user?.id ?? null}
                refreshKey={galleryRefreshKey}
                onColorsUpdate={handleColorsUpdate}
                filterDate={selectedDate}
              />
            </div>

            {/* Reasons - Takes 1/3 of width on lg screens */}
            <div className="lg:col-span-1">
              <div className="mb-3 flex items-center gap-5">
                <h2 className="text-sm font-bold text-[color:var(--foreground)] uppercase tracking-widest flex items-center gap-2">
                  <span>💬</span> Reasons
                </h2>
                {user && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    + Add reason
                  </button>
                )}
              </div>
              <ReasonsGallery
                userId={user?.id ?? null}
                refreshKey={galleryRefreshKey}
                filterDate={selectedDate}
              />
            </div>
          </div>
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
            href=""
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            The Webroot, LLC.
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
