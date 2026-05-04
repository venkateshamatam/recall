# recall

One memory pool for every AI agent on your machine.

> Tell Claude on Monday. Cursor knows on Tuesday. ChatGPT knows on Wednesday.

Right now every agent has its own memory. Claude Code, Cursor, Claude Desktop, ChatGPT. None of them share, so if you run a few of them you end up re-explaining yourself constantly. `recall` is a small MCP server that runs locally and lets all of them read and write the same memory.
