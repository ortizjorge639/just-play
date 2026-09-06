"use client"

import dynamic from "next/dynamic"

const DemoApp = dynamic(() => import("../demo-app"), {
  ssr: false,
  loading: () => (
    <main className="canopy-demo demo-boot" aria-busy="true">
      <span className="demo-brand">Just Play <span className="demo-indicator">Demo</span></span>
      <p role="status">Finding a quiet branch…</p>
    </main>
  ),
})

export default function DemoLoader() {
  return <DemoApp />
}
