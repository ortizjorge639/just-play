"use client"

import Image from "next/image"
import { Resident, Game } from "@/lib/types"

interface ResidentPortraitProps {
  resident: Resident
}

export function ResidentPortrait({ resident }: ResidentPortraitProps) {
  const arrivedDate = new Date(resident.arrived_at)
  const formatted = arrivedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      {resident.game ? (
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <Image
              src={resident.game.header_image}
              alt=""
              width={64}
              height={64}
              className="rounded object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground line-clamp-2">{resident.game.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Arrived {formatted}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-16 h-16 rounded bg-muted" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-muted rounded" />
            <p className="text-xs text-muted-foreground mt-3">
              Arrived {formatted}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
