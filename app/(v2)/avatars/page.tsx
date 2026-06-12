"use client"

import { CartridgeAvatar } from "@/components/cartridge-avatar"

const GAMES = [
  { title: "Elden Ring",     gradient: "linear-gradient(135deg,#3D1A8E,#8B2FC9,#FFD700)" },
  { title: "Zelda TOTK",    gradient: "linear-gradient(135deg,#1A4731,#2D7A4F,#F59E0B)" },
  { title: "Hollow Knight", gradient: "linear-gradient(135deg,#1565C0,#42A5F5,#FDD835)" },
  { title: "Hades II",      gradient: "linear-gradient(135deg,#1A0A0A,#6B1414,#CC0000)" },
  { title: "Disco Elysium", gradient: "linear-gradient(135deg,#0D1B2A,#1B4F8A,#00D4FF)" },
  { title: "Dead Cells",    gradient: "linear-gradient(135deg,#6B3A1F,#B85A2C,#F59E0B)" },
  { title: "Stardew",       gradient: "linear-gradient(135deg,#1B5E20,#43A047,#A5D6A7)" },
  { title: "Celeste",       gradient: "linear-gradient(135deg,#880E4F,#E91E63,#F48FB1)" },
]

export default function AvatarsPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#1A1A2E",
      display: "flex", flexDirection: "column",
      alignItems: "center", padding: "32px 16px"
    }}>
      <h1 style={{
        fontFamily: "Space Grotesk, sans-serif", fontWeight: 700,
        fontSize: 24, color: "white", marginBottom: 8
      }}>Meet the Crew</h1>
      <p style={{
        fontFamily: "Nunito, sans-serif", fontSize: 14,
        color: "#9CA3AF", marginBottom: 32
      }}>every game you finish lives here forever</p>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: "24px 16px", maxWidth: 360
      }}>
        {GAMES.map((g) => (
          <div key={g.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <CartridgeAvatar
              gradient={g.gradient}
              title={g.title}
              animated={true}
              size={0.9}
            />
            <span style={{
              fontFamily: "Nunito, sans-serif", fontWeight: 700,
              fontSize: 10, color: "#9CA3AF", textAlign: "center"
            }}>{g.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
