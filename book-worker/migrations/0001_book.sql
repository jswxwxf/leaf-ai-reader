-- Migration: book
-- Created at: 2026-04-07

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  author TEXT,
  published_at TEXT,
  cover_r2_key TEXT,
  total_chapters INTEGER,
  root_dir TEXT DEFAULT '',
  status TEXT DEFAULT 'processing', -- processing | ready | error
  created_at INTEGER DEFAULT (unixepoch())
);
