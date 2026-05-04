import { existsSync, readFileSync, writeFileSync } from "node:fs";

// shared json read/write. configure() and installHook() throw on parse failure
// on purpose — never clobber a config we can't understand. zed/vscode ship
// settings as jsonc, so strip line + block comments before JSON.parse.
export const readJson = (path: string): any =>
  existsSync(path) ? JSON.parse(stripComments(readFileSync(path, "utf8")).trim() || "{}") : {};

export const writeJson = (path: string, json: any) =>
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");

// safe variant for read-only checks (doctor, isConfigured) — silent on parse fail.
export const tryReadJson = (path: string): any => {
  try { return readJson(path); } catch { return null; }
};

// strip // line comments and /* */ block comments while leaving them alone
// inside string literals. small state machine, no regex backtracking pain.
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let inString: '"' | "'" | null = null;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < src.length) { out += src[i + 1]; i += 2; continue; }
      if (c === inString) inString = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { inString = c; out += c; i++; continue; }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
