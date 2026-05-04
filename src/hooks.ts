import { homedir } from "node:os";
import { join } from "node:path";
import { readJson, tryReadJson, writeJson } from "./json.js";

const HOME = homedir();

// the marker we stamp into every hook command so we can find ours without
// false-matching on user commands that happen to contain "capture".
const MARKER = "# recall-managed";

// claude code's SessionEnd fires once per session (Stop fires per-turn). docs:
// https://docs.anthropic.com/en/docs/claude-code/hooks
const EVENT = "SessionEnd";

export interface HookTarget {
  id: string;
  name: string;
  configPath: string;
}

export const HOOK_TARGETS: HookTarget[] = [
  { id: "claude-code", name: "Claude Code", configPath: join(HOME, ".claude", "settings.json") },
];

export const findHookTarget = (id: string) => HOOK_TARGETS.find((h) => h.id === id);

const isRecallHook = (h: any) =>
  Array.isArray(h?.hooks) && h.hooks.some((x: any) =>
    typeof x?.command === "string" && x.command.includes(MARKER));

export const isHookInstalled = (t: HookTarget) => {
  const events = tryReadJson(t.configPath)?.hooks?.[EVENT];
  return Array.isArray(events) && events.some(isRecallHook);
};

export function installHook(t: HookTarget, recallBin: string): boolean {
  const json = readJson(t.configPath);
  json.hooks ??= {};
  json.hooks[EVENT] ??= [];
  if (json.hooks[EVENT].some(isRecallHook)) return false;
  json.hooks[EVENT].push({
    matcher: "*",
    hooks: [{ type: "command", command: `${recallBin} capture --agent ${t.id}  ${MARKER}` }],
  });
  writeJson(t.configPath, json);
  return true;
}

export function uninstallHook(t: HookTarget): boolean {
  const json = readJson(t.configPath);
  if (!Array.isArray(json?.hooks?.[EVENT])) return false;
  const before = json.hooks[EVENT].length;
  json.hooks[EVENT] = json.hooks[EVENT].filter((h: any) => !isRecallHook(h));
  if (json.hooks[EVENT].length === before) return false;
  writeJson(t.configPath, json);
  return true;
}
