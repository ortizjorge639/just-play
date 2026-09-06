import type { Metadata } from "next"
import DemoLoader from "@/components/demo/ui/demo-loader"
import "@/components/demo/demo.css"

export const metadata: Metadata = {
  title: "Just Play — A little world of your own",
  description: "Explore an original canopy village made of fictional games, familiar faces, and the stories that stay with you. A no-login, local-only demo.",
  robots: { index: false, follow: false },
}

export default function DemoPage() {
  return <DemoLoader />
}
