'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────
interface GameResult {
  id: number;
  name: string;
  cover?: string;
  summary?: string;
  genres?: string[];
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        height: 160,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ height: 100, background: '#E5E7EB' }} />
      <div
        style={{
          padding: '7px 10px 6px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          justifyContent: 'center',
        }}
      >
        <div style={{ height: 13, borderRadius: 4, background: '#E5E7EB', width: '75%' }} />
        <div style={{ height: 10, borderRadius: 10, background: '#F3F4F6', width: '45%' }} />
      </div>
    </div>
  );
}

// ─── Game Card ────────────────────────────────────────────────────────────────
function GameCard({ game, index }: { game: GameResult; index: number }) {
  const params = new URLSearchParams({
    id: String(game.id),
    name: game.name,
    cover: game.cover ?? '',
    summary: game.summary ?? '',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.96 }}
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
      <Link href={`/add/confirm?${params.toString()}`} style={{ display: 'contents', textDecoration: 'none' }}>
        {/* Cover */}
        <div
          style={{
            height: 100,
            background: game.cover
              ? `url(${game.cover}) center/cover no-repeat`
              : 'linear-gradient(135deg, #6B4FBB, #9C27B0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {!game.cover && (
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="11" stroke="white" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="4" fill="white" opacity="0.7" />
            </svg>
          )}
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
              fontFamily: \"'Nunito', sans-serif\",
              fontWeight: 700,
              fontSize: 13,
              color: '#1A1A2E',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {game.name}
          </div>
          {game.genres && game.genres.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  background: '#EDE9FF',
                  color: '#6B4FBB',
                  fontSize: 10,
                  fontFamily: \"'Nunito', sans-serif\",
                  fontWeight: 600,
                  borderRadius: 10,
                  padding: '2px 7px',
                  flexShrink: 0,
                }}
              >
                {game.genres[0]}
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AddGameSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/search-games?q=' + encodeURIComponent(query));
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

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
        fontFamily: \"'Nunito', sans-serif\",
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
            fontFamily: \"'Space Grotesk', sans-serif\",
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
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {results.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>
        ) : query.trim() ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 80,
              gap: 12,
            }}
          >
            <span style={{ fontSize: 48 }}>🎮</span>
            <span
              style={{
                fontFamily: \"'Nunito', sans-serif\",
                fontWeight: 700,
                fontSize: 16,
                color: '#6B7280',
                textAlign: 'center',
              }}
            >
              No games found for &ldquo;{query}&rdquo;
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 80,
              gap: 12,
            }}
          >
            <span style={{ fontSize: 48 }}>🔍</span>
            <span
              style={{
                fontFamily: \"'Nunito', sans-serif\",
                fontWeight: 700,
                fontSize: 16,
                color: '#6B7280',
              }}
            >
              Search for a game to add
            </span>
          </div>
        )}
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
          }}
        >
          {/* Back button */}
          <button
            onClick={() => router.back()}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: \"'Nunito', sans-serif\",
              fontWeight: 600,
              color: '#6B4FBB',
              padding: '0 8px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ← Back
          </button>

          {/* Magnifier */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="8.5" cy="8.5" r="5.5" stroke="#6B7280" strokeWidth="2" />
            <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
          </svg>

          {/* Real search input */}
          <input
            type="text"
            placeholder="Search games..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: \"'Nunito', sans-serif\",
              fontSize: 16,
              color: '#1A1A2E',
            }}
          />

          {/* Microphone */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <rect x="7" y="2" width="6" height="9" rx="3" stroke="#6B7280" strokeWidth="2" />
            <path d="M4 10c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="16" x2="10" y2="19" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
