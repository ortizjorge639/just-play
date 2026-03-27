-- Add featured column for booster pack game selection
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- Mark popular/acclaimed games as featured for booster packs
-- Diverse genres: action, RPG, platformer, strategy, relaxing, adventure
UPDATE public.games SET featured = true WHERE id IN (
  -- Test seed games
  'hades',
  'stardew-valley',
  'celeste',
  'slay-the-spire',
  'hollow-knight',
  'animal-crossing',
  'dead-cells',
  'civ6',
  -- IGDB games
  'igdb-1026',    -- Zelda: A Link to the Past
  'igdb-1103',    -- Super Metroid
  'igdb-119133',  -- Elden Ring
  'igdb-119171',  -- Baldur's Gate III
  'igdb-7346',    -- Zelda: Breath of the Wild
  'igdb-19560',   -- God of War
  'igdb-1627',    -- Super Smash Bros. Melee
  'igdb-119388',  -- Zelda: Tears of the Kingdom
  'igdb-1070',    -- Super Mario World
  'igdb-426'      -- Final Fantasy III (VI)
);
