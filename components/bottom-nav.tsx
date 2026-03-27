"use client"

import { motion } from "framer-motion"

type Tab = "deck" | "session" | "progress"

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
  hasActiveSession: boolean
  xpPending?: boolean
}

export function BottomNav({ active, onChange, hasActiveSession, xpPending }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/90 backdrop-blur-lg px-4 pb-[env(safe-area-inset-bottom)]"
      style={{ minHeight: 64 }}
    >
      {/* Only show Deck when no active session - forces focus on current game */}
      {!hasActiveSession && (
        <NavItem
          label="Deck"
          active={active === "deck"}
          onClick={() => onChange("deck")}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008M6 12h.008M6 18h.008M10 6h.008M10 12h.008M10 18h.008M14 6h.008M14 12h.008M14 18h.008M18 6h.008M18 12h.008M18 18h.008" />
              <rect x="3" y="3" width="18" height="18" rx="3" />
            </svg>
          }
        />
      )}
      <NavItem
        label={hasActiveSession ? "Now Playing" : "Session"}
        active={active === "session"}
        onClick={() => onChange("session")}
        badge={hasActiveSession}
        icon={
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        }
      />
      <NavItem
        label="Progress"
        active={active === "progress"}
        onClick={() => onChange("progress")}
        glow={xpPending}
        icon={
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        }
      />
    </nav>
  )
}

function NavItem({
  label,
  active,
  onClick,
  icon,
  badge,
  glow,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  badge?: boolean
  glow?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex min-h-[44px] min-w-[64px] flex-col items-center justify-center gap-1 py-2"
    >
      <div className="relative">
        <span
          className={`transition-colors ${
            active ? "text-primary" : glow ? "text-amber-400" : "text-muted-foreground"
          }`}
        >
          {icon}
        </span>
        {badge && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success"
          />
        )}
        {glow && !active && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: 3, duration: 1.2 }}
            className="absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)" }}
          />
        )}
      </div>
      <span
        className={`text-[10px] font-medium transition-colors ${
          active ? "text-primary" : glow ? "text-amber-400" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  )
}
