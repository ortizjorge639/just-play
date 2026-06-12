"use client"

import { motion } from "framer-motion"

interface CartridgeAvatarProps {
  gradient: string
  title: string
  size?: number
  animated?: boolean
  icon?: string
}

export function CartridgeAvatar({
  gradient,
  title,
  size = 1,
  animated = false,
  icon = "★",
}: CartridgeAvatarProps) {
  const w = 56 * size
  const h = 72 * size
  const s = size

  const body = (
    <svg
      width={w + 4 * s}
      height={h + 20 * s}
      viewBox={`0 0 ${60} ${92}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`grad-${title.replace(/\s/g,"")}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6B4FBB" />
          <stop offset="100%" stopColor="#9C27B0" />
        </linearGradient>
        <style>{`
          .cart-body-${title.replace(/\s/g,"")} { fill: url(#grad-${title.replace(/\s/g,"")}); }
        `}</style>
      </defs>

      {/* Top notch */}
      <rect x="20" y="0" width="20" height="8" rx="3"
        className={`cart-body-${title.replace(/\s/g,"")}`}
        stroke="#1A1A1A" strokeWidth="2.5" />

      {/* Main cartridge body */}
      <rect x="2" y="6" width="56" height="62" rx="6"
        className={`cart-body-${title.replace(/\s/g,"")}`}
        stroke="#1A1A1A" strokeWidth="2.5" />

      {/* Label face */}
      <rect x="8" y="14" width="44" height="36" rx="4"
        fill="white" fillOpacity="0.22"
        stroke="#1A1A1A" strokeWidth="1.5" />

      {/* Eyes */}
      <circle cx="22" cy="24" r="4" fill="white" />
      <circle cx="38" cy="24" r="4" fill="white" />
      <circle cx="23" cy="25" r="1.8" fill="#1A1A1A" />
      <circle cx="39" cy="25" r="1.8" fill="#1A1A1A" />
      {/* Eye shine */}
      <circle cx="24" cy="23.5" r="0.8" fill="white" />
      <circle cx="40" cy="23.5" r="0.8" fill="white" />

      {/* Smile */}
      <path d="M22 32 Q30 37 38 32" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" fill="none"/>

      {/* Title on label */}
      <text x="30" y="46" textAnchor="middle"
        fontFamily="Nunito, sans-serif" fontWeight="700" fontSize="7"
        fill="white" opacity="0.95">{title.slice(0, 12)}</text>

      {/* Connector ridge */}
      <rect x="2" y="64" width="56" height="10" rx="0"
        fill="#1A1A1A" fillOpacity="0.5"
        stroke="#1A1A1A" strokeWidth="2" />
      {/* Connector pins */}
      {[10, 16, 22, 28, 34, 40, 46].map((x, i) => (
        <rect key={i} x={x} y="65" width="3" height="8" rx="1" fill="#333" />
      ))}

      {/* Left leg */}
      <rect x="10" y="74" width="12" height="14" rx="3"
        fill="#1A1A1A" fillOpacity="0.7"
        stroke="#1A1A1A" strokeWidth="2" />
      {/* Left shoe */}
      <ellipse cx="16" cy="88" rx="8" ry="5" fill="white" stroke="#1A1A1A" strokeWidth="1.5" />

      {/* Right leg */}
      <rect x="38" y="74" width="12" height="14" rx="3"
        fill="#1A1A1A" fillOpacity="0.7"
        stroke="#1A1A1A" strokeWidth="2" />
      {/* Right shoe */}
      <ellipse cx="44" cy="88" rx="8" ry="5" fill="white" stroke="#1A1A1A" strokeWidth="1.5" />
    </svg>
  )

  if (animated) {
    return (
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}
      >
        {body}
      </motion.div>
    )
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      {body}
    </div>
  )
}
