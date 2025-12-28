-- Add KOT tracking columns to table_sessions
-- kot_records: JSON array of KOT records for tracking multiple KOTs per table
-- last_kot_printed_at: Timestamp of the last KOT print

ALTER TABLE table_sessions ADD COLUMN kot_records TEXT;
ALTER TABLE table_sessions ADD COLUMN last_kot_printed_at TEXT;
