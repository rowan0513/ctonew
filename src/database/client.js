const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { getEnv } = require('../config/env');

let dbInstance;

const resolveDatabasePath = (databaseUrl) => {
  if (databaseUrl === ':memory:') {
    return ':memory:';
  }

  if (path.isAbsolute(databaseUrl)) {
    return databaseUrl;
  }

  return path.join(process.cwd(), databaseUrl);
};

const getDb = () => {
  if (dbInstance) {
    return dbInstance;
  }

  const { DATABASE_URL } = getEnv();
  const databasePath = resolveDatabasePath(DATABASE_URL);

  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  dbInstance = new Database(databasePath);
  dbInstance.pragma('foreign_keys = ON');
  try {
    dbInstance.pragma('journal_mode = WAL');
  } catch (error) {
    // ignore if not supported (e.g., :memory: databases)
  }

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      description TEXT,
      expected_mime_type TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      hash TEXT,
      s3_bucket TEXT NOT NULL,
      s3_key TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata TEXT,
      normalized_text TEXT,
      issues TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return dbInstance;
};

const resetDatabase = () => {
  const db = getDb();
  db.exec('DELETE FROM documents;');
};

module.exports = {
  getDb,
  resetDatabase
};
