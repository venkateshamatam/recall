import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readJson, writeJson } from "./json.js";

const HOME = homedir();
const MARKER = "# recall-managed";
const MD_MARKER = "<!-- recall-managed -->";

// claude code: UserPromptSubmit hook fires before the model sees the prompt.
// what we write to stdout gets injected as context — pure invisible memory.
const CC_SETTINGS = join(HOME, ".claude", "settings.json");

// cursor: rules under ~/.cursor/rules/ get loaded as system context every prompt.
// we write a tiny rule that shells out to recall when the user asks something
// memory-shaped. the agent still has to decide, but the rule nudges it hard.
const CURSOR_RULES_DIR = join(HOME, ".cursor", "rules");

// codex / generic: AGENTS.md is the cross-agent spec. we add a recall-managed
// block so codex (and any AGENTS.md-aware tool) sees recall context per project.
const HOME_AGENTS_MD = join(HOME, ".agents", "AGENTS.md"); // user-level if present

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

// claude code hook: pipe stdin → recall inject → stdout merges into model context.
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

// cursor rule: an .mdc file under ~/.cursor/rules/. cursor loads these as
// system context, so the rule itself becomes part of every prompt. we use
// `alwaysApply: true` so cursor injects it without keyword matching.
const CURSOR_RULE = `---
description: cross-agent memory via recall
alwaysApply: true
---

you have access to a local "recall" mcp server with shared memory across every
ai agent on this machine (claude code, cursor, claude desktop, windsurf, zed).

before answering anything project-specific, personal, or "remember when…":
  1. call \`recall_search\` with a 3-6 word query distilled from the user's message.
  2. pass \`project="all"\` if the question crosses projects, otherwise leave it.
  3. weave the memories into your answer; cite ids like #42 when relevant.

after saving anything stable (a decision, a preference, a constraint):
  - call \`recall_save\` with one tight sentence.
  - skip transient state (file paths in flux, in-progress thinking).
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
  // only delete if it looks like ours.
  const content = readFileSync(file, "utf8");
  if (!content.includes("cross-agent memory via recall")) return false;
  writeFileSync(file, ""); // empty it instead of unlink — preserve permissions/inode.
  return true;
}

// AGENTS.md: append a recall-managed block. idempotent: detect by marker, replace
// the block if found, append if not.
const agentsBlock = (project: string) => `${MD_MARKER}
## recall — cross-agent memory

you have access to a local recall mcp server. before answering anything personal
or project-specific (project: \`${project}\`), call \`recall_search\` with a tight
query. after a stable decision or preference, call \`recall_save\`. memories are
shared across every mcp-capable agent on this machine.
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
  return readFileSync(file, "utf8").includes("cross-agent memory via recall");
}
export function isAgentsMdAuto(path: string): boolean {
  if (!existsSync(path)) return false;
  return readFileSync(path, "utf8").includes(MD_MARKER);
}

export const AGENTS_MD_PATH = HOME_AGENTS_MD;
