import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

const APP_TITLE = `Just Play v${process.env.NEXT_PUBLIC_APP_VERSION ?? "2.0"}`

export const metadata: Metadata = {
  title: APP_TITLE,
  description:
    "Stop scrolling your library. Start playing. Just Play picks 1-3 games for you based on your mood, energy, and time.",
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f0f14",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased min-h-dvh`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
