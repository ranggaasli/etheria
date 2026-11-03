-- Run once in the Supabase SQL editor AFTER 001_initial.sql.
-- Use the database owner connection on the Node server. No service key in client.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','sessions','characters','inventory','farming_plots','furniture_placements','quest_progress','guilds','guild_members','dungeon_completions','reports'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',t);
  END LOOP;
END $$;
