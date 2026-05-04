import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

// recall_home is test-only; default stays under ~/.recall.
export const recallHome = () => process.env.RECALL_HOME ?? join(homedir(), ".recall");
export const dbPath = () => join(recallHome(), "db.sqlite");
export const modelsDir = () => join(recallHome(), "models");

export function ensureHome() {
  mkdirSync(modelsDir(), { recursive: true });
  return recallHome();
}
