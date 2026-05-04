# recall

shared memory for the AI agents on your Mac.

i kept telling Claude something on Monday and re-telling Cursor the same thing on Tuesday. recall is a small MCP server that fixes that. one local SQLite file, every agent reads and writes it.

```bash
curl -fsSL https://raw.githubusercontent.com/venkateshamatam/recall/main/install.sh | sh
recall init
recall install --all
```

needs Node 20+. Mac for now. Linux probably works, i haven't tested.

## what it does

three things, all wired by `recall install --all`:

- a local MCP server that exposes `recall_save`, `recall_search`, `recall_list`, `recall_get`, `recall_delete` to every agent that speaks MCP (Claude Code, Cursor, Claude Desktop, Windsurf, Zed).
- a `SessionEnd` hook in Claude Code that saves the last assistant turn after each session, tagged with the current git project. you don't call anything.
- a `UserPromptSubmit` hook that runs `recall inject` before every prompt, prints the top relevant memories to stdout, and Claude Code merges them into the model's context. the agent doesn't have to decide to look it up.

Cursor and Claude Desktop don't have stdin-style hooks, so they get the MCP tools plus a Cursor rules file that tells the model to call `recall_search` first. that one's a nudge, not a guarantee.

## storage

```
~/.recall/db.sqlite        the memories, plain SQLite + sqlite-vec
~/.recall/models/          all-MiniLM-L6-v2, downloaded once (~23MB)
```

embeddings run on-device via transformers.js. nothing leaves your machine after the first model download. if you want to back it up or sync it across machines, point `~/.recall` at iCloud / Dropbox / syncthing. there's no cloud version and i'm not building one.

## commands

```
recall init                       set up ~/.recall/, download model
recall install [--all|--agent X]  wire MCP + auto-inject + auto-capture
recall doctor                     check what's wired
recall setup-prompt               paste-ready installer for any agent

recall add <text>                 save manually
recall search <q> [--all]         search (defaults to current project)
recall list [--all]               recent memories
recall context                    write ~/.recall/context-<project>.md for @-import
recall export [<file>]            json dump

recall server                     run the MCP server (called by clients)
recall capture / inject           used by hooks, not by you
```

if you want fewer pieces:

```
recall install --all --bare       MCP wiring only, no auto-inject, no auto-capture
recall auto install               just the auto-inject layer
recall hooks install --all        just the auto-capture layer
```

## what it isn't

not a service. not a SaaS. nothing posts your memories anywhere. there's no telemetry. it's a SQLite file on your laptop and a tiny CLI that knows how to read it.

i'm not trying to compete with mem0 or claude-mem on features. they're bigger, and that's fine. recall is the version i wanted: small, local, cross-agent, no LLM in the hot path.

## paste-into-any-agent install

if you don't want to touch your terminal:

```
recall setup-prompt | pbcopy
```

then paste into Claude Code, Cursor agent mode, or any agent that can run shell commands. it'll install everything and tell you when to restart Claude Desktop / Cursor.

## bugs and ideas

https://github.com/venkateshamatam/recall/issues
