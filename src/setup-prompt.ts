// paste this into an agent that can run shell commands.
export const SETUP_PROMPT = `Install \`recall\` — a local MCP server that gives every AI agent on my machine
ONE shared memory pool. Run these in order, stop and tell me if anything fails.

  curl -fsSL https://raw.githubusercontent.com/vmatam/recall/main/install.sh | sh
  recall --version                # confirm the bin is on PATH
  recall init                     # ~/.recall/, downloads the embedding model once
  recall install --all            # wires every detected MCP-capable agent
  recall hooks install --all      # auto-saves every session end as a memory
  recall doctor                   # should be all green

Smoke test: \`recall add "hello from $(hostname) at $(date)"\` then
\`recall search "hello"\` should return that memory.

Then tell me which agents need a restart for the new MCP server to load
(Claude Desktop and Cursor do; Claude Code picks it up next session).

Don't touch any config file recall doesn't manage. Don't share the contents
of ~/.recall/ — it stays local.
`;
