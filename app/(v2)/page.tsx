'use client';

/**
 * Just Play v2 — Screen 1: Home
 * Tailwind CSS v4 + Framer Motion
 * Self-contained with hardcoded mock data
 */

import { motion } from 'framer-motion';
import CartridgeAvatar from '@/components/cartridge-avatar';

// ─── MOCK DATA ──────────────────────────────────────────────────────────────
const MOCK_TIME = '9:41';
const MOCK_STATS = { completed: 47, backlog: 8 };
const MOCK_CREW = [
  { name: 'Joji', skin: '#FFD4B2', hair: '#3D2B1F', torso: '#6B4FBB', gradient: 'linear-gradient(135deg,#6B4FBB,#9C27B0,#FFD700)' },
  { name: 'Kai',  skin: '#C8956C', hair: '#1A1A1A', torso: '#FF7B54' },
  { name: 'Sam',  skin: '#FDDCB5', hair: '#8B4513', torso: '#4ECDC4',  gradient: 'linear-gradient(135deg,#4ECDC4,#26A69A,#80DEEA)' },
];
const MOCK_NOW_PLAYING = { title: 'Elden Ring', xp: 68, level: 12 };

// ─── ANIMATION FACTORY ─────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.48, delay, ease: [0.22, 1, 0.36, 1] },
});

// ─── SVG ICONS ──────────────────────────────────────────────────────────────
function TrophyIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 8h22v10c0 6.075-4.925 11-11 11S9 24.075 9 18V8z" fill="rgba(255,255,255,0.92)" />
      <path d="M9 11H5c0 4 2 7 4 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M31 11h4c0 4-2 7-4 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <rect x="17" y="29" width="6" height="5" rx="1" fill="rgba(255,255,255,0.92)" />
      <rect x="13" y="34" width="14" height="3.5" rx="1.75" fill="white" />
    </svg>
  );
}

function BacklogIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="27" width="24" height="5" rx="2.5" fill="rgba(255,255,255,0.95)" />
      <rect x="8" y="19" width="24" height="5" rx="2.5" fill="rgba(255,255,255,0.82)" />
      <rect x="8" y="11" width="24" height="5" rx="2.5" fill="rgba(255,255,255,0.68)" />
    </svg>
  );
}

function SwordIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="14" y1="3" x2="14" y2="21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="14,3 10.5,9 17.5,9" fill="white" />
      <line x1="8" y1="13" x2="20" y2="13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="12" y="21" width="4" height="5" rx="1.5" fill="rgba(255,255,255,0.75)" />
    </svg>
  );
}

function HomeNavIcon({ active }: { active?: boolean }) {
  const c = active ? '#6B4FBB' : '#9CA3AF';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 11.5L12 3L21 11.5V21H15.5V15H8.5V21H3V11.5Z"
        fill={active ? '#EDE8FF' : 'none'}
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchNavIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="#9CA3AF" strokeWidth="1.6" />
      <line x1="16.2" y1="16.2" x2="21" y2="21" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LibraryNavIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="4" height="16" rx="1.5" stroke="#9CA3AF" strokeWidth="1.6" />
      <rect x="9" y="4" width="4" height="16" rx="1.5" stroke="#9CA3AF" strokeWidth="1.6" />
      <path d="M15.5 5L21 7V20L15.5 18V5Z" stroke="#9CA3AF" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function TreehouseNavIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L22 9.5H17V22H7V9.5H2L12 2Z" stroke="#9CA3AF" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="10" y="15" width="4" height="7" rx="1" fill="rgba(156,163,175,0.25)" stroke="#9CA3AF" strokeWidth="1.2" />
    </svg>
  );
}

// ─── MII-STYLE AVATAR ───────────────────────────────────────────────────────
function MiiAvatar({ skin, hair, torso }: { skin: string; hair: string; torso: string }) {
  return (
    <svg width="60" height="80" viewBox="0 0 60 82" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Back hair (behind head) */}
      <ellipse cx="30" cy="17" rx="15" ry="9" fill={hair} />
      {/* Head oval */}
      <ellipse cx="30" cy="24" rx="13.5" ry="14.5" fill={skin} />
      {/* Hair top volume */}
      <ellipse cx="30" cy="11" rx="11.5" ry="6.5" fill={hair} />
      {/* Hair side bits */}
      <ellipse cx="17" cy="20" rx="4" ry="5.5" fill={hair} />
      <ellipse cx="43" cy="20" rx="4" ry="5.5" fill={hair} />
      {/* Left eye */}
      <ellipse cx="23.5" cy="22" rx="2.8" ry="3.2" fill="#1A1A2E" />
      {/* Right eye */}
      <ellipse cx="36.5" cy="22" rx="2.8" ry="3.2" fill="#1A1A2E" />
      {/* Eye shines */}
      <circle cx="24.8" cy="20.5" r="0.9" fill="white" />
      <circle cx="37.8" cy="20.5" r="0.9" fill="white" />
      {/* Nose (subtle) */}
      <circle cx="30" cy="26.5" r="1.2" fill="rgba(0,0,0,0.08)" />
      {/* Smile */}
      <path d="M25 30 Q30 34.5 35 30" stroke="#B05A55" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Neck */}
      <rect x="26" y="37" width="8" height="5.5" rx="1.5" fill={skin} />
      {/* Torso */}
      <rect x="14" y="42" width="32" height="20" rx="7" fill={torso} />
      {/* Left arm */}
      <rect x="5" y="43" width="9" height="15" rx="4.5" fill={torso} />
      {/* Right arm */}
      <rect x="46" y="43" width="9" height="15" rx="4.5" fill={torso} />
      {/* Left hand */}
      <ellipse cx="9.5" cy="58" rx="4.2" ry="3.6" fill={skin} />
      {/* Right hand */}
      <ellipse cx="50.5" cy="58" rx="4.2" ry="3.6" fill={skin} />
      {/* Left leg */}
      <rect x="16" y="61" width="11" height="18" rx="4" fill="#1A1A2E" />
      {/* Right leg */}
      <rect x="33" y="61" width="11" height="18" rx="4" fill="#1A1A2E" />
      {/* Shoe hints */}
      <ellipse cx="21.5" cy="79" rx="6.5" ry="3" fill="#111" />
      <ellipse cx="38.5" cy="79" rx="6.5" ry="3" fill="#111" />
    </svg>
  );
}

// ─── NAV TAB ITEM ───────────────────────────────────────────────────────────
interface NavTabProps {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

function NavTab({ label, icon, active }: NavTabProps) {
  return (
    <div
      className="flex flex-col items-center cursor-pointer"
      style={{ gap: 2, minWidth: 56 }}
    >
      {icon}
      <span
        style={{
          fontSize: 10,
          fontWeight: active ? 700 : 600,
          color: active ? '#6B4FBB' : '#9CA3AF',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: 375,
        minHeight: '100vh',
        backgroundColor: '#FAF8FF',
        fontFamily: 'Nunito, sans-serif',
        margin: '0 auto',
        position: 'relative',
      }}
    >

      {/* ── 1. STATUS BAR ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ height: 44, backgroundColor: '#FAF8FF', paddingInline: 20 }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#1A1A2E',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {MOCK_TIME}
        </span>
        <div className="flex items-center" style={{ gap: 6 }}>
          {/* WiFi icon */}
          <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
            <path d="M9 9.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#1A1A2E" />
            <path d="M5.5 7C6.8 5.7 7.9 5 9 5s2.2.7 3.5 2" stroke="#1A1A2E" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M2.5 4.5C4.3 2.8 6.5 2 9 2s4.7.8 6.5 2.5" stroke="#1A1A2E" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {/* Battery icon */}
          <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
            <rect x="0.6" y="0.6" width="22" height="11.8" rx="3.4" stroke="#1A1A2E" strokeWidth="1.2" />
            <rect x="2" y="2" width="15" height="9" rx="2" fill="#1A1A2E" />
            <path d="M23.5 4V9" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ── 2. HEADER ─────────────────────────────────────────────────────── */}
      <motion.div
        {...fadeUp(0)}
        className="flex items-center justify-between"
        style={{
          height: 64,
          background: 'linear-gradient(135deg, #6B4FBB 0%, #9C27B0 100%)',
          paddingInline: 20,
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'white',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          Good morning, Joji 👋
        </span>
        <div
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#FF7B54',
            fontSize: 17,
            fontWeight: 800,
            color: 'white',
            fontFamily: "'Space Grotesk', sans-serif",
            boxShadow: '0 2px 10px rgba(255,123,84,0.55)',
            flexShrink: 0,
          }}
        >
          J
        </div>
      </motion.div>

      {/* ── 3. NAV CARDS GRID ─────────────────────────────────────────────── */}
      <motion.div
        {...fadeUp(0.1)}
        className="grid"
        style={{ gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12 }}
      >
        {/* Completed Card */}
        <motion.div
          className="flex flex-col justify-between"
          whileTap={{ scale: 0.96 }}
          style={{
            height: 140,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
            padding: '16px 16px 18px',
            boxShadow: '0 6px 24px rgba(76,175,80,0.32)',
          }}
        >
          <TrophyIcon />
          <div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: 'white',
                fontFamily: "'Space Grotesk', sans-serif",
                lineHeight: 1,
              }}
            >
              {MOCK_STATS.completed}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.87)',
                fontFamily: 'Nunito, sans-serif',
                marginTop: 3,
              }}
            >
              Completed
            </div>
          </div>
        </motion.div>

        {/* Backlog Card */}
        <motion.div
          className="flex flex-col justify-between"
          whileTap={{ scale: 0.96 }}
          style={{
            height: 140,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #6B4FBB 0%, #9C27B0 100%)',
            padding: '16px 16px 18px',
            boxShadow: '0 6px 24px rgba(107,79,187,0.32)',
          }}
        >
          <BacklogIcon />
          <div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: 'white',
                fontFamily: "'Space Grotesk', sans-serif",
                lineHeight: 1,
              }}
            >
              {MOCK_STATS.backlog}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.87)',
                fontFamily: 'Nunito, sans-serif',
                marginTop: 3,
              }}
            >
              Backlog
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── 4. CREW SECTION ───────────────────────────────────────────────── */}
      <motion.div
        {...fadeUp(0.2)}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          margin: '0 12px',
          padding: '16px 12px 20px',
          boxShadow: '0 2px 16px rgba(26,26,46,0.07)',
        }}
      >
        <p
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#1A1A2E',
            fontFamily: "'Space Grotesk', sans-serif",
            margin: '0 0 14px',
          }}
        >
          Your Crew
        </p>
        <div className="flex justify-around items-end">
          {MOCK_CREW.map((member) => (
            <div
              key={member.name}
              className="flex flex-col items-center"
              style={{ width: 80 }}
            >
              <CartridgeAvatar gradient={member.gradient} title={member.name} animated={false} size={0.7} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#1A1A2E',
                  fontFamily: 'Nunito, sans-serif',
                  marginTop: 6,
                }}
              >
                {member.name}
              </span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* ── 5. SPACER ─────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── 6. NOW PLAYING BANNER ─────────────────────────────────────────── */}
      <motion.div
        {...fadeUp(0.3)}
        className="flex items-center overflow-hidden"
        style={{
          height: 90,
          margin: '0 12px 12px',
          background: 'linear-gradient(135deg, #1A0A4E 0%, #4A2F9A 100%)',
          borderRadius: 20,
          boxShadow: '0 6px 28px rgba(26,10,78,0.42)',
        }}
      >
        {/* Left 35%: Game cover art */}
        <div
          className="flex items-center justify-center"
          style={{ width: '35%', height: '100%', padding: '10px 8px 10px 12px' }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: '100%',
              height: 70,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3D1A8E 0%, #8B2FC9 60%, #FFD700 100%)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
            }}
          >
            <SwordIcon />
          </div>
        </div>

        {/* Right 65%: Track info + XP bar */}
        <div
          className="flex flex-col justify-center"
          style={{ flex: 1, paddingRight: 16, paddingLeft: 6, gap: 3 }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#4ECDC4',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.06em',
            }}
          >
            ▶ NOW PLAYING
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'white',
              fontFamily: "'Space Grotesk', sans-serif",
              lineHeight: 1.2,
            }}
          >
            {MOCK_NOW_PLAYING.title}
          </div>
          {/* XP Bar */}
          <div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.15)',
                overflow: 'hidden',
                marginTop: 4,
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${MOCK_NOW_PLAYING.xp}%` }}
                transition={{ duration: 1.2, delay: 0.72, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #B8860B 0%, #FFD700 45%, #FFF176 70%, #FFD700 100%)',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.55)',
                fontFamily: 'Nunito, sans-serif',
                marginTop: 4,
              }}
            >
              {MOCK_NOW_PLAYING.xp} XP · Lv {MOCK_NOW_PLAYING.level}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── 7. BOTTOM NAV ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-around"
        style={{
          height: 56,
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <NavTab label="Home"      icon={<HomeNavIcon active />} active />
        <NavTab label="Search"    icon={<SearchNavIcon />} />
        <NavTab label="Library"   icon={<LibraryNavIcon />} />
        <NavTab label="Treehouse" icon={<TreehouseNavIcon />} />
      </div>

    </div>
  );
}
