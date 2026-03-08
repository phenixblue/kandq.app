-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Photos table
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  url           TEXT        NOT NULL,
  storage_path  TEXT        NOT NULL,
  king_color    TEXT,
  queen_color   TEXT,
  is_valid      BOOLEAN     NOT NULL DEFAULT true,
  vote_score    INTEGER     NOT NULL DEFAULT 0,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  analyzed_at   TIMESTAMPTZ
);

-- ============================================================
-- Votes table
-- ============================================================
CREATE TABLE IF NOT EXISTS votes (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID      REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_id    UUID      REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  vote        SMALLINT  NOT NULL CHECK (vote IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, photo_id)
);

-- ============================================================
-- Color history table  (one row per day, updated by top-rated photo)
-- ============================================================
CREATE TABLE IF NOT EXISTS color_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE        NOT NULL UNIQUE,
  king_color  TEXT,
  queen_color TEXT,
  photo_id    UUID        REFERENCES photos(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE color_history ENABLE ROW LEVEL SECURITY;

-- Photos: anyone can read valid photos
CREATE POLICY "Public read valid photos"
  ON photos FOR SELECT
  USING (is_valid = true);

-- Photos: authenticated users can insert their own photos
CREATE POLICY "Users insert own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Votes: anyone can read votes
CREATE POLICY "Public read votes"
  ON votes FOR SELECT
  USING (true);

-- Votes: authenticated users can insert their own votes
CREATE POLICY "Users insert own votes"
  ON votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Votes: users can update their own votes
CREATE POLICY "Users update own votes"
  ON votes FOR UPDATE
  USING (auth.uid() = user_id);

-- Votes: users can delete their own votes
CREATE POLICY "Users delete own votes"
  ON votes FOR DELETE
  USING (auth.uid() = user_id);

-- Color history: public read
CREATE POLICY "Public read color history"
  ON color_history FOR SELECT
  USING (true);

-- ============================================================
-- Storage bucket (run via Supabase dashboard or CLI)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('kandq-photos', 'kandq-photos', true)
--   ON CONFLICT DO NOTHING;
