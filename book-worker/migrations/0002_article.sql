-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT,
    content TEXT,
    summary TEXT,
    status TEXT CHECK(status IN ('processing', 'ready', 'error')) DEFAULT 'processing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
