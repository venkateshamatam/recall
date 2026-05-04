# recall

> Tell Claude on Monday. Cursor knows on Tuesday. Codex knows on Wednesday.

**Magic memory across every AI agent on your machine.** Local. Fast. No cloud, no account, no LLM in the hot path.

```bash
curl -fsSL https://raw.githubusercontent.com/vmatam/recall/main/install.sh | sh
recall init
recall install --all          # wires Claude Desktop, Claude Code, Cursor, Windsurf, Zed
recall hooks install --all    # auto-saves every session end. magic.
```

That's it. Now every agent reads from the same memory pool, and every session you finish automatically saves itself.

> Requires Node 20+. The installer puts a `recall` binary on your PATH.

---

## What you get

**1. One shared memory across every agent.**
Tell Claude Code "I prefer Knex over Prisma." Cursor knows it tomorrow. ChatGPT knows it Friday. The big labs won't fix this, because shared memory weakens lock-in. So this is the answer.

**2. Auto-capture, no LLM in the hot path.**
`recall hooks install --agent claude-code` adds a `SessionEnd` hook. When your Claude Code session ends, recall reads the transcript, pulls the last assistant turn, and saves it tagged with the current git project. No agent SDK call, no compression latency, no waiting. Other tools compress with an LLM at session end and add seconds of latency. recall just writes.

**3. Project-scoped by default.**
Every memory is tagged with the project (from `git remote get-url origin`). Search defaults to the current project. Pass `--all` to query the global pool. Personal preferences travel everywhere; project context stays put.

**4. Live context for AGENTS.md / CLAUDE.md.**
```bash
recall context  # writes ~/.recall/context-<project>.md
```
Drop `@~/.recall/context-myorg-myrepo.md` into your CLAUDE.md or AGENTS.md and every new session starts pre-warmed with the top relevant memories for that repo. No agent action required.

---

## How it works

```
   Claude Code     Cursor     Claude Desktop     Codex     ...any MCP client
        \            |            |               /
         \           |            |              /
          ─ ─ ─ ─ ─ ─┼─ ─ ─ ─ ─ ─ ┼─ ─ ─ ─ ─ ─ ─    MCP (stdio)
                     │            │
              ┌──────▼────────────▼──────┐
              │   recall MCP server      │
              │   + Stop hooks (auto)    │
              └──────────┬───────────────┘
                         │
                  ┌──────▼──────┐
                  │  SQLite +   │
                  │  sqlite-vec │
                  │ ~/.recall/  │
                  └─────────────┘
```

Five MCP tools every agent gets: `recall_save`, `recall_search`, `recall_list`, `recall_get`, `recall_delete`.

Auto-capture is opt-in (`recall hooks install`) and a one-line entry in your agent's settings file. Uninstall any time.

---

## CLI

```
recall init                            ~/.recall/, downloads embedding model
recall install --all                   wire mcp into every detected agent
recall hooks install --all             auto-save session ends as memories
recall context [--project X]           write ~/.recall/context-<project>.md
recall doctor                          verify install + agent + hook status
recall setup-prompt                    paste-ready installer prompt for any agent

recall add <text> [--project X]        save a memory
recall capture [--agent X]             save piped transcript (used by hooks)
recall search <q> [-l N] [--all]
recall list [-l N] [--all]
recall get <id>
recall delete <id>

recall server                          start the mcp server
recall export [<file>]                 dump all memories as json
```

## The "one prompt" install

Don't want to touch your terminal? Run `recall setup-prompt | pbcopy` and paste into any agent that can run shell commands. The agent installs recall, wires every MCP client, installs the Stop hooks, and reports back.

## Local-first by design

- `~/.recall/db.sqlite` — plain SQLite, inspect with `sqlite3`
- Embeddings: `all-MiniLM-L6-v2` running on-device via transformers.js (~23MB, downloaded once)
- Network: zero, after the model is cached
- Sync: bring your own. Point `~/.recall/` at iCloud / Dropbox / syncthing if you want multi-machine

## Differences from the alternatives

- **AGENTS.md / CLAUDE.md** are static and per-repo. recall is per-machine and writes during conversation.
- **claude-mem** runs the agent SDK on every Stop hook to compress sessions. recall writes raw structured context with no LLM call. Faster.
- **Anthropic's native memory (v2.1.30+)** is Claude-only, 200-line cap, exact-keyword search. recall is cross-agent, unbounded, semantic.
- **mem0 / OpenMemory** ships a Docker stack with Postgres + Qdrant + a dashboard. recall is one binary and one SQLite file.

## License

MIT. Star the repo if recall earns its keep.
