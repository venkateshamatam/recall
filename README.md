# recall

Cross-agent memory for AI coding assistants. One local SQLite database, every MCP-capable agent on your Mac reads and writes it.

Save a fact in Claude Code. Search it from Cursor. Use it in Claude Desktop. No cloud, no account, no LLM in the hot path.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/venkateshamatam/recall/main/install.sh | sh
recall init
recall install --all
```

Requires Node 20 or later. macOS only.

## What gets installed

`recall install --all` wires three layers across every detected agent:

1. **MCP server** in Claude Code, Claude Desktop, Cursor, Windsurf, and Zed. Exposes `recall_save`, `recall_search`, `recall_list`, `recall_get`, `recall_delete`.
2. **Auto-capture** via the Claude Code `SessionEnd` hook. The last assistant turn from each session is saved automatically, tagged with the current git project.
3. **Auto-inject** via the Claude Code `UserPromptSubmit` hook plus a Cursor user rule and an `AGENTS.md` block. Relevant memories are injected into the model's context before each prompt, without the agent having to call a tool.

## Storage

```
~/.recall/db.sqlite        SQLite + sqlite-vec, plain file
~/.recall/models/          all-MiniLM-L6-v2 quantized, ~23 MB, downloaded once
```

Embeddings run on-device via `transformers.js`. Nothing leaves your machine after the model download. To sync across machines, point `~/.recall` at iCloud, Dropbox, or syncthing.

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

To install only part of the stack:

```bash
recall install --all --bare       MCP wiring only, skip auto-inject and auto-capture
recall auto install               just the auto-inject layer
recall auto uninstall             remove the auto-inject layer
recall hooks install --all        just the auto-capture layer
recall hooks uninstall --all      remove the auto-capture layer
```

## How auto-inject works

Claude Code's `UserPromptSubmit` hook runs before the model sees a user prompt. Anything the hook prints to stdout is added to the model's context for that turn. `recall inject` reads the hook event from stdin, runs a project-scoped semantic search against `~/.recall/db.sqlite`, and prints the top matches inside a `<recall-memory>` block.

Cursor and Claude Desktop don't have stdin-piped hooks, so they get the MCP tools plus a `~/.cursor/rules/recall.mdc` rule that tells the model to call `recall_search` first. That path is a nudge, not a guarantee.

## Paste-into-any-agent install

If you'd rather not run the install script yourself:

```bash
recall setup-prompt | pbcopy
```

Paste the output into any agent that can run shell commands. It will install recall, wire every MCP client, and verify with `recall doctor`.

## License

MIT.

## Issues

https://github.com/venkateshamatam/recall/issues
