-- Track booster pack openings for rate limiting (3 per day)
CREATE TABLE IF NOT EXISTS public.booster_pack_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  opened_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.booster_pack_opens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pack opens
CREATE POLICY "Users can view own pack opens" ON public.booster_pack_opens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own pack opens
CREATE POLICY "Users can insert own pack opens" ON public.booster_pack_opens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
