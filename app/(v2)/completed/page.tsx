import { getCompletedGamesForTreehouse } from '@/lib/treehouse';
import CompletedClient from './completed-client';

export default async function CompletedPage() {
  const games = await getCompletedGamesForTreehouse();
  return <CompletedClient games={games} />;
}
