'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { genreGradient } from '@/components/cartridge-avatar';

export interface BacklogEntry {
  id: string;
  title: string;
  coverUrl: string | null;
  genres: string[];
  status: 'playing' | 'beaten' | 'abandoned';
}

// v2 mock palette (light lavender library look, kept per design review)
const C = {
  primary: '#6B4FBB',
  bg: '#FAF8FF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  chipInactiveBg: '#EDE9FF',
};

const STATUS_BADGE: Record<BacklogEntry['status'], { label: string; bg: string }> = {
  playing: { label: '▶ Playing', bg: '#3BA55D' },
  beaten: { label: '✓ Beaten', bg: '#6B4FBB' },
  abandoned: { label: 'Shelved', bg: '#9CA3AF' },
};

function primaryGenre(genres: string[]): string {
  return (genres[0] ?? 'game').replace(/-/g, ' ');
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

function GameCard({ entry }: { entry: BacklogEntry }) {
  const badge = STATUS_BADGE[entry.status];
  return (
    <motion.div
      variants={cardVariants}
      whileTap={{ scale: 0.96 }}
      style={{
        height: 150,
        borderRadius: 14,
        backgroundColor: 'white',
        boxShadow: '0 1px 6px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: 96,
          background: genreGradient(entry.genres),
          position: 'relative',
        }}
      >
        {entry.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.coverUrl}
            alt={entry.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            background: badge.bg,
            color: 'white',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 9,
            borderRadius: 5,
            padding: '2px 6px',
            lineHeight: 1.3,
          }}
        >
          {badge.label}
        </span>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: C.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {entry.title}
        </span>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: C.textSecondary, textTransform: 'capitalize' }}>
          {primaryGenre(entry.genres)}
        </span>
      </div>
    </motion.div>
  );
}

export default function BacklogClient({ entries }: { entries: BacklogEntry[] }) {
  const genreChips = ['All', ...Array.from(new Set(entries.map((e) => primaryGenre(e.genres))))].slice(0, 8);
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered =
    activeFilter === 'All' ? entries : entries.filter((e) => primaryGenre(e.genres) === activeFilter);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: C.bg,
        fontFamily: 'Nunito, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Nunito:wght@400;600;700;800&display=swap');
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '18px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" aria-label="Back to home" style={{ color: C.text, fontSize: 22, lineHeight: 1, textDecoration: 'none' }}>
            ←
          </Link>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: C.text }}>
            🎮 Library
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary }}>
          {entries.length} {entries.length === 1 ? 'game' : 'games'}
        </span>
      </div>

      {/* Filter chips */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '4px 20px 14px', overflowX: 'auto' }}>
          {genreChips.map((f) => {
            const isActive = f === activeFilter;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 18,
                  padding: '7px 16px',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize',
                  color: isActive ? 'white' : C.primary,
                  backgroundColor: isActive ? C.primary : C.chipInactiveBg,
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 14,
            padding: '0 20px 32px',
          }}
        >
          {filtered.map((e) => (
            <GameCard key={e.id} entry={e} />
          ))}
        </motion.div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 40,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 40 }}>🕹️</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: C.text }}>
            No games here yet
          </span>
          <span style={{ fontSize: 13, color: C.textSecondary, maxWidth: 240, lineHeight: 1.5 }}>
            Open a booster pack on the Deck tab and lock in a game — it&apos;ll show up in your library.
          </span>
        </div>
      )}
    </div>
  );
}
