import type { Metadata } from "next"
import { BottomNav } from '@/components/bottom-nav'

export const metadata: Metadata = {
  title: `Just Play v${process.env.NEXT_PUBLIC_APP_VERSION ?? "2.0"}`,
  description: "Every game you finish lives in your world forever.",
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  )
}
