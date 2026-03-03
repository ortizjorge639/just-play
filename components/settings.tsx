"use client"

import { motion } from "framer-motion"
import { signout } from "@/app/auth/actions"

interface SettingsProps {
  displayName: string | null
  onClose: () => void
  onReplayTutorial: () => void
  onEditPreferences: () => void
}

export function Settings({ 
  displayName, 
  onClose, 
  onReplayTutorial,
  onEditPreferences 
}: SettingsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
        <div className="w-12" />
      </header>

      {/* Profile section */}
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xl font-bold text-primary">
              {(displayName || "P").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-foreground">
              {displayName || "Player"}
            </span>
            <span className="text-sm text-muted-foreground">
              Just Play Member
            </span>
          </div>
        </div>
      </div>

      {/* Settings list */}
      <div className="px-6 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Preferences
        </h2>
        <div className="flex flex-col gap-1">
          <SettingsItem
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            }
            label="Edit Game Preferences"
            onClick={onEditPreferences}
          />
        </div>
      </div>

      <div className="px-6 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Help
        </h2>
        <div className="flex flex-col gap-1">
          <SettingsItem
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            }
            label="Replay Tutorial"
            onClick={onReplayTutorial}
          />
          <a
            href="https://x.com/messages/compose?recipient_id=jojiguy639"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-xl text-left transition-colors hover:bg-secondary min-h-[56px] w-full"
          >
            <span className="text-muted-foreground">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </span>
            <span className="text-base font-medium text-foreground flex-1">Send Feedback</span>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      </div>

      <div className="px-6 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Account
        </h2>
        <div className="flex flex-col gap-1">
          <form action={signout}>
            <button
              type="submit"
              className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors hover:bg-secondary min-h-[56px]"
            >
              <span className="text-destructive">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </span>
              <span className="text-base font-medium text-destructive">Sign Out</span>
            </button>
          </form>
        </div>
      </div>

      {/* App version */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <span className="text-xs text-muted-foreground">Just Play v1.1.4</span>
      </div>
    </motion.div>
  )
}

function SettingsItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-xl text-left transition-colors hover:bg-secondary min-h-[56px] w-full"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-base font-medium text-foreground flex-1">{label}</span>
      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
