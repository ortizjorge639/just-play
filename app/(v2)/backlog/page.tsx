'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

// ── Palette ───────────────────────────────────────────────
const C = {
  primary: '#6B4FBB',
  secondary: '#FF7B54',
  bg: '#FAF8FF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  chipInactiveBg: '#EDE9FF',
};

// ── Gradient map ──────────────────────────────────────────
const GRADIENTS: Record<string, string> = {
  rpg: 'linear-gradient(135deg,#3D1A8E,#8B2FC9,#FFD700)',
  platformer: 'linear-gradient(135deg,#1565C0,#42A5F5,#FDD835)',
  rhythm: 'linear-gradient(135deg,#880E4F,#E91E63,#F48FB1)',
  horror: 'linear-gradient(135deg,#1A0A0A,#6B1414,#CC0000)',
  scifi: 'linear-gradient(135deg,#0D1B2A,#1B4F8A,#00D4FF)',
  action: 'linear-gradient(135deg,#6B3A1F,#B85A2C,#F59E0B)',
  sim: 'linear-gradient(135deg,#1B5E20,#43A047,#A5D6A7)',
};

// ── Mock data ─────────────────────────────────────────────
const GAMES = [
  { id: 1, title: 'Elden Ring',     genre: 'rpg',       platform: 'Switch', priority: true  },
  { id: 2, title: 'Hollow Knight',  genre: 'platformer', platform: 'Switch', priority: true  },
  { id: 3, title: 'Celeste',        genre: 'rhythm',    platform: 'Switch', priority: false },
  { id: 4, title: 'Hades II',       genre: 'horror',    platform: 'PC',     priority: false },
  { id: 5, title: 'Disco Elysium',  genre: 'scifi',     platform: 'PC',     priority: false },
  { id: 6, title: 'Dead Cells',     genre: 'action',    platform: 'Switch', priority: false },
  { id: 7, title: 'Stardew Valley', genre: 'sim',       platform: 'Switch', priority: false },
  { id: 8, title: 'Cuphead',        genre: 'action',    platform: 'PC',     priority: false },
];

const FILTERS = ['All', 'RPG', 'Action', 'Puzzle', 'Sim'];

// ── Minimalist SVG icons ──────────────────────────────────
function IconRecommend() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V22H4V12" />
      <path d="M22 7H2v5h20V7z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function IconAddGame() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function IconScreenshot() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round">
      <circle cx="10" cy="10" r="7" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" strokeWidth="2.5" />
    </svg>
  );
}

// ── Cover icon SVGs ───────────────────────────────────────
function CoverIcon({ genre }: { genre: string }) {
  switch (genre) {
    case 'rpg':
      return (
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          <polygon points="14,2 17,20 14,24 11,20" fill="white" opacity="0.9" />
          <rect x="9" y="18" width="10" height="3" rx="1.5" fill="white" opacity="0.7" />
        </svg>
      );
    case 'platformer':
      return (
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          <path d="M14,14 Q7,7 2,11 Q6,18 14,16" fill="white" opacity="0.85" />
          <path d="M14,14 Q21,7 26,11 Q22,18 14,16" fill="white" opacity="0.85" />
        </svg>
      );
    case 'rhythm':
      return (
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          <polygon points="14,4 26,24 2,24" fill="none" stroke="white" strokeWidth="2.5" />
          <polygon points="8,24 14,14 20,24" fill="white" opacity="0.5" />
        </svg>
      );
    case 'horror':
      return (
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          <path d="M14,26 Q7,20 9,13 Q11,17 13,15 Q11,9 14,4 Q17,9 15,15 Q17,17 19,13 Q21,20 14,26Z" fill="white" opacity="0.9" />
        </svg>
      );
    case 'scifi':
      return (
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          <circle cx="14" cy="14" r="11" fill="none" stroke="white" strokeWidth="2.5" />
          <text x="14" y="19" textAnchor="middle" fill="white" fontSize="11" fontFamily="sans-serif">★</text>
        </svg>
      );
    case 'action':
      return (
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          <polygon points="14,2 17,20 14,24 11,20" fill="white" opacity="0.9" />
          <rect x="9" y="18" width="10" height="3" rx="1.5" fill="white" opacity="0.7" />
        </svg>
      );
    case 'sim':
      return (
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
          <path d="M14,24 Q4,18 6,8 Q10,12 14,10 Q18,12 22,8 Q24,18 14,24Z" fill="white" opacity="0.9" />
          <line x1="14" y1="24" x2="14" y2="14" stroke="white" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

// ── Stagger variants ──────────────────────────────────────
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 280, damping: 22 },
  },
};

// ── Game Card ─────────────────────────────────────────────
function GameCard({ game }: { game: (typeof GAMES)[0] }) {
  return (
    <motion.div
      variants={cardVariants}
      style={{
        height: 130,
        borderRadius: 14,
        backgroundColor: 'white',
        boxShadow: '0 1px 6px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Cover area */}
      <div
        style={{
          height: 90,
          background: GRADIENTS[game.genre] ?? GRADIENTS.action,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CoverIcon genre={game.genre} />

        {/* Platform badge */}
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            background: 'rgba(0,0,0,0.48)',
            color: 'white',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 8,
            borderRadius: 5,
            padding: '2px 5px',
            lineHeight: 1.3,
          }}
        >
          {game.platform}
        </span>

        {/* Priority badge */}
        {game.priority && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              background: '#FFD700',
              color: '#1A1A2E',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 800,
              fontSize: 9,
              borderRadius: 5,
              padding: '2px 5px',
              lineHeight: 1.3,
            }}
          >
            ⭐
          </span>
        )}
      </div>

      {/* Title area */}
      <div
        style={{
          height: 40,
          padding: '6px 7px 0',
        }}
      >
        <div
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 11,
            color: C.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {game.title}
        </div>
        <div
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 400,
            fontSize: 10,
            color: C.textSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textTransform: 'capitalize',
            marginTop: 1,
          }}
        >
          {game.genre}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function BacklogPage() {
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered =
    activeFilter === 'All'
      ? GAMES
      : GAMES.filter(
          (g) => g.genre.toLowerCase() === activeFilter.toLowerCase()
        );

  return (
    <div
      style={{
        width: 375,
        height: '100dvh',
        maxHeight: 812,
        backgroundColor: C.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Nunito, sans-serif',
        overflow: 'hidden',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* ── STATUS BAR ── */}
      <div
        style={{
          height: 40,
          backgroundColor: C.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 16px 0',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: 'white',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          9:41
        </span>
        {/* Status icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Signal */}
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <rect x="0.5" y="3.5" width="2" height="8" rx="0.5" fill="white" />
            <rect x="4.5" y="2.5" width="2" height="9" rx="0.5" fill="white" />
            <rect x="8.5" y="1" width="2" height="10.5" rx="0.5" fill="white" />
            <rect x="12.5" y="0" width="2" height="11.5" rx="0.5" fill="white" />
          </svg>
          {/* Wifi */}
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M8 2C10.5 2 12.8 3.1 14.3 4.9L15.5 3.6C13.7 1.4 11 0 8 0C5 0 2.3 1.4 0.5 3.6L1.7 4.9C3.2 3.1 5.5 2 8 2Z" fill="white" />
            <path d="M8 5C9.7 5 11.2 5.8 12.2 7L13.4 5.7C12.1 4.2 10.2 3.2 8 3.2C5.8 3.2 3.9 4.2 2.6 5.7L3.8 7C4.8 5.8 6.3 5 8 5Z" fill="white" />
            <circle cx="8" cy="10" r="1.8" fill="white" />
          </svg>
          {/* Battery */}
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="white" strokeOpacity="0.6" />
            <rect x="2" y="2" width="16" height="8" rx="1.5" fill="white" />
            <path d="M23 4v4a2 2 0 000-4z" fill="white" opacity="0.6" />
          </svg>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div
        style={{
          height: 56,
          backgroundColor: C.primary,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: 'white',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700,
            fontSize: 22,
          }}
        >
          Backlog
        </span>
        <span
          style={{
            backgroundColor: C.secondary,
            color: 'white',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 12,
            borderRadius: 999,
            padding: '4px 12px',
          }}
        >
          {GAMES.length} games
        </span>
      </div>

      {/* ── FILTER CHIPS ── */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          flexShrink: 0,
          backgroundColor: C.bg,
          scrollbarWidth: 'none',
        }}
      >
        {FILTERS.map((f) => {
          const isActive = f === activeFilter;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                borderRadius: 999,
                padding: '6px 14px',
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: isActive ? C.primary : C.chipInactiveBg,
                color: isActive ? 'white' : C.primary,
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* ── GAME GRID ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px 80px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          alignContent: 'start',
          scrollbarWidth: 'none',
        }}
      >
        {filtered.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </motion.div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          backgroundColor: 'white',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0 4px',
          zIndex: 20,
        }}
      >
        {[
          { label: 'Recommend', Icon: IconRecommend },
          { label: 'Add Game',  Icon: IconAddGame  },
          { label: 'Screenshot', Icon: IconScreenshot },
          { label: 'Search',    Icon: IconSearch   },
        ].map(({ label, Icon }) => (
          <button
            key={label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 10px',
            }}
          >
            <Icon />
            <span
              style={{
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 600,
                fontSize: 11,
                color: C.textSecondary,
              }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
