# recall

Cross-agent memory for AI coding assistants. One local SQLite database, every MCP-capable agent on your Mac reads and writes it.

If you switch between AI agents during a project, recall keeps what each one learns about you in a single place the others can read.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/venkateshamatam/recall/main/install.sh | sh
recall init
recall install --all
```

Requires Node 20 or later. macOS only.

## What gets installed

`recall install --all` does a few things.

It registers a local MCP server with Claude Code, Claude Desktop, Cursor, Windsurf, and Zed. The server exposes five tools: `recall_save`, `recall_search`, `recall_list`, `recall_get`, and `recall_delete`.

It adds a Claude Code `SessionEnd` hook so the last assistant turn from each session gets saved automatically and tagged with the current git project.

It wires the auto-inject layer. That's a `UserPromptSubmit` hook for Claude Code, a user rule at `~/.cursor/rules/recall.mdc`, and a marker block in `~/.agents/AGENTS.md`. The Claude Code hook prints relevant memories to stdout before each prompt, and Claude Code merges that into the model's context. Cursor and Claude Desktop fall back to the rule and the MCP tools.

## Storage

```
~/.recall/db.sqlite        SQLite + sqlite-vec, plain file
~/.recall/models/          all-MiniLM-L6-v2 quantized, ~23 MB, downloaded once
```

Embeddings run on-device via `transformers.js`. The model downloads once on first use, and after that recall does not make network calls. To sync across machines, point `~/.recall` at iCloud, Dropbox, or syncthing.

## CLI

```
recall init                       set up ~/.recall/, download embedding model
recall install [--all|--agent X]  wire mcp + auto-inject + auto-capture
recall doctor                     check what's wired
recall setup-prompt               paste-into-any-agent installer prompt

recall add <text>                 save a memory
recall search <q> [--all]         semantic search (defaults to current project)
recall list [--all]               recent memories
recall context                    write ~/.recall/context-<project>.md for @-import
recall export [<file>]            json dump

recall server                     run the mcp server (called by mcp clients)
recall capture                    save piped transcript (used by SessionEnd hooks)
recall inject                     print recall context to stdout (used by UserPromptSubmit hooks)
```

## Granular control

```bash
recall install --all --bare       MCP wiring only, skip auto-inject and auto-capture
recall auto install               just the auto-inject layer
recall auto uninstall             remove the auto-inject layer
recall hooks install --all        just the auto-capture layer
recall hooks uninstall --all      remove the auto-capture layer
```

## Paste-into-any-agent install

```bash
recall setup-prompt | pbcopy
```

Paste the output into any agent that can run shell commands. It runs the install and verifies with `recall doctor`.

## License

MIT.

## Issues

https://github.com/venkateshamatam/recall/issues
