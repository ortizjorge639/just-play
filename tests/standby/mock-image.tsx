import type { CSSProperties } from "react"

export default function MockImage({ alt, className, fill }: { alt: string; className?: string; fill?: boolean }) {
  const style: CSSProperties = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}
  return <svg role="img" aria-label={alt || undefined} className={className} style={style} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="art"><stop stopColor="#243b55" /><stop offset="1" stopColor="#141e30" /></linearGradient></defs>
    <rect width="800" height="600" fill="url(#art)" /><circle cx="550" cy="160" r="80" fill="#e9be78" />
    <path d="M0 600 250 160 430 440 600 280 800 600Z" fill="#142c2c" />
  </svg>
}
