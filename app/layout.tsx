import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL("https://v0-just-play-app.vercel.app"),
  title: "Just Play",
  description:
    "Flow through your backlog. Find your next game from a curated catalog based on your mood, energy, and time.",
  openGraph: {
    title: "Just Play — Flow through your backlog",
    description: "Less deciding. More playing.",
    images: [{ url: "/media/social-card.jpg", width: 1200, height: 630, alt: "Just Play — Flow through your backlog" }],
  },
  twitter: { card: "summary_large_image", images: ["/media/social-card.jpg"] },
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141714",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased min-h-dvh">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
