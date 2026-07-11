import { createClient } from '@/lib/supabase/server';
import type { GameData } from '@/components/treehouse-world';

const GENRE_MAP: Record<string, GameData['genre']> = {
  'role-playing': 'rpg', 'rpg': 'rpg', 'role playing': 'rpg',
  'adventure': 'adventure',
  'platform': 'platformer', 'platformer': 'platformer',
  'action': 'action', 'shooter': 'action', 'fighting': 'action',
  'simulation': 'sim', 'sim': 'sim', 'strategy': 'sim',
  'horror': 'horror', 'survival horror': 'horror',
  'music': 'rhythm', 'rhythm': 'rhythm', 'musical': 'rhythm',
};

const GENRE_COLOR: Record<GameData['genre'], string> = {
  rpg: '#6B2FA0',
  adventure: '#1A5C3A',
  platformer: '#1565C0',
  action: '#8B3000',
  sim: '#1B5E20',
  horror: '#3A0A0A',
  rhythm: '#880E4F',
};

function mapGenre(genres: string[]): GameData['genre'] {
  for (const g of genres) {
    const mapped = GENRE_MAP[g.toLowerCase().trim()];
    if (mapped) return mapped;
  }
  return 'action';
}

export async function getCompletedGamesForTreehouse(): Promise<GameData[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('game_progress')
      .select('*, games(*)')
      .eq('user_id', user.id)
      .eq('status', 'beaten')
      .order('completed_at', { ascending: false });

    if (error) {
      // Distinguish "real Supabase/query error" from "user genuinely has zero
      // completed games" -- both used to fall through to the same silent []
      // return, which is indistinguishable from the empty-state UI's
      // perspective but very different operationally. Logging server-side
      // means a misconfigured/unreachable backend shows up in deploy logs
      // instead of just looking like an empty treehouse to every user.
      console.error('[treehouse] game_progress query failed:', error.message ?? error);
      return [];
    }
    if (!data) return [];

    return data.map((gp: any, i: number) => {
      const game = gp.games;
      if (!game) return null;
      const genre = mapGenre(game.genres ?? []);
      return {
        id: i + 1,
        title: game.name,
        genre,
        color: GENRE_COLOR[genre],
        floor: (i >= 7 ? 1 : 0) as 0 | 1,
        coverUrl: game.header_image ?? undefined,
        completedAt: gp.completed_at ?? undefined,
        totalMinutes: gp.total_time_minutes ?? 0,
      } satisfies GameData;
    }).filter(Boolean) as GameData[];
  } catch (err) {
    // Next.js signals dynamic rendering (cookies() usage) by throwing -- that's
    // control flow, not a failure. Let it propagate so Next handles it.
    if ((err as { digest?: string })?.digest === 'DYNAMIC_SERVER_USAGE') throw err;
    // Network failure, auth service down, etc. -- same reasoning as above:
    // log it so it's visible in server logs rather than vanishing silently.
    console.error('[treehouse] unexpected error fetching completed games:', err);
    return [];
  }
}
