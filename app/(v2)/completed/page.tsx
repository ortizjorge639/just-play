'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

// ─── Mock Data ───────────────────────────────────────────────────────────────
const RECENTLY_COMPLETED = [
  {
    id: 1,
    title: 'Elden Ring',
    gradient: 'linear-gradient(135deg, #6B4FBB 0%, #3D2B1F 100%)',
  },
  {
    id: 2,
    title: 'Celeste',
    gradient: 'linear-gradient(135deg, #FF6B9D 0%, #C044A8 100%)',
  },
  {
    id: 3,
    title: 'Hollow Knight',
    gradient: 'linear-gradient(135deg, #4A5568 0%, #1A202C 100%)',
  },
  {
    id: 4,
    title: 'BOTW',
    gradient: 'linear-gradient(135deg, #48BB78 0%, #2B6CB0 100%)',
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBar() {
  return (
    <div
      style={{
        height: 24,
        backgroundColor: '#3D2B1F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingInline: 16,
      }}
    >
      <span style={{ color: '#FFF8E7', fontSize: 11, fontFamily: 'Nunito', fontWeight: 700 }}>9:41</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {/* signal bars */}
        {[3, 5, 7].map((h, i) => (
          <div
            key={i}
            style={{ width: 3, height: h, backgroundColor: '#FFF8E7', borderRadius: 1, alignSelf: 'flex-end' }}
          />
        ))}
        <div style={{ width: 14, height: 7, border: '1.5px solid #FFF8E7', borderRadius: 2, marginLeft: 4, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 2, top: 1.5, width: 7, height: 3, backgroundColor: '#FFF8E7', borderRadius: 1 }} />
          <div style={{ position: 'absolute', right: -3, top: 2, width: 2, height: 3, backgroundColor: '#FFF8E7', borderRadius: '0 1px 1px 0' }} />
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div
      style={{
        height: 56,
        backgroundColor: '#3D2B1F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingInline: 16,
      }}
    >
      <span
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: 20,
          color: '#FFF8E7',
          letterSpacing: -0.3,
        }}
      >
        Your Treehouse
      </span>
      <div
        style={{
          backgroundColor: 'rgba(255,215,0,0.18)',
          border: '1.5px solid #FFD700',
          borderRadius: 20,
          paddingInline: 12,
          paddingBlock: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 13, color: '#FFD700' }}>🏆</span>
        <span
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: 13,
            color: '#FFD700',
          }}
        >
          47 Complete
        </span>
      </div>
    </div>
  );
}

// Sparkle dots
function Sparkles() {
  const dots = [
    { x: 30, y: 30, r: 3 },
    { x: 80, y: 18, r: 2 },
    { x: 200, y: 25, r: 3.5 },
    { x: 290, y: 40, r: 2 },
    { x: 340, y: 20, r: 2.5 },
    { x: 130, y: 45, r: 2 },
    { x: 240, y: 55, r: 3 },
    { x: 60, y: 60, r: 2 },
  ];
  return (
    <svg
      width="375"
      height="100"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {dots.map((d, i) => (
        <g key={i}>
          <circle cx={d.x} cy={d.y} r={d.r} fill="#FFD700" opacity={0.7} />
          <line x1={d.x - d.r * 2} y1={d.y} x2={d.x + d.r * 2} y2={d.y} stroke="#FFD700" strokeWidth={0.8} opacity={0.5} />
          <line x1={d.x} y1={d.y - d.r * 2} x2={d.x} y2={d.y + d.r * 2} stroke="#FFD700" strokeWidth={0.8} opacity={0.5} />
        </g>
      ))}
    </svg>
  );
}

// Window with sun rays
function Window() {
  return (
    <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)' }}>
      {/* outer frame */}
      <div
        style={{
          width: 72,
          height: 60,
          backgroundColor: '#8ECAE6',
          borderRadius: 4,
          border: '3px solid #6B4FBB',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* sky gradient inside */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #87CEEB 0%, #E0F4FF 100%)' }} />
        {/* sun */}
        <svg width="72" height="60" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="36" cy="22" r="10" fill="#FFD700" opacity={0.9} />
          {/* sun rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={36 + Math.cos(rad) * 12}
                y1={22 + Math.sin(rad) * 12}
                x2={36 + Math.cos(rad) * 18}
                y2={22 + Math.sin(rad) * 18}
                stroke="#FFD700"
                strokeWidth={1.5}
                opacity={0.8}
              />
            );
          })}
          {/* cross divider */}
          <line x1="36" y1="0" x2="36" y2="60" stroke="#6B4FBB" strokeWidth={1.5} opacity={0.5} />
          <line x1="0" y1="30" x2="72" y2="30" stroke="#6B4FBB" strokeWidth={1.5} opacity={0.5} />
        </svg>
      </div>
      {/* curtains */}
      <div style={{ position: 'absolute', top: -3, left: -10, width: 12, height: 66, background: '#C8956C', borderRadius: '2px 0 0 2px', opacity: 0.9 }} />
      <div style={{ position: 'absolute', top: -3, right: -10, width: 12, height: 66, background: '#C8956C', borderRadius: '0 2px 2px 0', opacity: 0.9 }} />
    </div>
  );
}

// Bookshelf
function Bookshelf() {
  const bookColors = ['#E53E3E', '#3182CE', '#38A169', '#D69E2E', '#805AD5', '#DD6B20'];
  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        right: 12,
        width: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* shelf back */}
      <div style={{ width: 60, height: 70, backgroundColor: '#C4A882', borderRadius: 2, border: '2px solid #8D6E63', position: 'relative', padding: 4 }}>
        {/* shelf divider */}
        <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, height: 2, backgroundColor: '#8D6E63' }} />
        {/* books top row */}
        <div style={{ display: 'flex', gap: 2, position: 'absolute', bottom: 37, left: 4, right: 4, height: 22 }}>
          {bookColors.slice(0, 3).map((c, i) => (
            <div key={i} style={{ flex: 1, backgroundColor: c, borderRadius: 1, opacity: 0.85 }} />
          ))}
        </div>
        {/* books bottom row */}
        <div style={{ display: 'flex', gap: 2, position: 'absolute', bottom: 5, left: 4, right: 4, height: 22 }}>
          {bookColors.slice(3).map((c, i) => (
            <div key={i} style={{ flex: 1, backgroundColor: c, borderRadius: 1, opacity: 0.85 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Framed game covers on wall
function FramedCovers() {
  const covers = [
    { x: 14, y: 70, gradient: 'linear-gradient(135deg,#6B4FBB,#3D2B1F)', label: 'ER' },
    { x: 82, y: 65, gradient: 'linear-gradient(135deg,#FF6B9D,#C044A8)', label: 'CE' },
    { x: 150, y: 72, gradient: 'linear-gradient(135deg,#4A5568,#1A202C)', label: 'HK' },
  ];
  return (
    <>
      {covers.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: c.y,
            left: c.x,
            width: 44,
            height: 36,
            background: c.gradient,
            borderRadius: 3,
            border: '2.5px solid #8D6E63',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: 'Nunito', fontWeight: 700 }}>{c.label}</span>
        </div>
      ))}
    </>
  );
}

// Trophy shelf
function TrophyShelf() {
  return (
    <div style={{ position: 'absolute', top: 120, left: 12 }}>
      {/* shelf */}
      <div style={{ width: 52, height: 4, backgroundColor: '#8D6E63', borderRadius: 2, marginTop: 32 }} />
      {/* trophy SVG */}
      <svg width="52" height="32" style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* cup body */}
        <path d="M18 4 Q16 18 22 22 L30 22 Q36 18 34 4 Z" fill="#FFD700" />
        {/* handles */}
        <path d="M18 8 Q12 10 14 16 Q16 18 18 16" fill="none" stroke="#FFD700" strokeWidth={2.5} />
        <path d="M34 8 Q40 10 38 16 Q36 18 34 16" fill="none" stroke="#FFD700" strokeWidth={2.5} />
        {/* stem */}
        <rect x="23" y="22" width="6" height="6" fill="#FFD700" />
        {/* base */}
        <rect x="18" y="27" width="16" height="3" rx="1" fill="#FFD700" />
        {/* shine */}
        <path d="M22 7 Q24 14 22 18" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} fill="none" />
      </svg>
    </div>
  );
}

// Potted plant
function PottedPlant() {
  return (
    <div style={{ position: 'absolute', bottom: '24%', left: 8 }}>
      <svg width="28" height="40">
        {/* pot */}
        <path d="M6 24 Q4 36 14 36 Q24 36 22 24 Z" fill="#C4A882" />
        <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#8D6E63" />
        {/* stem */}
        <rect x="12" y="10" width="4" height="14" rx="2" fill="#38A169" />
        {/* leaf cluster */}
        <ellipse cx="14" cy="12" rx="10" ry="7" fill="#48BB78" />
        <ellipse cx="8" cy="14" rx="6" ry="5" fill="#38A169" />
        <ellipse cx="20" cy="14" rx="6" ry="5" fill="#38A169" />
      </svg>
    </div>
  );
}

// Speech bubble
function SpeechBubble({ text, flipped = false }: { text: string; flipped?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: -34,
        left: flipped ? 'auto' : -8,
        right: flipped ? -8 : 'auto',
        backgroundColor: '#FFF8E7',
        border: '1.5px solid #8D6E63',
        borderRadius: 8,
        paddingInline: 7,
        paddingBlock: 3,
        whiteSpace: 'nowrap',
        fontFamily: 'Nunito, sans-serif',
        fontSize: 11,
        fontWeight: 700,
        color: '#3D2B1F',
        zIndex: 20,
      }}
    >
      {text}
      {/* tail */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: flipped ? 'auto' : 12,
          right: flipped ? 12 : 'auto',
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid #8D6E63',
        }}
      />
    </div>
  );
}

// Mii characters
function MiiJoji() {
  return (
    <div style={{ position: 'absolute', bottom: '22%', left: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <SpeechBubble text="GG! 🏆" />
        {/* body */}
        <svg width="36" height="60">
          {/* head */}
          <circle cx="18" cy="13" r="12" fill="#FFD4B2" />
          {/* eyes */}
          <circle cx="13" cy="12" r="2" fill="#3D2B1F" />
          <circle cx="23" cy="12" r="2" fill="#3D2B1F" />
          {/* mouth */}
          <path d="M13 18 Q18 22 23 18" fill="none" stroke="#3D2B1F" strokeWidth={1.5} />
          {/* hair */}
          <path d="M6 10 Q8 2 18 2 Q28 2 30 10" fill="#3D2B1F" />
          {/* torso */}
          <rect x="8" y="26" width="20" height="24" rx="4" fill="#6B4FBB" />
          {/* left arm */}
          <rect x="2" y="26" width="7" height="16" rx="3" fill="#6B4FBB" />
          {/* right arm */}
          <rect x="27" y="26" width="7" height="16" rx="3" fill="#6B4FBB" />
          {/* legs */}
          <rect x="9" y="49" width="7" height="10" rx="3" fill="#3D2B1F" />
          <rect x="20" y="49" width="7" height="10" rx="3" fill="#3D2B1F" />
        </svg>
      </div>
      <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 10, fontWeight: 700, color: '#3D2B1F', marginTop: 2 }}>Joji</span>
    </div>
  );
}

function MiiSam() {
  return (
    <div style={{ position: 'absolute', bottom: '32%', left: '45%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* smaller for depth */}
      <svg width="26" height="44">
        <circle cx="13" cy="9" r="9" fill="#FDDCB5" />
        <circle cx="9" cy="8" r="1.5" fill="#3D2B1F" />
        <circle cx="17" cy="8" r="1.5" fill="#3D2B1F" />
        <path d="M9 13 Q13 16 17 13" fill="none" stroke="#3D2B1F" strokeWidth={1.2} />
        <path d="M5 7 Q7 1 13 1 Q19 1 21 7" fill="#C8956C" />
        <rect x="6" y="19" width="14" height="17" rx="3" fill="#4ECDC4" />
        <rect x="1" y="19" width="6" height="12" rx="3" fill="#4ECDC4" />
        <rect x="19" y="19" width="6" height="12" rx="3" fill="#4ECDC4" />
        <rect x="7" y="35" width="5" height="7" rx="2" fill="#3D2B1F" />
        <rect x="14" y="35" width="5" height="7" rx="2" fill="#3D2B1F" />
      </svg>
      <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 9, fontWeight: 700, color: '#3D2B1F' }}>Sam</span>
    </div>
  );
}

function MiiKai() {
  return (
    <div style={{ position: 'absolute', bottom: '22%', right: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <SpeechBubble text="47! 🎮" flipped />
        <svg width="36" height="60">
          <circle cx="18" cy="13" r="12" fill="#C8956C" />
          <circle cx="13" cy="12" r="2" fill="#3D2B1F" />
          <circle cx="23" cy="12" r="2" fill="#3D2B1F" />
          <path d="M13 18 Q18 22 23 18" fill="none" stroke="#3D2B1F" strokeWidth={1.5} />
          {/* hair */}
          <path d="M6 8 Q10 2 18 3 Q26 2 30 8" fill="#8D6E63" />
          {/* torso */}
          <rect x="8" y="26" width="20" height="24" rx="4" fill="#FF7B54" />
          {/* left arm — raised waving */}
          <rect x="0" y="12" width="7" height="16" rx="3" fill="#FF7B54" transform="rotate(-40 3 20)" />
          {/* right arm — down */}
          <rect x="27" y="26" width="7" height="16" rx="3" fill="#FF7B54" />
          {/* legs */}
          <rect x="9" y="49" width="7" height="10" rx="3" fill="#3D2B1F" />
          <rect x="20" y="49" width="7" height="10" rx="3" fill="#3D2B1F" />
        </svg>
      </div>
      <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 10, fontWeight: 700, color: '#3D2B1F', marginTop: 2 }}>Kai</span>
    </div>
  );
}

// Room scene
function RoomScene() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
      style={{
        width: '100%',
        height: 380,
        background: 'linear-gradient(180deg,#FFF8E7 0%,#F5E6CA 60%,#8D6E63 100%)',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Floor */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '20%',
          background: 'linear-gradient(180deg,#A1887F 0%,#795548 100%)',
          borderTop: '2px solid #6D4C41',
        }}
      />

      {/* Wall texture strip */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '80%',
          background: 'linear-gradient(180deg,#FFF8E7 0%,#F5E6CA 100%)',
        }}
      />

      <Sparkles />
      <Window />
      <FramedCovers />
      <Bookshelf />
      <TrophyShelf />
      <PottedPlant />

      {/* Characters with staggered spring animation */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
      >
        <MiiJoji />
      </motion.div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.8 }}
      >
        <MiiSam />
      </motion.div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1.1 }}
      >
        <MiiKai />
      </motion.div>
    </motion.div>
  );
}

// Completed game card
function CompletedCard({ game }: { game: (typeof RECENTLY_COMPLETED)[0] }) {
  return (
    <motion.div whileTap={{ scale: 0.96 }} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 72,
            height: 56,
            background: game.gradient,
            borderRadius: 10,
            border: '1.5px solid rgba(0,0,0,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        />
        {/* green checkmark badge */}
        <div
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 20,
            height: 20,
            backgroundColor: '#22C55E',
            borderRadius: '50%',
            border: '2px solid #FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="10" height="8">
            <polyline points="1.5,4 4,6.5 8.5,1.5" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <span
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 10,
          fontWeight: 600,
          color: '#1A1A2E',
          textAlign: 'center',
          maxWidth: 72,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {game.title}
      </span>
    </motion.div>
  );
}

// Recently Completed row
function RecentlyCompleted() {
  return (
    <div style={{ paddingBlock: 10, paddingInline: 12, backgroundColor: '#FFF8E7' }}>
      <p
        style={{
          margin: '0 0 10px 0',
          fontFamily: 'Nunito, sans-serif',
          fontWeight: 700,
          fontSize: 14,
          color: '#1A1A2E',
        }}
      >
        Recently Completed
      </p>
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        }}
      >
        {RECENTLY_COMPLETED.map((g) => (
          <CompletedCard key={g.id} game={g} />
        ))}
      </div>
    </div>
  );
}

// Bottom nav
type NavItem = { icon: string; label: string; active?: boolean };
const NAV_ITEMS: NavItem[] = [
  { icon: '🏠', label: 'Home' },
  { icon: '🔍', label: 'Search' },
  { icon: '📚', label: 'Library' },
  { icon: '🌳', label: 'Treehouse', active: true },
];

function BottomNav() {
  const [active, setActive] = useState('Treehouse');

  return (
    <div
      style={{
        height: 56,
        backgroundColor: '#fff',
        borderTop: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingBottom: 4,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.label;
        return (
          <button
            key={item.label}
            onClick={() => setActive(item.label)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 12px',
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span
              style={{
                fontFamily: 'Nunito, sans-serif',
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? '#6B4FBB' : '#6B7280',
              }}
            >
              {item.label}
            </span>
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 6,
                  width: 4,
                  height: 4,
                  backgroundColor: '#6B4FBB',
                  borderRadius: '50%',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CompletedPage() {
  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        style={{
          width: 375,
          minHeight: 812,
          margin: '0 auto',
          backgroundColor: '#FFF8E7',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Nunito, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <StatusBar />
        <Header />
        <RoomScene />
        <RecentlyCompleted />

        {/* flex spacer */}
        <div style={{ flex: 1 }} />

        <BottomNav />
      </div>
    </>
  );
}
