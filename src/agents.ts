import { existsSync, lstatSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readJson, tryReadJson, writeJson } from "./json.js";

const HOME = homedir();
const APP_SUPPORT = join(HOME, "Library", "Application Support");

// claude code is the odd one — config is ~/.claude.json (file), data lives in ~/.claude/.
// every other agent has the config under its install dir.
export interface Agent {
  id: string;
  name: string;
  configPath: string;
  serverKey: "mcpServers" | "context_servers";
  installRoot?: string;
}

export const AGENTS: Agent[] = [
  { id: "claude-desktop", name: "Claude Desktop", configPath: join(APP_SUPPORT, "Claude", "claude_desktop_config.json"), serverKey: "mcpServers" },
  { id: "claude-code",    name: "Claude Code",    configPath: join(HOME, ".claude.json"),                                serverKey: "mcpServers", installRoot: join(HOME, ".claude") },
  { id: "cursor",         name: "Cursor",         configPath: join(HOME, ".cursor", "mcp.json"),                         serverKey: "mcpServers" },
  { id: "windsurf",       name: "Windsurf",       configPath: join(HOME, ".codeium", "windsurf", "mcp_config.json"),     serverKey: "mcpServers" },
  { id: "zed",            name: "Zed",            configPath: join(HOME, ".config", "zed", "settings.json"),             serverKey: "context_servers" },
];

export const findAgent = (id: string) => AGENTS.find((a) => a.id === id);
export const installRoot = (a: Agent) => a.installRoot ?? dirname(a.configPath);
export const isInstalled = (a: Agent) => existsSync(installRoot(a)) || existsSync(a.configPath);
export const detectInstalled = () => AGENTS.filter(isInstalled);
export const isConfigured = (a: Agent) => Boolean(tryReadJson(a.configPath)?.[a.serverKey]?.recall);

// a symlinked config could redirect us into an arbitrary file. don't.
function assertNotSymlink(path: string) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`refusing to follow symlink: ${path}`);
  const parent = dirname(path);
  if (existsSync(parent) && realpathSync(parent) !== parent) throw new Error(`refusing to write through symlinked dir: ${parent}`);
}

// returns { changed, existed } so the caller picks the verb.
export function configure(a: Agent, recallBin: string): { changed: boolean; existed: boolean } {
  assertNotSymlink(a.configPath);
  const existed = existsSync(a.configPath);
  const json = readJson(a.configPath);
  json[a.serverKey] ??= {};
  const desired = { command: recallBin, args: ["server"] };
  if (JSON.stringify(json[a.serverKey].recall) === JSON.stringify(desired)) return { changed: false, existed };
  json[a.serverKey].recall = desired;
  writeJson(a.configPath, json);
  return { changed: true, existed };
}
