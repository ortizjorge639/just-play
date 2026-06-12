"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  {
    label: "Home",
    href: "/",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H6a1 1 0 01-1-1V9.5z"
          stroke={active ? "#6B4FBB" : "#9CA3AF"} strokeWidth="1.8" fill={active ? "#EDE9FF" : "none"} strokeLinejoin="round"/>
        <rect x="8" y="13" width="6" height="7" rx="1"
          fill={active ? "#6B4FBB" : "#9CA3AF"} opacity="0.7"/>
      </svg>
    ),
  },
  {
    label: "Search",
    href: "/add",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="10" cy="10" r="6" stroke={active ? "#6B4FBB" : "#9CA3AF"} strokeWidth="1.8"/>
        <path d="M15 15l4 4" stroke={active ? "#6B4FBB" : "#9CA3AF"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Library",
    href: "/backlog",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="5" width="16" height="3" rx="1.5" fill={active ? "#6B4FBB" : "#9CA3AF"}/>
        <rect x="3" y="10" width="16" height="3" rx="1.5" fill={active ? "#6B4FBB" : "#9CA3AF"} opacity="0.7"/>
        <rect x="3" y="15" width="16" height="3" rx="1.5" fill={active ? "#6B4FBB" : "#9CA3AF"} opacity="0.4"/>
      </svg>
    ),
  },
  {
    label: "Treehouse",
    href: "/completed",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <polygon points="11,3 19,13 3,13" fill={active ? "#6B4FBB" : "#9CA3AF"} opacity="0.85"/>
        <rect x="9" y="13" width="4" height="6" rx="1" fill={active ? "#6B4FBB" : "#9CA3AF"} opacity="0.7"/>
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: 56, background: "white",
      borderTop: "1px solid #E5E7EB",
      display: "flex", alignItems: "center",
      zIndex: 50,
    }}>
      {TABS.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href))
        return (
          <Link key={tab.href} href={tab.href} style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 2,
            textDecoration: "none",
          }}>
            {tab.icon(active)}
            <span style={{
              fontFamily: "Nunito, sans-serif", fontWeight: 600,
              fontSize: 10, color: active ? "#6B4FBB" : "#9CA3AF",
              lineHeight: 1,
            }}>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
