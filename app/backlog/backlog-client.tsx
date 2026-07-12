'use client';

import { useState } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import Link from 'next/link';
import { genreGradient } from '@/components/cartridge-avatar';

export interface BacklogEntry {
  id: string;
  title: string;
  coverUrl: string | null;
  genres: string[];
  status: 'playing' | 'beaten' | 'abandoned';
}

const STATUS_BADGE: Record<BacklogEntry['status'], { label: string; bg: string }> = {
  playing: { label: '▶ Playing', bg: '#3BA55D' },
  beaten: { label: '✓ Beaten', bg: '#5865F2' },
  abandoned: { label: 'Shelved', bg: 'rgba(139,141,148,0.85)' },
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
      className="glass-card relative shrink-0 overflow-hidden rounded-2xl"
      style={{ height: 150 }}
    >
      <div className="relative" style={{ height: 96, background: genreGradient(entry.genres) }}>
        {entry.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.coverUrl}
            alt={entry.title}
            className="h-full w-full object-cover"
          />
        )}
        <span
          className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white"
          style={{ background: badge.bg }}
        >
          {badge.label}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-2.5 py-2">
        <span className="truncate text-[13px] font-bold text-foreground">{entry.title}</span>
        <span className="text-[11px] capitalize text-muted-foreground">{primaryGenre(entry.genres)}</span>
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
    <MotionConfig reducedMotion="user">
    <main className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Back to home" className="text-2xl leading-none text-foreground no-underline">
            ←
          </Link>
          <h1 className="text-2xl font-bold text-foreground">🎮 Library</h1>
        </div>
        <span className="text-sm font-semibold text-muted-foreground">
          {entries.length} {entries.length === 1 ? 'game' : 'games'}
        </span>
      </div>

      {/* Filter chips */}
      {entries.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-4 pt-1">
          {genreChips.map((f) => {
            const isActive = f === activeFilter;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-bold capitalize transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
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
          className="grid grid-cols-2 gap-3.5 px-5 pb-8"
        >
          {filtered.map((e) => (
            <GameCard key={e.id} entry={e} />
          ))}
        </motion.div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-10 text-center">
          <span className="text-4xl">🕹️</span>
          <span className="text-lg font-bold text-foreground">No games here yet</span>
          <span className="max-w-[240px] text-sm leading-relaxed text-muted-foreground">
            Open a booster pack on the Deck tab and lock in a game — it&apos;ll show up in your library.
          </span>
        </div>
      )}
    </main>
    </MotionConfig>
  );
}
