ALTER TABLE report_items
  ADD COLUMN position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0);

CREATE UNIQUE INDEX report_items_report_category_position_idx
  ON report_items (report_id, category, position);
