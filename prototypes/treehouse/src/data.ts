export type Status = "backlog" | "playing" | "completed";
export type Kind = "fox" | "bunny" | "bear" | "bird" | "cat" | "frog";
export type View = "treehouse" | "backlog" | "playing";

export interface Game {
  id: string;
  title: string;
  genre: string;
  kind: Kind;
  color: string;
  accent: string;
  resident: string;
  note: string;
  status: Status;
  minutes: number;
  goal: number;
}

export interface Save {
  version: 1;
  games: Game[];
  session: { gameId: string; startedAt: number } | null;
}

export const SAVE_KEY = "just-play:cozy-treehouse:v1";
export const SAMPLE_GAMES: Game[] = [
  { id: "hike", title: "A Short Hike", genre: "A little adventure", kind: "bird", color: "#cf9970", accent: "#eeb749", resident: "Pip", note: "Found a good spot. Staying a while.", status: "completed", minutes: 240, goal: 25 },
  { id: "stardew", title: "Stardew Valley", genre: "Life at your own pace", kind: "frog", color: "#89ab75", accent: "#ddb267", resident: "Moss", note: "The tomatoes can wait. Come sit.", status: "completed", minutes: 4260, goal: 25 },
  { id: "celeste", title: "Celeste", genre: "One more little climb", kind: "bunny", color: "#dc9b8e", accent: "#758fb8", resident: "Clover", note: "One step at a time got me here.", status: "completed", minutes: 720, goal: 25 },
  { id: "hollow", title: "Hollow Knight", genre: "An underground adventure", kind: "cat", color: "#a0acbf", accent: "#5f778d", resident: "Pebble", note: "Even explorers need a quiet corner.", status: "completed", minutes: 1680, goal: 25 },
  { id: "spirit", title: "Spiritfarer", genre: "A gentle farewell", kind: "fox", color: "#dca471", accent: "#729d8c", resident: "Maple", note: "Every goodbye leaves a little love.", status: "playing", minutes: 485, goal: 25 },
  { id: "tunic", title: "TUNIC", genre: "A pocket-sized adventure", kind: "fox", color: "#cc9565", accent: "#81a181", resident: "Fern", note: "Brought my map. And some snacks.", status: "backlog", minutes: 0, goal: 25 },
  { id: "unpacking", title: "Unpacking", genre: "Find a place for everything", kind: "bear", color: "#bb93a4", accent: "#dfb883", resident: "Button", note: "Home is all the little things.", status: "backlog", minutes: 0, goal: 25 },
  { id: "night", title: "Night in the Woods", genre: "Old friends, new stories", kind: "cat", color: "#7a91ab", accent: "#ca8e71", resident: "Acorn", note: "Nothing much. Everything, really.", status: "backlog", minutes: 0, goal: 25 },
  { id: "chicory", title: "Chicory", genre: "Make a little color", kind: "bunny", color: "#d8bb75", accent: "#bc8d93", resident: "Doodle", note: "Made you something. It's a leaf.", status: "backlog", minutes: 0, goal: 25 },
];

const validStatus = new Set(["backlog", "playing", "completed"]);
const validKinds = new Set(["fox", "bunny", "bear", "bird", "cat", "frog"]);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 180;
const isColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function isSave(value: unknown): value is Save {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("games" in value) || !Array.isArray(value.games) || value.games.length > 100 || !("session" in value)) return false;
  if (!value.games.every((g: unknown) => {
    if (!g || typeof g !== "object") return false;
    const game = g as Record<string, unknown>;
    return ["id", "title", "genre", "resident", "note"].every(key => isText(game[key]))
      && typeof game.status === "string" && validStatus.has(game.status)
      && typeof game.kind === "string" && validKinds.has(game.kind)
      && isColor(game.color) && isColor(game.accent)
      && isNumber(game.minutes) && isNumber(game.goal) && game.goal >= 5 && game.goal <= 120;
  })) return false;
  if (new Set(value.games.map((g: Game) => g.id)).size !== value.games.length) return false;
  if (value.session === null) return true;
  if (typeof value.session !== "object" || !("gameId" in value.session) || !("startedAt" in value.session)) return false;
  const session = value.session;
  return isNumber(session.startedAt) && session.startedAt <= Date.now()
    && value.games.some((g: Game) => g.id === session.gameId && g.status === "playing");
}

export function loadSave(): { save: Save; error: string | null } {
  const fallback: Save = { version: 1, games: SAMPLE_GAMES, session: null };
  const unreadable = "Your saved prototype data couldn't be read. The sample library is shown; the saved data hasn't been changed.";
  let text: string | null;
  try {
    text = localStorage.getItem(SAVE_KEY);
  } catch (error) {
    console.warn("Treehouse: unable to read local save", error);
    return { save: fallback, error: "Local saving isn't available. You can explore, but changes may not survive a reload." };
  }
  if (!text) return { save: fallback, error: null };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.warn("Treehouse: saved data is not valid JSON", error);
    return { save: fallback, error: unreadable };
  }
  if (!isSave(value)) return { save: fallback, error: unreadable };
  return { save: value, error: null };
}

export function minutesLabel(minutes: number) {
  return minutes < 60 ? `${Math.floor(minutes)} min` : `${Math.floor(minutes / 60)}h${minutes % 60 >= 1 ? ` ${Math.floor(minutes % 60)}m` : ""}`;
}
