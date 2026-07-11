'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { TreehouseWorldHandle, GameData } from '@/components/treehouse-world';

// Dynamic import — Three.js is browser-only
const TreehouseWorld = dynamic(() => import('@/components/treehouse-world'), { ssr: false });

const COVER_MAP: Record<string, string> = {
  'Elden Ring':      '/images/games/elden-ring.jpg',
  'Hollow Knight':   '/images/games/hollow-knight.jpg',
  'Celeste':         '/images/games/celeste.jpg',
  'Hades':           '/images/games/hades.jpg',
  'Disco Elysium':   '/images/games/disco-elysium.jpg',
  'Undertale':       '/images/games/undertale.jpg',
  'Into the Breach': '/images/games/into-the-breach.jpg',
  'Stardew Valley':  '/images/games/stardew.jpg',
  'Cuphead':         '/images/games/cuphead.jpg',
};

const GENRE_ICON: Record<string, string> = {
  rpg: '⚔️', adventure: '🗺️', platformer: '🎮',
  action: '🔥', horror: '💀', rhythm: '🎵', sim: '🌱',
};
const GENRE_COLOR: Record<string, string> = {
  rpg: '#6B2FA0', adventure: '#2E7D32', platformer: '#1565C0',
  action: '#BF6000', horror: '#6A0808', rhythm: '#880E4F', sim: '#2E7D32',
};
const RATINGS: Record<string, string> = {
  rpg: '★★★★★', adventure: '★★★★☆', platformer: '★★★★★',
  action: '★★★★☆', horror: '★★★☆☆', rhythm: '★★★★☆', sim: '★★★★★',
};
const REACTIONS: Record<string, string> = {
  rpg: 'Legendary! ⚔️', adventure: 'Explored! 🗺️', platformer: 'Mastered! 🎮',
  action: 'Blazed! 🔥', horror: 'Survived! 💀', rhythm: 'In tune! 🎵', sim: 'Thriving! 🌱',
};
const GENRE_COVER_GRADIENT: Record<string, string> = {
  rpg: 'linear-gradient(135deg,#3D1A8E,#8B2FC9)',
  adventure: 'linear-gradient(135deg,#0D3B2E,#1A8C5A)',
  platformer: 'linear-gradient(135deg,#1565C0,#42A5F5)',
  action: 'linear-gradient(135deg,#7B1F00,#D4460A)',
  horror: 'linear-gradient(135deg,#1A0A0A,#5C1A1A)',
  rhythm: 'linear-gradient(135deg,#4A0030,#B01060)',
  sim: 'linear-gradient(135deg,#1B4020,#4CAF50)',
};

// ── sub-components ────────────────────────────────────────────────────────────
function Header({ count }: { count: number }) {
  return (
    <div style={{ height: 52, backgroundColor: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 20, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/" aria-label="Back to home" style={{ color: 'var(--foreground)', fontSize: 20, lineHeight: 1, textDecoration: 'none' }}>←</Link>
        <span style={{ fontWeight: 700, fontSize: 19, color: 'var(--foreground)', letterSpacing: -0.3 }}>🌳 your treehouse</span>
      </div>
      <div style={{ background: 'rgba(255,215,0,0.18)', border: '1.5px solid #FFD700', borderRadius: 20, paddingInline: 12, paddingBlock: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: '#FFD700', fontSize: 12, fontWeight: 700 }}>🏆 {count} Complete</span>
      </div>
    </div>
  );
}

const TICKER_MOODS = [
  'is chilling \u{1F4A4}',
  'found a cozy spot \u{1F33F}',
  'is reading by the fire \u{1F525}',
  'is humming a tune \u{1F3B5}',
  'waved at you \u{1F44B}',
];

// ── main client component ──────────────────────────────────────────────────────
export default function TreehouseClient({ games }: { games: GameData[] }) {
  const worldRef = useRef<TreehouseWorldHandle>(null);
  const [focusMode, setFocusMode]   = useState(false);
  const [focusIdx, setFocusIdx]     = useState(0);
  const [view, setView]             = useState<'world' | 'list'>('world');
  const [listExpanded, setListExp]  = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const handleAvatarSelect = useCallback((idx: number) => {
    setFocusIdx(idx);
    setFocusMode(true);
    setView('world');
  }, []);

  const handleExitFocus = useCallback(() => {
    worldRef.current?.exitFocus();
    setFocusMode(false);
  }, []);

  const handleStep = useCallback((dir: -1 | 1) => {
    if (games.length === 0) return; // nothing to step through -- avoid %0 (NaN)
    const next = ((focusIdx + dir) % games.length + games.length) % games.length;
    setFocusIdx(next);
    worldRef.current?.focusStep(dir);
  }, [focusIdx, games.length]);

  const openList = () => { setView('list'); setFocusMode(false); };
  const closeList = () => { setView('world'); setListExp(false); setSearchOpen(false); setListSearch(''); };

  const filteredGames = games.filter(g =>
    !listSearch || g.title.toLowerCase().includes(listSearch.toLowerCase())
  );
  const game = games[focusIdx];

  // ── layout ──────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', paddingBottom: 16 }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        button{border:none;cursor:pointer;background:none}
      `}</style>

      <Header count={games.length} />

      {/* ── 3D world canvas ── */}
      <div style={{ position: 'relative', width: '100%', flex: '1 0 380px', minHeight: 380, overflow: 'hidden' }}>
        <TreehouseWorld ref={worldRef} games={games} onAvatarSelect={handleAvatarSelect} />

        {/* ── empty state — no completed games yet, or the data layer hit an
             error upstream (lib/treehouse.ts swallows fetch/auth/query errors
             into an empty array by design). Previously this silently rendered
             an interaction-dead scene with no explanation; NaN comes from
             dividing by a 0-length games array in handleStep/buildScene. ── */}
        {games.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32,
            textAlign: 'center', color: 'var(--foreground)', pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 40 }}>🌱</span>
            <span style={{ fontWeight: 700, fontSize: 17 }}>
              Your treehouse is waiting
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)', maxWidth: 240, lineHeight: 1.5 }}>
              Finish a game and it'll show up here as a cartridge buddy in the world.
            </span>
          </div>
        )}

        {/* dim overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: focusMode ? 'rgba(15,8,0,0.52)' : view === 'list' ? 'rgba(15,8,0,0.28)' : 'transparent',
          transition: 'background 0.4s ease',
        }} />

        {/* ── focus card ── */}
        <AnimatePresence>
          {focusMode && (
            <motion.div
              key="focus-card"
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              style={{
                position: 'absolute', top: '50%', right: 14,
                transform: 'translateY(-50%)',
                width: 270, background: 'var(--secondary)',
                border: '1.5px solid #8D6E63', borderRadius: 20,
                padding: '18px 16px 14px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
                zIndex: 10,
              }}
            >
              {/* genre badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: `${GENRE_COLOR[game?.genre] || '#8D6E63'}22`,
                border: `1px solid ${GENRE_COLOR[game?.genre] || '#8D6E63'}aa`,
                color: GENRE_COLOR[game?.genre] || '#3D2B1F',
                borderRadius: 20, padding: '3px 10px', marginBottom: 10,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {GENRE_ICON[game?.genre] || '🎮'} {game?.genre?.toUpperCase()}
              </div>
              {/* title */}
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--foreground)', lineHeight: 1.15, marginBottom: 12 }}>
                {game?.title}
              </div>
              {/* rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Genre</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{game?.genre?.charAt(0).toUpperCase()}{game?.genre?.slice(1)}</span>
                </div>
                <div style={{ height: 1, background: 'rgba(141,110,99,0.2)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rating</span>
                  <span style={{ color: '#FFD700', fontSize: 13, letterSpacing: 1 }}>{RATINGS[game?.genre] || '★★★★☆'}</span>
                </div>
                {(game?.totalMinutes && game.totalMinutes > 0) ? (
                  <>
                    <div style={{ height: 1, background: 'rgba(141,110,99,0.2)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Time Played</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
                        {game.totalMinutes >= 60
                          ? `${(game.totalMinutes / 60).toFixed(1)} hrs`
                          : `${game.totalMinutes} min`}
                      </span>
                    </div>
                  </>
                ) : null}
                <div style={{ height: 1, background: 'rgba(141,110,99,0.2)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vibe</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{REACTIONS[game?.genre] || 'GG! 🏆'}</span>
                </div>
              </div>
              {/* completed pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#3BA55D' }}>
                ✓ Completed{game?.completedAt ? ` · ${new Date(game.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── back button ── */}
        <AnimatePresence>
          {focusMode && (
            <motion.button
              key="focus-back"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={handleExitFocus}
              style={{
                position: 'absolute', top: 14, left: 14,
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--secondary)', border: '1px solid var(--border)',
                borderRadius: 24, padding: '7px 14px 7px 10px',
                color: 'var(--foreground)', fontSize: 13, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)', zIndex: 10,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF8E7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              World
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── focus nav ‹ N/9 › ── */}
        <AnimatePresence>
          {focusMode && (
            <motion.div
              key="focus-nav"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}
            >
              {[[-1, '‹'], [1, '›']].map(([dir, label], i) => (
                i === 0
                  ? <button key="prev" onClick={() => handleStep(-1)} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--secondary)', border: '1.5px solid rgba(255,215,0,0.45)', color: '#FFD700', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>‹</button>
                  : null
              ))}
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted-foreground)', minWidth: 36, textAlign: 'center' }}>
                {focusIdx + 1} / {games.length}
              </span>
              <button onClick={() => handleStep(1)} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--secondary)', border: '1.5px solid rgba(255,215,0,0.45)', color: '#FFD700', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>›</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── view picker ── */}
        {!focusMode && (
          <div style={{ position: 'absolute', bottom: 16, right: 14, zIndex: 10, background: 'var(--secondary)', border: '1.5px solid rgba(141,110,99,0.35)', borderRadius: 16, padding: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            {[{ id: 'world', icon: '👁', label: 'Look Around' }, { id: 'list', icon: '📋', label: 'List' }].map(vw => (
              <button
                key={vw.id}
                onClick={() => vw.id === 'list' ? openList() : closeList()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600, color: view === vw.id ? '#3D2B1F' : '#6B4B3A', background: view === vw.id ? '#FFD700' : 'transparent', whiteSpace: 'nowrap', transition: 'all 0.15s', width: '100%' }}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{vw.icon}</span>
                {vw.label}
              </button>
            ))}
          </div>
        )}

        {/* ── activity log — real buddies from the player's completed games ── */}
        {!focusMode && view === 'world' && games.length > 0 && (
          <div style={{ position: 'absolute', bottom: 16, left: 14, zIndex: 10, background: 'rgba(30,31,34,0.92)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', borderRadius: 16, padding: '10px 14px', minWidth: 165, maxWidth: 205 }}>
            {games.slice(0, 2).map((g, i) => (
              <div key={g.id} style={{ fontSize: 11, color: 'var(--foreground)', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 700, color: '#FFD700' }}>{g.title} </span>
                {TICKER_MOODS[(g.title.length + i) % TICKER_MOODS.length]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── list overlay ── */}
      <AnimatePresence>
        {view === 'list' && (
          <motion.div
            key="list-overlay"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            style={{
              position: 'fixed',
              top: listExpanded ? 96 : undefined,
              bottom: 72,
              left: 0,
              right: 0,
              maxHeight: listExpanded ? undefined : 'calc(100vh - 220px)',
              background: 'rgba(30,31,34,0.97)',
              backdropFilter: 'blur(16px)',
              borderTop: '1.5px solid rgba(141,110,99,0.22)',
              borderRadius: listExpanded ? '16px 16px 0 0' : '20px 20px 0 0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 48,
            }}
          >
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--foreground)' }}>
                {filteredGames.length} Completed Game{filteredGames.length !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSearchOpen(s => !s)}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: searchOpen ? '#FFD700' : 'rgba(141,110,99,0.12)', border: '1px solid rgba(141,110,99,0.25)', color: 'var(--muted-foreground)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >🔍</button>
                <button
                  onClick={() => setListExp(e => !e)}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: listExpanded ? '#FFD700' : 'rgba(141,110,99,0.12)', border: '1px solid rgba(141,110,99,0.25)', color: 'var(--muted-foreground)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >⊞</button>
                <button
                  onClick={closeList}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(141,110,99,0.12)', border: '1px solid rgba(141,110,99,0.25)', color: 'var(--muted-foreground)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              </div>
            </div>

            {/* search input */}
            <AnimatePresence>
              {searchOpen && (
                <motion.input
                  key="search"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 40, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  type="text"
                  placeholder="Search games…"
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  style={{ margin: '0 18px 10px', padding: '8px 12px', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'var(--foreground)', outline: 'none', overflow: 'hidden' }}
                />
              )}
            </AnimatePresence>

            {/* game grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '4px 16px 16px', overflowY: 'auto', flex: 1 }}>
              {filteredGames.map(g => {
                const cover = g.coverUrl ?? COVER_MAP[g.title];
                const idx = games.indexOf(g);
                return (
                  <motion.div
                    key={g.id}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => { closeList(); setTimeout(() => handleAvatarSelect(idx), 320); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', background: GENRE_COVER_GRADIENT[g.genre] || '#3D1A8E', boxShadow: focusIdx === idx ? '0 0 0 2.5px #FFD700, 0 4px 12px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.25)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                      {cover
                        ? <img src={cover} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }} loading="lazy" />
                        : GENRE_ICON[g.genre] || '🎮'}
                      <div style={{ position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: '50%', background: '#3BA55D', border: '2px solid #FFF8E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 800 }}>✓</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', marginTop: 6, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {g.title}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── recently completed strip ── */}
      {!focusMode && games.length > 0 && (
        <div style={{ background: 'rgba(30,31,34,0.96)', backdropFilter: 'blur(14px)', borderTop: '1px solid rgba(141,110,99,0.22)', padding: '8px 0 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 7px' }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--foreground)' }}>Recently Completed</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>{games.length} games</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px', scrollbarWidth: 'none' }}>
            {games.map((g, i) => {
              const cover = g.coverUrl ?? COVER_MAP[g.title];
              return (
                <motion.div
                  key={g.id}
                  whileTap={{ scale: 0.91 }}
                  onClick={() => handleAvatarSelect(i)}
                  style={{ flexShrink: 0, width: 68, cursor: 'pointer' }}
                >
                  <div style={{ width: 68, height: 52, borderRadius: 10, overflow: 'hidden', background: GENRE_COVER_GRADIENT[g.genre], boxShadow: '0 2px 8px rgba(0,0,0,0.18)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {cover
                      ? <img src={cover} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} loading="lazy" />
                      : GENRE_ICON[g.genre] || '🎮'}
                    <div style={{ position: 'absolute', top: 3, right: 3, width: 15, height: 15, borderRadius: '50%', background: '#3BA55D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 800 }}>✓</div>
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--foreground)', marginTop: 4, textAlign: 'center', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {g.title}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
