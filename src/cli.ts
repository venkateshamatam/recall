#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const VERSION = "0.2.0";

const HELP = `recall ${VERSION} — magic memory across every agent on your machine

  recall init                       set up ~/.recall/, download embedding model
  recall install [--all|--agent X]  wire recall into mcp clients (claude-desktop|claude-code|cursor|windsurf|zed)
  recall hooks install [--all|--agent X]   auto-capture session ends as memories
  recall hooks uninstall [--all|--agent X]
  recall context [--project X] [--seed Q]  write ~/.recall/context-<project>.md for @-import
  recall setup-prompt               paste-ready installer prompt for any agent
  recall doctor                     verify install + agent + hook status

  recall add <text> [--project X]   save a memory (defaults to current project)
  recall capture [--agent X]        save piped transcript text (used by hooks)
  recall search <q> [-l N] [--all|--project X]
  recall list [-l N] [--all|--project X]
  recall get <id>
  recall delete <id>

  recall server                     start the mcp server
  recall export [<file>]            dump all memories as json
`;

// fast-path: --help / --version run without loading better-sqlite3 / transformers / mcp.
const cmd = process.argv[2];
if (!cmd || cmd === "--help" || cmd === "-h") { console.log(HELP); process.exit(0); }
if (cmd === "--version" || cmd === "-v") { console.log(VERSION); process.exit(0); }
const rest = process.argv.slice(3);

// prefer the launched binary; mcp / hook configs need an absolute path.
const recallBin = () => (process.argv[1] && existsSync(process.argv[1]!) ? process.argv[1]! : "recall");
const die = (msg: string): never => { console.error(msg); process.exit(2); };
const indent = (s: string) => s.split("\n").map((l) => "    " + l).join("\n");

await dispatch(cmd, rest).catch((e) => { console.error(`error: ${(e as Error).message}`); process.exit(1); });

async function dispatch(cmd: string, rest: string[]) {
  switch (cmd) {
    case "server":        return (await import("./mcp.js")).runServer();
    case "init":          return cmdInit();
    case "doctor":        return cmdDoctor();
    case "setup-prompt":  return process.stdout.write((await import("./setup-prompt.js")).SETUP_PROMPT);
    case "add":           return cmdAdd(rest);
    case "capture":       return cmdCapture(rest);
    case "search":        return cmdSearch(rest);
    case "list":          return cmdList(rest);
    case "get":           return cmdGet(rest);
    case "delete":        return cmdDelete(rest);
    case "install":       return cmdInstall(rest);
    case "hooks":         return cmdHooks(rest);
    case "context":       return cmdContext(rest);
    case "export":        return cmdExport(rest[0]);
    default:              console.error(`unknown command: ${cmd}\n\n${HELP}`); process.exit(2);
  }
}

async function cmdInit() {
  const { ensureHome, recallHome } = await import("./paths.js");
  const { openDb } = await import("./db.js");
  const { warmup } = await import("./embeddings.js");
  const { AGENTS, detectInstalled, isConfigured } = await import("./agents.js");
  ensureHome();
  openDb();
  console.log(`✓ ${recallHome()}`);
  process.stdout.write("downloading embedding model (~23mb, one time)... ");
  await warmup();
  console.log("done.");

  void AGENTS;
  const detected = detectInstalled();
  if (!detected.length) return console.log("\nno mcp-capable agents detected. run `recall setup-prompt` to install via any agent.");
  console.log("\ndetected:");
  for (const a of detected) console.log(`  - ${a.name}${isConfigured(a) ? " (already wired)" : ""}`);
  console.log("\nnext: `recall install --all && recall hooks install --all`");
}

async function cmdDoctor() {
  const { dbPath, recallHome } = await import("./paths.js");
  const { warmup } = await import("./embeddings.js");
  const { memoryCount } = await import("./store.js");
  const { AGENTS, isConfigured, isInstalled } = await import("./agents.js");
  const { HOOK_TARGETS, isHookInstalled } = await import("./hooks.js");
  const { currentProject } = await import("./project.js");

  console.log(`recall:    ${VERSION}`);
  console.log(`home:      ${recallHome()}${existsSync(recallHome()) ? "" : "  (run `recall init`)"}`);
  console.log(`db:        ${dbPath()}${existsSync(dbPath()) ? `  (${memoryCount()} memories)` : "  (missing)"}`);
  console.log(`project:   ${currentProject()}`);
  process.stdout.write("model:     ");
  try { await warmup(); console.log("ok"); } catch (e) { console.log(`failed: ${(e as Error).message}`); process.exitCode = 1; }
  console.log("\nmcp clients:");
  for (const a of AGENTS) {
    const state = !isInstalled(a) ? "not installed" : isConfigured(a) ? "✓ wired" : "✗ not wired";
    console.log(`  ${a.name.padEnd(16)} ${state}`);
  }
  console.log("\nauto-capture hooks:");
  for (const h of HOOK_TARGETS) console.log(`  ${h.name.padEnd(16)} ${isHookInstalled(h) ? "✓ installed" : "✗ not installed"}`);
}

async function cmdAdd(rest: string[]) {
  const { values, positionals } = parseArgs({ args: rest, options: { project: { type: "string" } }, allowPositionals: true });
  const text = positionals.join(" ").trim();
  if (!text) return die("usage: recall add <text> [--project X]");
  const { saveMemory } = await import("./store.js");
  const mem = await saveMemory(text, values.project);
  console.log(`✓ saved #${mem.id}${mem.project ? `  [${mem.project}]` : ""}`);
}

async function cmdCapture(rest: string[]) {
  const { values } = parseArgs({ args: rest, options: { agent: { type: "string" }, file: { type: "string" } } });
  // never let capture take down the agent's session — swallow errors.
  try {
    const { capture } = await import("./capture.js");
    await capture({ agent: values.agent, file: values.file });
  } catch (e) {
    console.error(`recall capture: ${(e as Error).message}`);
  }
}

async function cmdSearch(rest: string[]) {
  const { values, positionals } = parseArgs({ args: rest, options: {
    limit: { type: "string", short: "l", default: "10" },
    project: { type: "string" },
    all: { type: "boolean" },
  }, allowPositionals: true });
  const query = positionals.join(" ").trim();
  if (!query) return die("usage: recall search <query> [-l N] [--all|--project X]");
  const { searchMemories } = await import("./store.js");
  const results = await searchMemories(query, Number(values.limit), values.all ? "all" : values.project);
  if (!results.length) return console.log("(no results)");
  for (const r of results) console.log(`#${r.id}  ${r.score.toFixed(3)}  ${r.created_at}${r.project ? `  [${r.project}]` : ""}\n${indent(r.content)}\n`);
}

async function cmdList(rest: string[]) {
  const { values } = parseArgs({ args: rest, options: {
    limit: { type: "string", short: "l", default: "20" },
    project: { type: "string" },
    all: { type: "boolean" },
  } });
  const { listMemories } = await import("./store.js");
  const memories = listMemories(Number(values.limit), values.all ? "all" : values.project);
  if (!memories.length) return console.log("(no memories yet)");
  for (const m of memories) console.log(`#${m.id}  ${m.created_at}${m.project ? `  [${m.project}]` : ""}\n${indent(m.content)}\n`);
}

async function cmdGet(rest: string[]) {
  const id = Number(rest[0]);
  if (!id) return die("usage: recall get <id>");
  const { getMemory } = await import("./store.js");
  const mem = getMemory(id);
  if (!mem) { console.error(`memory ${id} not found`); process.exit(1); }
  console.log(JSON.stringify(mem, null, 2));
}

async function cmdDelete(rest: string[]) {
  const id = Number(rest[0]);
  if (!id) return die("usage: recall delete <id>");
  const { deleteMemory } = await import("./store.js");
  console.log(deleteMemory(id) ? `✓ deleted #${id}` : `memory ${id} not found`);
}

async function cmdInstall(rest: string[]) {
  const { values } = parseArgs({ args: rest, options: { all: { type: "boolean" }, agent: { type: "string", multiple: true } } });
  const { AGENTS, configure, detectInstalled, findAgent } = await import("./agents.js");
  const targets = values.all ? detectInstalled()
    : (values.agent ?? []).map((id) => findAgent(id) ?? die(`unknown agent: ${id}. known: ${AGENTS.map((a) => a.id).join(", ")}`));
  if (!targets.length) return die("usage: recall install --all | --agent <id>");
  const bin = recallBin();
  let failed = 0;
  for (const a of targets) {
    try {
      const { changed, existed } = configure(a, bin);
      const verb = changed ? (existed ? "updated" : "created") : "unchanged";
      console.log(`${changed ? "✓" : "="} ${a.name}: ${verb} ${a.configPath}`);
    } catch (e) {
      console.error(`✗ ${a.name}: ${(e as Error).message}`);
      failed++;
    }
  }
  console.log("\nrestart claude desktop / cursor; claude code picks it up next session.");
  if (failed) process.exit(1);
}

async function cmdHooks(rest: string[]) {
  const [sub, ...rest2] = rest;
  if (sub !== "install" && sub !== "uninstall") return die("usage: recall hooks install|uninstall [--all|--agent X]");
  const { values } = parseArgs({ args: rest2, options: { all: { type: "boolean" }, agent: { type: "string", multiple: true } } });
  const { HOOK_TARGETS, findHookTarget, installHook, uninstallHook } = await import("./hooks.js");
  const ids = values.all ? HOOK_TARGETS.map((h) => h.id) : (values.agent ?? []);
  if (!ids.length) return die(`usage: recall hooks ${sub} --all | --agent <id>`);
  const bin = recallBin();
  let failed = 0;
  for (const id of ids) {
    const t = findHookTarget(id);
    if (!t) { console.error(`unknown hook target: ${id}`); failed++; continue; }
    try {
      const changed = sub === "install" ? installHook(t, bin) : uninstallHook(t);
      const verb = changed ? (sub === "install" ? "installed" : "removed") : (sub === "install" ? "already installed" : "not present");
      console.log(`${changed ? "✓" : "="} ${t.name}: ${verb} (${t.configPath})`);
    } catch (e) {
      console.error(`✗ ${t.name}: ${(e as Error).message}`);
      failed++;
    }
  }
  if (sub === "install") console.log("\nevery session-end auto-saves a memory tagged with the current project. magic.");
  if (failed) process.exit(1);
}

async function cmdContext(rest: string[]) {
  const { values } = parseArgs({ args: rest, options: {
    project: { type: "string" },
    limit: { type: "string", short: "l" },
    seed: { type: "string" },
  } });
  const { writeContext } = await import("./context.js");
  const path = await writeContext({
    project: values.project,
    limit: values.limit ? Number(values.limit) : undefined,
    seed: values.seed,
  });
  console.log(`✓ wrote ${path}`);
  console.log(`drop \`@${path}\` into your CLAUDE.md / AGENTS.md to inject this on every session.`);
}

async function cmdExport(file?: string) {
  const { listMemories } = await import("./store.js");
  const json = JSON.stringify({ version: 2, exported_at: new Date().toISOString(), memories: listMemories(1_000_000, "all") }, null, 2);
  if (file) { writeFileSync(file, json); console.log(`✓ wrote ${file}`); }
  else process.stdout.write(json + "\n");
}
