import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Just Play",
  description: "Every game you finish lives in your world forever.",
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
