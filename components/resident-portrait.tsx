"use client"

import Image from "next/image"
import { Resident, Game } from "@/lib/types"

interface ResidentPortraitProps {
  resident: Resident
  game?: Game
  reduceMotion?: boolean
}

export function ResidentPortrait({
  resident,
  game,
  reduceMotion,
}: ResidentPortraitProps) {
  const arrivedDate = new Date(resident.arrived_at)
  const formatted = arrivedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="bg-[#2C2F33] rounded-lg p-4 border border-[#484C54]">
      {game ? (
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <Image
              src={game.header_image}
              alt={game.name}
              width={64}
              height={64}
              className="rounded object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-[#DCDDDE] truncate">{game.name}</h3>
            <p className="text-xs text-[#72767D] mt-1">
              Arrived {formatted}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-16 h-16 rounded bg-[#484C54]" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-[#484C54] rounded" />
            <p className="text-xs text-[#72767D] mt-3">
              Arrived {formatted}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
