# recall

One memory pool for every AI agent on your machine.

> Tell Claude on Monday. Cursor knows on Tuesday. ChatGPT knows on Wednesday.

Every agent has its own little memory today. Claude Code has one. Cursor has one. Claude Desktop, ChatGPT, all of them. None of them talk to each other, so anything you tell one is invisible to the rest. `recall` is a small MCP server that runs on your machine and lets all of them read and write the same memory.

## Why

If you run a few agents at once, you end up saying the same things over and over. Your role, your preferences, the project you're on, the decisions you already made. The big labs aren't going to fix this, because shared memory makes their tools easier to leave. So it has to come from outside.

## How it works

```
   Claude Code     Cursor     Claude Desktop     ...any MCP client
        \            |              /
         \           |             /
          \          |            /
           ──────────┼──────────── MCP (stdio)
                     │
              recall MCP server
                     │
              SQLite + sqlite-vec
                ~/.recall/db
```

One MCP server. Six tools: `recall_save`, `recall_search`, `recall_list`, `recall_get`, `recall_delete`, `recall_tags`. Every agent reads and writes the same SQLite file on your machine, so a memory saved in one agent shows up in the rest.

## Features

- Works with any MCP client. No per-agent integration.
- Local-first. Memories live in `~/.recall/`. No cloud, no account, no network calls.
- Semantic search via transformers.js (`all-MiniLM-L6-v2`), running locally. No OpenAI key.
- It's just SQLite under the hood, so you can inspect it, back it up, or sync it however you want.

## CLI

```
recall init               Set up ~/.recall/, print MCP config for each agent
recall add "<text>"       Save a memory from the terminal
recall search "<query>"   Search memories
recall list               Show recent memories
recall server             Start the MCP server (used by MCP config)
recall doctor             Verify install and detect configured agents
recall export             Dump memories to JSON
recall import <file>      Load memories from JSON
```
