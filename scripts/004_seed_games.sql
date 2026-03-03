-- Seed 8 test games for Phase 1 MVP
INSERT INTO public.games (id, name, genres, estimated_session_length, header_image, description, source) VALUES
  ('hades', 'Hades', ARRAY['roguelike','action','indie'], 40, '/images/games/hades.jpg', 'Defy the god of the dead as you hack and slash your way out of the Underworld.', 'test'),
  ('stardew-valley', 'Stardew Valley', ARRAY['farming','simulation','relaxing'], 60, '/images/games/stardew.jpg', 'Build the farm of your dreams in this charming countryside RPG.', 'test'),
  ('celeste', 'Celeste', ARRAY['platformer','indie','challenging'], 30, '/images/games/celeste.jpg', 'Help Madeline survive her inner demons on her journey to the top of Celeste Mountain.', 'test'),
  ('slay-the-spire', 'Slay the Spire', ARRAY['roguelike','card-game','strategy'], 60, '/images/games/slay-the-spire.jpg', 'Craft a unique deck, encounter bizarre creatures, and discover relics of immense power.', 'test'),
  ('hollow-knight', 'Hollow Knight', ARRAY['metroidvania','action','atmospheric'], 60, '/images/games/hollow-knight.jpg', 'Descend into the vast, ruined kingdom of Hallownest and uncover ancient mysteries.', 'test'),
  ('animal-crossing', 'Animal Crossing', ARRAY['simulation','relaxing','social'], 30, '/images/games/animal-crossing.jpg', 'Escape to a deserted island and create your own paradise.', 'test'),
  ('dead-cells', 'Dead Cells', ARRAY['roguelike','action','metroidvania'], 30, '/images/games/dead-cells.jpg', 'Explore an ever-changing castle in this brutal but fair action platformer.', 'test'),
  ('civ6', 'Civilization VI', ARRAY['strategy','turn-based','4x'], 120, '/images/games/civ6.jpg', 'Build an empire to stand the test of time in this epic turn-based strategy game.', 'test')
ON CONFLICT (id) DO NOTHING;
