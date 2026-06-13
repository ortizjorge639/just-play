'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';

const CartridgeAvatar = dynamicImport(
  () => import('@/components/cartridge-avatar').then(m => m.CartridgeAvatar),
  { ssr: false }
);

/* ─── Mock Data ─────────────────────────────────────────────── */
const GAME = {
  title: 'The Legend of Zelda: Tears of the Kingdom',
  developer: 'Nintendo',
  year: 2023,
  genres: ['RPG', 'Adventure', 'Open World'],
  metacritic: 96,
  description:
    'Embark on a journey across the skies and lands of Hyrule. ' +
    'Build, explore, and discover in this massive open-world adventure that pushes the boundaries of imagination.',
};

/* ─── Palette ────────────────────────────────────────────────── */
const C = {
  primary: '#6B4FBB',
  secondary: '#FF7B54',
  bg: '#FAF8FF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  gold: '#FFD700',
  chipBg: '#EDE9FF',
  white: '#FFFFFF',
};

/* ─── Animation variants ─────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut', delay },
  }),
};

/* ─── Minimalist Mii Avatar SVG ──────────────────────────────── */
function MiniMii() {
  return (
    <svg
      width="70"
      height="72"
      viewBox="0 0 70 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Head — filled circle */}
      <circle cx="35" cy="22" r="18" fill="#FFD4B2" />
      {/* Torso — filled circle (slightly overlapping head) */}
      <circle cx="35" cy="58" r="14" fill={C.primary} />
      {/* Left arm line */}
      <line
        x1="21"
        y1="52"
        x2="8"
        y2="44"
        stroke={C.primary}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Right arm line */}
      <line
        x1="49"
        y1="52"
        x2="62"
        y2="44"
        stroke={C.primary}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─── Shield SVG ─────────────────────────────────────────────── */
function ShieldIcon() {
  return (
    <svg
      width="50"
      height="58"
      viewBox="0 0 50 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M25 2L47 11V29C47 42 36 52 25 56C14 52 3 42 3 29V11L25 2Z"
        fill="white"
        fillOpacity="0.9"
      />
      <path
        d="M25 10L39 17V29C39 38.5 32 46 25 49C18 46 11 38.5 11 29V17L25 10Z"
        fill="white"
        fillOpacity="0.25"
      />
    </svg>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function AddConfirmPage() {
  const router = useRouter();
  return (
    <>
      {/* Font imports */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Nunito:wght@400;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .jp-confirm-root {
          min-height: 100svh;
          max-width: 375px;
          margin: 0 auto;
          background: ${C.bg};
          display: flex;
          flex-direction: column;
          font-family: 'Nunito', sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* Status bar */
        .jp-status-bar {
          height: 44px;
          background: ${C.bg};
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          flex-shrink: 0;
        }
        .jp-status-time {
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 13px;
          color: ${C.text};
        }
        .jp-status-icons { display: flex; align-items: center; gap: 5px; }

        /* Back row */
        .jp-back-row {
          height: 44px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          flex-shrink: 0;
        }
        .jp-back-btn {
          font-family: 'Nunito', sans-serif;
          font-weight: 600;
          font-size: 15px;
          color: ${C.primary};
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Mii + Cover section */
        .jp-mii-cover-wrap {
          margin: 0 16px;
          position: relative;
          padding-top: 50px;
          flex-shrink: 0;
        }
        .jp-mii-peek {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          /* bottom of 72px avatar aligns with top of cover (padding-top: 50px) */
          /* so top: 50px - 72px = -22px, but padding-top gives us room */
        }

        /* Hero cover card */
        .jp-cover-card {
          width: 100%;
          height: 200px;
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          background: linear-gradient(135deg, #1A4731, #2D7A4F, #F59E0B);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(45,122,79,0.25);
        }
        .jp-esrb-badge {
          position: absolute;
          bottom: 12px;
          left: 12px;
          background: rgba(255,255,255,0.92);
          color: ${C.text};
          font-family: 'Nunito', sans-serif;
          font-weight: 700;
          font-size: 11px;
          border-radius: 20px;
          padding: 3px 10px;
          letter-spacing: 0.02em;
        }

        /* Game info */
        .jp-game-info {
          padding: 18px 16px 16px;
          flex: 1;
        }
        .jp-game-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 20px;
          color: ${C.text};
          line-height: 1.3;
          margin-bottom: 5px;
        }
        .jp-game-dev {
          font-family: 'Nunito', sans-serif;
          font-weight: 400;
          font-size: 13px;
          color: ${C.textSecondary};
          margin-bottom: 12px;
        }
        .jp-genre-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }
        .jp-chip {
          background: ${C.chipBg};
          color: ${C.primary};
          font-family: 'Nunito', sans-serif;
          font-weight: 600;
          font-size: 12px;
          border-radius: 20px;
          padding: 4px 12px;
          line-height: 1.4;
        }
        .jp-stars-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .jp-stars {
          color: ${C.gold};
          font-size: 16px;
          line-height: 1;
          letter-spacing: 1px;
        }
        .jp-metacritic {
          font-family: 'Nunito', sans-serif;
          font-weight: 600;
          font-size: 13px;
          color: ${C.textSecondary};
        }
        .jp-description {
          font-family: 'Nunito', sans-serif;
          font-weight: 400;
          font-size: 13px;
          color: ${C.textSecondary};
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.6;
        }

        /* CTA section — fixed-bottom feel */
        .jp-cta-section {
          padding: 16px 16px 28px;
          background: ${C.bg};
          border-top: 1px solid rgba(107,79,187,0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
        }
        .jp-btn {
          width: 100%;
          height: 52px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          letter-spacing: 0.01em;
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .jp-btn:active { opacity: 0.85; transform: scale(0.98); }
        .jp-btn-backlog { background: ${C.primary}; }
        .jp-btn-play    { background: ${C.secondary}; }
      `}</style>

      <div className="jp-confirm-root">

        {/* 1 ── Status Bar */}
        <div className="jp-status-bar">
          <span className="jp-status-time">9:41</span>
          <div className="jp-status-icons">
            {/* Signal bars */}
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
              <rect x="0" y="4" width="3" height="8" rx="1" fill={C.text} />
              <rect x="4.5" y="2.5" width="3" height="9.5" rx="1" fill={C.text} />
              <rect x="9" y="0.5" width="3" height="11.5" rx="1" fill={C.text} />
              <rect x="13.5" y="0" width="2.5" height="12" rx="1" fill={C.text} fillOpacity="0.3" />
            </svg>
            {/* Wifi */}
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
              <path d="M8 9.5C7.17 9.5 6.5 10.17 6.5 11S7.17 12.5 8 12.5 9.5 11.83 9.5 11 8.83 9.5 8 9.5Z" fill={C.text} />
              <path d="M8 6.5C6.4 6.5 4.97 7.18 3.97 8.27L5.1 9.4C5.82 8.57 6.86 8 8 8s2.18.57 2.9 1.4l1.13-1.13C11.03 7.18 9.6 6.5 8 6.5Z" fill={C.text} />
              <path d="M8 3.5C5.35 3.5 2.98 4.65 1.35 6.5L2.5 7.65C3.85 6.1 5.82 5 8 5s4.15 1.1 5.5 2.65L14.65 6.5C13.02 4.65 10.65 3.5 8 3.5Z" fill={C.text} />
            </svg>
            {/* Battery */}
            <svg width="26" height="13" viewBox="0 0 26 13" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke={C.text} strokeOpacity="0.35" />
              <rect x="2" y="2" width="17" height="9" rx="2" fill={C.text} />
              <path d="M23.5 4.5V8.5C24.3 8.2 25 7.5 25 6.5C25 5.5 24.3 4.8 23.5 4.5Z" fill={C.text} fillOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* 2 ── Back Row */}
        <div className="jp-back-row">
          <button className="jp-back-btn" aria-label="Go back" onClick={() => router.back()}>
            ← Back
          </button>
        </div>

        {/* 3 + 4 ── Mii Peek + Hero Cover */}
        <motion.div
          className="jp-mii-cover-wrap"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          {/* Minimalist Mii peeking above card */}
          <div className="jp-mii-peek" aria-hidden="true">
            <CartridgeAvatar gradient="linear-gradient(135deg,#1A4731,#2D7A4F,#F59E0B)" title="TOTK" animated={false} size={0.8} />
          </div>

          {/* Hero cover card */}
          <div className="jp-cover-card">
            <ShieldIcon />
            <span className="jp-esrb-badge">E10+</span>
          </div>
        </motion.div>

        {/* 5 ── Game Info */}
        <motion.div
          className="jp-game-info"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.1}
        >
          <h1 className="jp-game-title">{GAME.title}</h1>
          <p className="jp-game-dev">{GAME.developer} • {GAME.year}</p>

          <div className="jp-genre-chips">
            {GAME.genres.map((g) => (
              <span key={g} className="jp-chip">{g}</span>
            ))}
          </div>

          <div className="jp-stars-row">
            <span className="jp-stars">★★★★★</span>
            <span className="jp-metacritic">{GAME.metacritic} Metacritic</span>
          </div>

          <p className="jp-description">{GAME.description}</p>
        </motion.div>

        {/* 6 ── CTA Buttons */}
        <div className="jp-cta-section">
          <motion.button
            className="jp-btn jp-btn-backlog"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.2}
            whileTap={{ scale: 0.97 }}
          >
            ✅ Add to Backlog
          </motion.button>
          <motion.button
            className="jp-btn jp-btn-play"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.28}
            whileTap={{ scale: 0.97 }}
          >
            ▶ Just Play
          </motion.button>
        </div>

      </div>
    </>
  );
}
