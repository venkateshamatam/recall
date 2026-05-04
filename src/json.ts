import { existsSync, readFileSync, writeFileSync } from "node:fs";

// shared json read/write. configure() and installHook() throw on parse failure
// on purpose — never clobber a config we can't understand.
export const readJson = (path: string): any =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8").trim() || "{}") : {};

export const writeJson = (path: string, json: any) =>
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");

// safe variant for read-only checks (doctor, isConfigured) — silent on parse fail.
export const tryReadJson = (path: string): any => {
  try { return readJson(path); } catch { return null; }
};
