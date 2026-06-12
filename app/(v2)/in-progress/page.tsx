'use client';

import { motion } from 'framer-motion';

// --- Mock Data ---
const GAME = {
  title: 'Elden Ring',
  platform: 'Nintendo Switch',
  sessionTime: '1h 23m',
  totalTime: '42h 15m',
  progress: 67,
  xpCurrent: 1240,
  xpTotal: 2000,
  timer: '01:23:47',
};

// --- SVG Icons ---
function SwordIcon() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Blade */}
      <polygon points="30,4 33,28 30,30 27,28" fill="white" opacity="0.95" />
      {/* Crossguard */}
      <rect x="18" y="28" width="24" height="5" rx="2" fill="white" opacity="0.85" />
      {/* Handle */}
      <rect x="27.5" y="33" width="5" height="14" rx="2" fill="white" opacity="0.8" />
      {/* Pommel */}
      <circle cx="30" cy="49" r="3.5" fill="white" opacity="0.9" />
    </svg>
  );
}

function MiiAvatar() {
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="45" cy="26" r="20" fill="#FFD4B2" />
      {/* Eyes */}
      <circle cx="38" cy="24" r="3" fill="#1A1A2E" />
      <circle cx="52" cy="24" r="3" fill="#1A1A2E" />
      {/* Mouth */}
      <path d="M38 33 Q45 38 52 33" stroke="#C07040" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Torso */}
      <rect x="30" y="48" width="30" height="22" rx="5" fill="#6B4FBB" />
      {/* Arms */}
      <rect x="14" y="48" width="14" height="8" rx="4" fill="#6B4FBB" />
      <rect x="62" y="48" width="14" height="8" rx="4" fill="#6B4FBB" />
      {/* Controller */}
      <rect x="20" y="56" width="18" height="10" rx="3" fill="#1A1A2E" />
      <circle cx="24" cy="60" r="1.5" fill="#6B4FBB" />
      <circle cx="28" cy="60" r="1.5" fill="#4ECDC4" />
      <rect x="32" y="58" width="4" height="2" rx="1" fill="#6B7280" />
      {/* Legs */}
      <rect x="32" y="70" width="10" height="14" rx="4" fill="#1A0A4E" />
      <rect x="48" y="70" width="10" height="14" rx="4" fill="#1A0A4E" />
    </svg>
  );
}

function FullScreenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="20" height="20" rx="2" stroke="#6B7280" strokeWidth="1.8" />
      <polyline points="4,8 4,4 8,4" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14,4 18,4 18,8" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="18,14 18,18 14,18" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="8,18 4,18 4,14" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="10" stroke="#6B4FBB" strokeWidth="1.8" />
      <rect x="7.5" y="7" width="3" height="8" rx="1.5" fill="#6B4FBB" />
      <rect x="11.5" y="7" width="3" height="8" rx="1.5" fill="#6B4FBB" />
    </svg>
  );
}

function CompleteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="10" stroke="#4ECDC4" strokeWidth="1.8" />
      <polyline points="6.5,11 9.5,14 15.5,8" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InProgressPage() {
  return (
    <div
      style={{
        fontFamily: "'Nunito', sans-serif",
        backgroundColor: '#1A0A4E',
        minHeight: '100vh',
        width: '100%',
        maxWidth: '375px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Google Fonts preload */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Space+Grotesk:wght@400;500;700&display=swap');

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .xp-bar-fill {
          background: linear-gradient(
            90deg,
            #FFD700 0%,
            #FFE94D 40%,
            #FFD700 60%,
            #FFC200 100%
          );
          background-size: 200% 100%;
          animation: shimmer 2s linear infinite;
        }

        button:active {
          opacity: 0.7;
        }
      `}</style>

      {/* ─── 1. HERO COVER ─── */}
      <div
        style={{
          height: '220px',
          width: '100%',
          background: 'linear-gradient(135deg, #3D1A8E, #8B2FC9, #FFD700)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Dark gradient overlay bottom 40% */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40%',
            background: 'linear-gradient(to bottom, transparent, rgba(26,10,78,0.85))',
            pointerEvents: 'none',
          }}
        />

        {/* Back button */}
        <button
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '20px',
            color: 'white',
            fontSize: '14px',
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 600,
            padding: '6px 14px',
            cursor: 'pointer',
            zIndex: 10,
            backdropFilter: 'blur(4px)',
          }}
        >
          ← back
        </button>

        {/* Sword icon centered */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <SwordIcon />
        </div>
      </div>

      {/* ─── 2. GAME TITLE ROW ─── */}
      <div
        style={{
          backgroundColor: '#1A0A4E',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '18px',
            color: 'white',
          }}
        >
          {GAME.title}
        </span>
        <span
          style={{
            backgroundColor: '#4ECDC4',
            color: 'white',
            fontSize: '11px',
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '999px',
          }}
        >
          {GAME.platform}
        </span>
      </div>

      {/* ─── 3. CONTENT CARD ─── */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
        style={{
          backgroundColor: '#FAF8FF',
          borderRadius: '24px 24px 0 0',
          marginTop: '-20px',
          padding: '20px 16px 100px 16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          position: 'relative',
          zIndex: 5,
        }}
      >
        {/* ─── 3a. MII + STATS ROW ─── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              flexShrink: 0,
              width: '90px',
              height: '90px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F0EBF8',
              borderRadius: '16px',
            }}
          >
            <MiiAvatar />
          </div>

          {/* Stats */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '18px',
                color: '#6B4FBB',
              }}
            >
              Session: {GAME.sessionTime}
            </span>
            <span
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 600,
                fontSize: '13px',
                color: '#6B7280',
              }}
            >
              Total: {GAME.totalTime}
            </span>
            <span
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 600,
                fontSize: '13px',
                color: '#FFD700',
              }}
            >
              Progress: {GAME.progress}%
            </span>
          </div>
        </div>

        {/* ─── 3b. XP PROGRESS BAR ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div
            style={{
              height: '12px',
              backgroundColor: '#E5E7EB',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              className="xp-bar-fill"
              style={{
                height: '100%',
                width: `${GAME.progress}%`,
                borderRadius: '999px',
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 600,
              fontSize: '12px',
              color: '#6B7280',
              textAlign: 'right',
            }}
          >
            {GAME.xpCurrent.toLocaleString()} / {GAME.xpTotal.toLocaleString()} XP
          </span>
        </div>

        {/* ─── 3c. SET GOAL BUTTON ─── */}
        <div>
          <button
            style={{
              border: '2px solid #6B4FBB',
              color: '#6B4FBB',
              backgroundColor: 'transparent',
              borderRadius: '20px',
              padding: '8px 16px',
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Set a Goal 🎯
          </button>
        </div>

        {/* ─── 3d. SESSION TIMER ─── */}
        <div
          style={{
            textAlign: 'center',
            paddingTop: '8px',
          }}
        >
          <span
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '32px',
              fontWeight: 700,
              color: '#6B4FBB',
              letterSpacing: '4px',
            }}
          >
            {GAME.timer}
          </span>
          <p
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontSize: '11px',
              color: '#6B7280',
              marginTop: '4px',
            }}
          >
            Session Timer
          </p>
        </div>
      </motion.div>

      {/* ─── 4. SESSION ACTION BAR ─── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '375px',
          height: '64px',
          backgroundColor: 'white',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 100,
        }}
      >
        {/* Full Screen */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer',
            padding: '4px 12px',
          }}
        >
          <FullScreenIcon />
          <span
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 600,
              fontSize: '11px',
              color: '#6B7280',
            }}
          >
            Full Screen
          </span>
        </motion.button>

        {/* Pause */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer',
            padding: '4px 12px',
          }}
        >
          <PauseIcon />
          <span
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 600,
              fontSize: '11px',
              color: '#6B7280',
            }}
          >
            Pause
          </span>
        </motion.button>

        {/* Complete */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer',
            padding: '4px 12px',
          }}
        >
          <CompleteIcon />
          <span
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 600,
              fontSize: '11px',
              color: '#6B7280',
            }}
          >
            Complete
          </span>
        </motion.button>
      </div>
    </div>
  );
}
