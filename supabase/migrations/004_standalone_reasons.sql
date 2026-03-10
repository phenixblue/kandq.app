-- Create standalone reasons table (independent from photos)
CREATE TABLE IF NOT EXISTS reasons (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason_text   TEXT        NOT NULL,
  upvotes       INTEGER     NOT NULL DEFAULT 0,
  downvotes     INTEGER     NOT NULL DEFAULT 0,
  is_valid      BOOLEAN     NOT NULL DEFAULT true,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create separate votes table for standalone reasons
CREATE TABLE IF NOT EXISTS reason_votes_standalone (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID      REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason_id   UUID      REFERENCES reasons(id) ON DELETE CASCADE NOT NULL,
  vote        SMALLINT  NOT NULL CHECK (vote IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, reason_id)
);

-- Enable Row-Level Security
ALTER TABLE reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reason_votes_standalone ENABLE ROW LEVEL SECURITY;

-- Reasons: anyone can read valid reasons
CREATE POLICY "Public read valid reasons"
  ON reasons FOR SELECT
  USING (is_valid = true);

-- Reasons: authenticated users can insert their own reasons
CREATE POLICY "Users insert own reasons"
  ON reasons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Reason votes: anyone can read votes
CREATE POLICY "Public read reason votes standalone"
  ON reason_votes_standalone FOR SELECT
  USING (true);

-- Reason votes: authenticated users can insert their own votes
CREATE POLICY "Users insert own reason votes standalone"
  ON reason_votes_standalone FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Reason votes: users can update their own votes
CREATE POLICY "Users update own reason votes standalone"
  ON reason_votes_standalone FOR UPDATE
  USING (auth.uid() = user_id);

-- Reason votes: users can delete their own votes
CREATE POLICY "Users delete own reason votes standalone"
  ON reason_votes_standalone FOR DELETE
  USING (auth.uid() = user_id);
