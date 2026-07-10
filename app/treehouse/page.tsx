import { getCompletedGamesForTreehouse } from '@/lib/treehouse';
import TreehouseClient from './treehouse-client';

export default async function TreehousePage() {
  const games = await getCompletedGamesForTreehouse();
  return <TreehouseClient games={games} />;
}
