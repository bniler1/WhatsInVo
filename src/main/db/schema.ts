import type { Database } from 'sql.js'

export function createTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_id       TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL DEFAULT '',
      push_name   TEXT NOT NULL DEFAULT '',
      phone       TEXT NOT NULL DEFAULT '',
      avatar_path TEXT,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_id                TEXT NOT NULL UNIQUE,
      name                 TEXT NOT NULL DEFAULT '',
      contact_id           INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      is_group             INTEGER NOT NULL DEFAULT 0,
      last_message_at      INTEGER,
      last_message_preview TEXT DEFAULT '',
      unread_count         INTEGER NOT NULL DEFAULT 0,
      synced_at            TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS media (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id    INTEGER NOT NULL,
      file_path     TEXT NOT NULL,
      mime_type     TEXT NOT NULL DEFAULT '',
      file_size     INTEGER NOT NULL DEFAULT 0,
      original_name TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id       INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      wa_message_id TEXT NOT NULL UNIQUE,
      timestamp     INTEGER NOT NULL,
      sender_wa_id  TEXT NOT NULL DEFAULT '',
      sender_name   TEXT NOT NULL DEFAULT '',
      body          TEXT NOT NULL DEFAULT '',
      type          TEXT NOT NULL DEFAULT 'chat',
      direction     TEXT NOT NULL DEFAULT 'incoming',
      has_media     INTEGER NOT NULL DEFAULT 0,
      media_id      INTEGER REFERENCES media(id) ON DELETE SET NULL,
      caption       TEXT DEFAULT '',
      filename      TEXT DEFAULT '',
      mime_type     TEXT DEFAULT '',
      is_deleted    INTEGER NOT NULL DEFAULT 0,
      deleted_at    TEXT DEFAULT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id                INTEGER PRIMARY KEY CHECK (id = 1),
      last_full_sync_at TEXT DEFAULT NULL,
      status            TEXT NOT NULL DEFAULT 'idle'
    )
  `)

  db.run(`INSERT OR IGNORE INTO sync_state (id, status) VALUES (1, 'idle')`)

  // Migrations: safe no-op if columns already exist
  try { db.run(`ALTER TABLE chats ADD COLUMN is_imported INTEGER NOT NULL DEFAULT 0`) } catch {}
  try { db.run(`ALTER TABLE chats ADD COLUMN cleared_at  TEXT DEFAULT NULL`) } catch {}
  // Fix: v1.07 name-match incorrectly set is_imported=1 on live chats — reset them
  db.run(`UPDATE chats SET is_imported = 0 WHERE is_imported = 1 AND wa_id NOT LIKE 'import:%'`)

  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id   ON messages(chat_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_chats_last_msg     ON chats(last_message_at DESC)`)
}
