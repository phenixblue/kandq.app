-- Add reason metadata to photos and color history
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS color_reason TEXT,
  ADD COLUMN IF NOT EXISTS reason_vote_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE color_history
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Separate votes for reasons (independent from color votes)
CREATE TABLE IF NOT EXISTS reason_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, photo_id)
);

ALTER TABLE reason_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reason votes"
  ON reason_votes FOR SELECT
  USING (true);

CREATE POLICY "Users insert own reason votes"
  ON reason_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reason votes"
  ON reason_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own reason votes"
  ON reason_votes FOR DELETE
  USING (auth.uid() = user_id);
