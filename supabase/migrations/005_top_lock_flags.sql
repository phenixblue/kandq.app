-- Explicit lock flags for admin top-of-day selections.
-- This separates automatic daily/history updates from admin vote-lock decisions.

ALTER TABLE color_history
  ADD COLUMN IF NOT EXISTS photo_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reason_locked BOOLEAN NOT NULL DEFAULT false;
