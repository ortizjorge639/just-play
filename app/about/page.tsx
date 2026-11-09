import type { Metadata, Viewport } from "next"
import { LandingPage } from "@/components/landing-page"

export const viewport: Viewport = { viewportFit: "cover" }

export const metadata: Metadata = {
  title: "Just Play — Flow through your backlog",
  description: "Less deciding. More playing. Find your next game from a curated catalog based on your mood, energy, and time.",
  openGraph: {
    title: "Just Play — Flow through your backlog",
    description: "Find your next game. Pick one. Settle in.",
    type: "website",
    images: [{ url: "/media/social-card.jpg", width: 1200, height: 630, alt: "Just Play — Flow through your backlog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Just Play — Flow through your backlog",
    description: "Less deciding. More playing.",
    images: ["/media/social-card.jpg"],
  },
}

export default function AboutPage() {
  return <LandingPage />
}
