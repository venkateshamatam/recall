import { embed } from "./embeddings.js";
import { embeddingBlob, openDb, type Memory } from "./db.js";
import { currentProject } from "./project.js";

// pass project="all" to query the global pool.
const ALL = "all";
const resolveProject = (p?: string) => (p === ALL ? undefined : (p ?? currentProject()));

// write text + vector together so ids can't drift.
export async function saveMemory(content: string, project?: string): Promise<Memory> {
  const text = content.trim();
  if (!text) throw new Error("content is required");
  const proj = project ?? currentProject();
  const vec = await embed(text);
  const now = new Date().toISOString();
  const db = openDb();

  const insertMem = db.prepare("INSERT INTO memories (content, project, created_at) VALUES (?, ?, ?)");
  const insertVec = db.prepare("INSERT INTO memories_vec (rowid, embedding) VALUES (?, ?)");
  const selectOne = db.prepare("SELECT * FROM memories WHERE id = ?");

  const tx = db.transaction(() => {
    const r = insertMem.run(text, proj, now);
    // sqlite-vec rowids are bigint-only here.
    const rid = typeof r.lastInsertRowid === "bigint" ? r.lastInsertRowid : BigInt(r.lastInsertRowid);
    insertVec.run(rid, embeddingBlob(vec));
    return Number(rid);
  });
  return selectOne.get(tx()) as Memory;
}

export interface SearchResult extends Memory { score: number }

export async function searchMemories(query: string, limit = 10, project?: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const vec = await embed(q);
  const proj = resolveProject(project);
  // sqlite-vec's MATCH does global knn first, so a project filter would starve
  // when another project dominates the top-k. when scoping to a project,
  // restrict the inner candidate set to that project's memories explicitly.
  const blob = embeddingBlob(vec);
  const rows = proj
    ? openDb().prepare(`
        SELECT m.*, v.distance AS distance
        FROM memories_vec v JOIN memories m ON m.id = v.rowid
        WHERE v.embedding MATCH ? AND k = ? AND m.project = ?
        ORDER BY v.distance
      `).all(blob, Math.max(limit * 10, 100), proj)
    : openDb().prepare(`
        SELECT m.*, v.distance AS distance
        FROM memories_vec v JOIN memories m ON m.id = v.rowid
        WHERE v.embedding MATCH ? AND k = ?
        ORDER BY v.distance
      `).all(blob, limit);

  // sqlite-vec returns plain euclidean l2; for unit vectors cosine = 1 - l2² / 2.
  return (rows as (Memory & { distance: number })[])
    .map(({ distance, ...m }) => ({ ...m, score: Math.max(0, Math.min(1, 1 - (distance * distance) / 2)) }))
    .slice(0, limit);
}

export function listMemories(limit = 20, project?: string): Memory[] {
  const proj = resolveProject(project);
  const sql = proj
    ? "SELECT * FROM memories WHERE project = ? ORDER BY created_at DESC LIMIT ?"
    : "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?";
  const stmt = openDb().prepare(sql);
  return (proj ? stmt.all(proj, limit) : stmt.all(limit)) as Memory[];
}

export const getMemory = (id: number): Memory | null =>
  (openDb().prepare("SELECT * FROM memories WHERE id = ?").get(id) as Memory | undefined) ?? null;

export function deleteMemory(id: number): boolean {
  const db = openDb();
  const tx = db.transaction((mid: number) => {
    db.prepare("DELETE FROM memories_vec WHERE rowid = ?").run(mid);
    return db.prepare("DELETE FROM memories WHERE id = ?").run(mid);
  });
  return tx(id).changes > 0;
}

export const memoryCount = (): number =>
  (openDb().prepare("SELECT COUNT(*) as c FROM memories").get() as { c: number }).c;
