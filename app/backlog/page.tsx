import { createClient } from '@/lib/supabase/server';
import BacklogClient, { type BacklogEntry } from './backlog-client';

export default async function BacklogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <BacklogClient entries={[]} />;

  const { data, error } = await supabase
    .from('game_progress')
    .select('*, games(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[backlog] error fetching game progress:', error);
    return <BacklogClient entries={[]} />;
  }

  const order = { playing: 0, beaten: 1, abandoned: 2 } as Record<string, number>;
  const entries: BacklogEntry[] = (data ?? [])
    .filter((gp) => gp.games)
    .map((gp) => ({
      id: gp.id as string,
      title: gp.games.name as string,
      coverUrl: (gp.games.header_image as string) || null,
      genres: (gp.games.genres as string[]) ?? [],
      status: gp.status as BacklogEntry['status'],
    }))
    .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

  return <BacklogClient entries={entries} />;
}
