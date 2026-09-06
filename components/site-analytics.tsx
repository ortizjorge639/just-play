"use client"

import { Analytics } from "@vercel/analytics/next"
import { usePathname } from "next/navigation"

export function SiteAnalytics() {
  const pathname = usePathname()
  if (pathname === "/demo" || pathname === "/demo/") return null
  return <Analytics />
}
