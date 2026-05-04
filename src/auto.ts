import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readJson, writeJson } from "./json.js";

const HOME = homedir();
const MARKER = "# recall-managed";
const MD_MARKER = "<!-- recall-managed -->";

// claude code: UserPromptSubmit hook fires before the model sees the prompt.
// anything we print to stdout shows up in the model's context for that turn.
const CC_SETTINGS = join(HOME, ".claude", "settings.json");

// cursor: ~/.cursor/rules/*.mdc files get loaded as system context every prompt.
// no stdin hook, so we have to nudge the model into calling recall_search.
const CURSOR_RULES_DIR = join(HOME, ".cursor", "rules");

// codex / generic agents.md: marker-delimited block at the user-level agents.md
// if it exists. anything that respects agents.md will pick this up.
const HOME_AGENTS_MD = join(HOME, ".agents", "AGENTS.md");

export interface AutoTarget {
  id: string;
  name: string;
  describe(): string;
}

export const AUTO_TARGETS: AutoTarget[] = [
  { id: "claude-code", name: "Claude Code", describe: () => `UserPromptSubmit hook in ${CC_SETTINGS}` },
  { id: "cursor",      name: "Cursor",      describe: () => `user rule at ${join(CURSOR_RULES_DIR, "recall.mdc")}` },
  { id: "agents-md",   name: "AGENTS.md",   describe: () => `recall block in ${HOME_AGENTS_MD}` },
];

// claude code hook: stdin (the hook event) goes into recall inject, recall
// writes top memories to stdout, claude code merges that into the model context.
function ccHookCmd(recallBin: string) { return `${recallBin} inject  ${MARKER}`; }

const isRecallEntry = (h: any) =>
  Array.isArray(h?.hooks) && h.hooks.some((x: any) => typeof x?.command === "string" && x.command.includes(MARKER));

export function installClaudeCode(recallBin: string): boolean {
  const json = readJson(CC_SETTINGS);
  json.hooks ??= {};
  json.hooks.UserPromptSubmit ??= [];
  if (json.hooks.UserPromptSubmit.some(isRecallEntry)) return false;
  json.hooks.UserPromptSubmit.push({
    matcher: "*",
    hooks: [{ type: "command", command: ccHookCmd(recallBin) }],
  });
  writeJson(CC_SETTINGS, json);
  return true;
}

export function uninstallClaudeCode(): boolean {
  const json = readJson(CC_SETTINGS);
  if (!Array.isArray(json?.hooks?.UserPromptSubmit)) return false;
  const before = json.hooks.UserPromptSubmit.length;
  json.hooks.UserPromptSubmit = json.hooks.UserPromptSubmit.filter((h: any) => !isRecallEntry(h));
  if (json.hooks.UserPromptSubmit.length === before) return false;
  writeJson(CC_SETTINGS, json);
  return true;
}

// cursor rule. alwaysApply:true so it loads on every prompt without a keyword
// match. kept short on purpose, long rules get tuned out by the model.
const CURSOR_RULE = `---
description: shared memory across every ai agent on this mac, via recall
alwaysApply: true
---

you have an mcp tool called recall_search. it returns memories the user saved
in any agent on this machine (claude code, claude desktop, cursor, windsurf,
zed). they're often relevant.

before answering anything project-specific or "do you remember…", call
recall_search with a short query (3-6 words) from the user's message. add
project="all" if the question doesn't seem repo-specific. cite ids like #42
when you use a memory.

after the user states a stable preference or decision, call recall_save with
one sentence. skip transient stuff like "currently editing foo.ts".

if recall_search returns nothing useful, just answer normally.
`;

export function installCursor(): boolean {
  const file = join(CURSOR_RULES_DIR, "recall.mdc");
  mkdirSync(CURSOR_RULES_DIR, { recursive: true });
  if (existsSync(file) && readFileSync(file, "utf8").includes("alwaysApply: true")) return false;
  writeFileSync(file, CURSOR_RULE);
  return true;
}

export function uninstallCursor(): boolean {
  const file = join(CURSOR_RULES_DIR, "recall.mdc");
  if (!existsSync(file)) return false;
  // only clear if it looks like ours.
  const content = readFileSync(file, "utf8");
  if (!content.includes("recall_search")) return false;
  writeFileSync(file, ""); // empty instead of unlink, keeps permissions / inode.
  return true;
}

// agents.md block. detect by marker, replace if present, append otherwise.
const agentsBlock = (project: string) => `${MD_MARKER}
## recall

there's a local mcp server called recall that holds memories shared across every
ai agent on this machine (current project: \`${project}\`).

before answering project-specific or "do you remember…" questions, call
\`recall_search\` with a short query. after a stable preference or decision, call
\`recall_save\` with one sentence. that's it.
${MD_MARKER}`;

export function installAgentsMd(path: string, project: string): boolean {
  mkdirSync(dirname(path), { recursive: true });
  const block = agentsBlock(project);
  if (!existsSync(path)) {
    writeFileSync(path, block + "\n");
    return true;
  }
  const current = readFileSync(path, "utf8");
  if (current.includes(MD_MARKER)) {
    const updated = current.replace(new RegExp(`${MD_MARKER}[\\s\\S]*?${MD_MARKER}`), block);
    if (updated === current) return false;
    writeFileSync(path, updated);
    return true;
  }
  writeFileSync(path, current.trimEnd() + "\n\n" + block + "\n");
  return true;
}

export function uninstallAgentsMd(path: string): boolean {
  if (!existsSync(path)) return false;
  const current = readFileSync(path, "utf8");
  if (!current.includes(MD_MARKER)) return false;
  const updated = current.replace(new RegExp(`${MD_MARKER}[\\s\\S]*?${MD_MARKER}\\n*`), "").trimEnd() + "\n";
  writeFileSync(path, updated);
  return true;
}

// status checks (for `recall doctor`).
export function isClaudeCodeAuto(): boolean {
  try { return readJson(CC_SETTINGS)?.hooks?.UserPromptSubmit?.some?.(isRecallEntry) ?? false; } catch { return false; }
}
export function isCursorAuto(): boolean {
  const file = join(CURSOR_RULES_DIR, "recall.mdc");
  if (!existsSync(file)) return false;
  return readFileSync(file, "utf8").includes("recall_search");
}
export function isAgentsMdAuto(path: string): boolean {
  if (!existsSync(path)) return false;
  return readFileSync(path, "utf8").includes(MD_MARKER);
}

export const AGENTS_MD_PATH = HOME_AGENTS_MD;
