-- Migration 011: Opinion reports
-- Users can flag a community opinion for moderation review.

CREATE TABLE opinion_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_id  UUID NOT NULL REFERENCES dupe_opinions(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('spam', 'inaccurate', 'offensive', 'other')),
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One report per user per opinion
  UNIQUE (opinion_id, reporter_id)
);

ALTER TABLE opinion_reports ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can submit a report
CREATE POLICY "Users can insert their own reports"
  ON opinion_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Users can see their own reports (so we can show "already reported")
CREATE POLICY "Users can read their own reports"
  ON opinion_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Admins and moderators can read all reports
CREATE POLICY "Admins can read all reports"
  ON opinion_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'moderator')
    )
  );

-- Admins and moderators can update report status
CREATE POLICY "Admins can update reports"
  ON opinion_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'moderator')
    )
  );

-- Index for admin review queue
CREATE INDEX opinion_reports_status_idx ON opinion_reports (status, created_at);
CREATE INDEX opinion_reports_opinion_idx ON opinion_reports (opinion_id);
