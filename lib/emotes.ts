export const EMOTES = ["wave", "celebrate", "rest", "check_in"] as const
export type EmoteKind = (typeof EMOTES)[number]

export const EMOTE_LABELS: Record<EmoteKind, string> = {
  wave: "Wave",
  celebrate: "Celebrate",
  rest: "Rest",
  check_in: "Check in",
}

// Draft lines, pending the owner's approval. Plain, never about need, guilt or time away.
export const EMOTE_LINES: Record<EmoteKind, readonly string[]> = {
  wave: [
    "A wave back.",
    "Hello again.",
    "Good to see you.",
  ],
  celebrate: [
    "Nicely done.",
    "That was a good one.",
    "Worth a cheer.",
  ],
  rest: [
    "You sit together for a while.",
    "It's quiet, and that's fine.",
    "No hurry here.",
  ],
  check_in: [
    "Doing all right.",
    "Comfortable, thanks for asking.",
    "Things are calm.",
  ],
}

export function isEmote(value: string): value is EmoteKind {
  return (EMOTES as readonly string[]).includes(value)
}

// Same resident and emote always give the same line.
export function pickEmoteLine(gameId: string, emote: EmoteKind): string {
  let hash = 0
  for (const ch of `${gameId}:${emote}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const lines = EMOTE_LINES[emote]
  return lines[hash % lines.length]
}
