'use client';

import { motion } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Game {
  id: number;
  title: string;
  genre: string;
  platform: string;
  gradient: string;
  icon: React.ReactNode;
}

// ─── Genre Icons (minimalist SVG, white, 32px) ───────────────────────────────
const AdventureIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,3 29,9 29,23 16,29 3,23 3,9" stroke="white" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
  </svg>
);

const RpgIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,3 19,24 16,29 13,24" fill="white" opacity="0.9"/>
    <rect x="11" y="23" width="10" height="3" rx="1.5" fill="white" opacity="0.7"/>
  </svg>
);

const PlatformerIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16,16 Q7,7 3,12 Q7,21 16,19" fill="white" opacity="0.85"/>
    <path d="M16,16 Q25,7 29,12 Q25,21 16,19" fill="white" opacity="0.85"/>
  </svg>
);

const HorrorIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16,29 Q7,22 9,13 Q11,18 14,16 Q11,9 16,4 Q21,9 18,16 Q21,18 23,13 Q25,22 16,29Z" fill="white" opacity="0.9"/>
  </svg>
);

const RhythmIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,5 29,27 3,27" stroke="white" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
    <polygon points="10,27 16,16 22,27" fill="white" opacity="0.5"/>
  </svg>
);

const ScifiIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="11" stroke="white" strokeWidth="2.5"/>
    <circle cx="16" cy="16" r="4" fill="white" opacity="0.7"/>
  </svg>
);

// ─── Mock Data ────────────────────────────────────────────────────────────────
const GAMES: Game[] = [
  {
    id: 1,
    title: 'Zelda: TOTK',
    genre: 'Adventure',
    platform: 'Switch',
    gradient: 'linear-gradient(135deg, #1A4731, #2D7A4F, #F59E0B)',
    icon: <AdventureIcon />,
  },
  {
    id: 2,
    title: 'Elden Ring',
    genre: 'Action RPG',
    platform: 'Multi',
    gradient: 'linear-gradient(135deg, #3D1A8E, #8B2FC9, #FFD700)',
    icon: <RpgIcon />,
  },
  {
    id: 3,
    title: 'Hollow Knight',
    genre: 'Platformer',
    platform: 'Switch',
    gradient: 'linear-gradient(135deg, #1565C0, #42A5F5, #FDD835)',
    icon: <PlatformerIcon />,
  },
  {
    id: 4,
    title: 'Hades II',
    genre: 'Roguelike',
    platform: 'PC',
    gradient: 'linear-gradient(135deg, #1A0A0A, #6B1414, #CC0000)',
    icon: <HorrorIcon />,
  },
  {
    id: 5,
    title: 'Celeste',
    genre: 'Platformer',
    platform: 'Switch',
    gradient: 'linear-gradient(135deg, #880E4F, #E91E63, #F48FB1)',
    icon: <RhythmIcon />,
  },
  {
    id: 6,
    title: 'Disco Elysium',
    genre: 'RPG',
    platform: 'PC',
    gradient: 'linear-gradient(135deg, #0D1B2A, #1B4F8A, #00D4FF)',
    icon: <ScifiIcon />,
  },
];

// ─── Card Component ───────────────────────────────────────────────────────────
function GameCard({ game, index }: { game: Game; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        height: 160,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
      }}
    >
      {/* Cover */}
      <div
        style={{
          height: 100,
          background: game.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {game.icon}
        {/* Platform badge */}
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.45)',
            color: 'white',
            fontSize: 9,
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            borderRadius: 8,
            padding: '2px 6px',
          }}
        >
          {game.platform}
        </span>
      </div>

      {/* Info */}
      <div
        style={{
          padding: '7px 10px 6px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: '#1A1A2E',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {game.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Genre pill */}
          <span
            style={{
              background: '#EDE9FF',
              color: '#6B4FBB',
              fontSize: 10,
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 600,
              borderRadius: 10,
              padding: '2px 7px',
              flexShrink: 0,
            }}
          >
            {game.genre}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AddGameSearchPage() {
  return (
    <div
      style={{
        background: '#FAF8FF',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 430,
        margin: '0 auto',
        position: 'relative',
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {/* Status bar spacer */}
      <div style={{ height: 44, background: '#FAF8FF', flexShrink: 0 }} />

      {/* Header */}
      <div
        style={{
          height: 56,
          background: '#FAF8FF',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 22,
            color: '#1A1A2E',
          }}
        >
          Find a Game
        </span>
      </div>

      {/* Scrollable results grid — fills space above fixed search bar */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 12px 96px',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {GAMES.map((game, i) => (
            <GameCard key={game.id} game={game} index={i} />
          ))}
        </div>
      </div>

      {/* Fixed bottom search bar — NO bottom nav */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 430,
          zIndex: 50,
          padding: '0 12px 16px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          background: 'transparent',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            height: 64,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '2px solid #E5E7EB',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 10,
            pointerEvents: 'auto',
            cursor: 'text',
          }}
        >
          {/* Magnifier */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="8.5" cy="8.5" r="5.5" stroke="#6B7280" strokeWidth="2"/>
            <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
          </svg>

          {/* Placeholder text */}
          <span
            style={{
              flex: 1,
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 400,
              fontSize: 15,
              color: '#9CA3AF',
              userSelect: 'none',
            }}
          >
            Search games...
          </span>

          {/* Microphone */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <rect x="7" y="2" width="6" height="9" rx="3" stroke="#6B7280" strokeWidth="2"/>
            <path d="M4 10c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
            <line x1="10" y1="16" x2="10" y2="19" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
