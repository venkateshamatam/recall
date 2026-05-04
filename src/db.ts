import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { dbPath, ensureHome } from "./paths.js";

export const EMBEDDING_DIM = 384;

export interface Memory {
  id: number;
  content: string;
  project: string | null;
  created_at: string;
}

let cached: Database.Database | null = null;

// one sqlite handle per process.
export function openDb() {
  if (cached) return cached;
  ensureHome();
  const db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  sqliteVec.load(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      project TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_vec USING vec0(embedding float[${EMBEDDING_DIM}]);
  `);
  cached = db;
  return db;
}

// sqlite-vec wants the raw float buffer.
export const embeddingBlob = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength);

export function closeDb() {
  cached?.close();
  cached = null;
}
