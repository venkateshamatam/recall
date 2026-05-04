# recall

> i never told it. it just knew.

**Magic memory across every AI agent on your Mac.** Install it once, and every agent — Claude Code, Cursor, Claude Desktop, Windsurf, Codex — silently shares the same memory. No tool calls. No prompts. No agent SDKs. No cloud.

```bash
curl -fsSL https://raw.githubusercontent.com/venkateshamatam/recall/main/install.sh | sh
recall init
recall install --all
```

That's it. Now:

- **Tell Claude something on Monday.** Cursor knows on Tuesday. Codex knows on Wednesday.
- **Auto-capture.** When a Claude Code session ends, the last assistant turn gets saved tagged with the current git project. You don't call anything.
- **Auto-inject.** Before every prompt, the top relevant memories are injected into the model's context. The agent doesn't decide to "use recall" — it just gets the context for free.
- **Cross-agent.** All five MCP-capable agents read from the same `~/.recall/db.sqlite`.

> Requires Node 20+. Mac-first. The installer puts a `recall` binary on your PATH.

## How it works

```
   Claude Code     Cursor     Claude Desktop     Windsurf     Zed
        \            |             |              |          /
         \           |             |              |         /
          \          |             |              |        /
           ──────────┼──────────────┼──────────────┴───────
                                    │
                          recall MCP server  (stdio)
                                    │
                            SQLite + sqlite-vec
                              ~/.recall/db
```

Three layers, all wired by `recall install --all`:

**1. MCP server.** Every agent gets `recall_save`, `recall_search`, `recall_list`, `recall_get`, `recall_delete` over stdio. Memories live in one local SQLite file with on-device embeddings (transformers.js, all-MiniLM-L6-v2 quantized, ~23MB).

**2. Auto-capture (`SessionEnd` hook).** When your Claude Code session ends, recall reads the transcript, pulls the last assistant turn, and saves it tagged with the current git project. No LLM compression in the hot path.

**3. Auto-inject (`UserPromptSubmit` hook + Cursor rule + AGENTS.md).** Before every prompt, recall queries top-N relevant memories for the current project and prints them to stdout. Claude Code's hook spec says: anything written to stdout becomes part of the model's context for that turn. The agent never had to decide to look. **It just had the answer.**

## What you can do

```
recall init                       set up ~/.recall/, download embedding model (one time)
recall install [--all|--agent X]  wire mcp + auto-inject + auto-capture, all in one
recall doctor                     verify install + auto + hook status
recall setup-prompt               paste-ready installer prompt for any agent

recall add <text>                 manually save a memory
recall search <q> [--all]         semantic search (defaults to current project)
recall list [--all]               recent memories
recall context                    write ~/.recall/context-<project>.md for @-import
recall export [<file>]            json dump

recall server                     start the mcp server (called by mcp clients)
recall capture / inject           used by hooks; you don't call these directly
```

## Granular control

If you want some of the magic but not all of it:

```
recall install --all --bare       wire mcp clients, but skip auto-inject and auto-capture
recall auto install               just turn on auto-inject (UserPromptSubmit + cursor rule + AGENTS.md)
recall auto uninstall             remove all auto-inject
recall hooks install --all        just turn on auto-capture (SessionEnd)
recall hooks uninstall --all      remove all auto-capture
```

## Local-first by design

- Storage: `~/.recall/db.sqlite` — plain SQLite + `sqlite-vec`. Inspect with the `sqlite3` CLI.
- Embeddings: `all-MiniLM-L6-v2` quantized, on-device via transformers.js.
- Network: zero after the first model download. No cloud, no account, nothing leaves your machine.
- Sync (manual): point `~/.recall/` at iCloud / Dropbox / syncthing if you want multi-machine.

## The "one prompt" install

Don't want to touch your terminal? Run `recall setup-prompt | pbcopy` and paste into any agent that can run shell commands. The agent installs recall, wires every MCP client, turns on the magic, and reports back.

## Status

v0.3 — auto-inject + auto-capture across Claude Code, Cursor, AGENTS.md. Codex CLI hook coming when its hook API stabilizes.

Issues, ideas, demos: https://github.com/venkateshamatam/recall/issues
