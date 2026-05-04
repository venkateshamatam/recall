// paste this into an agent that can run shell commands.
export const SETUP_PROMPT = `i want to install \`recall\` (https://github.com/venkateshamatam/recall),
a local mcp server that gives every ai agent on this mac one shared memory pool.
run these in order. stop and tell me if anything fails.

  curl -fsSL https://raw.githubusercontent.com/venkateshamatam/recall/main/install.sh | sh
  recall --version
  recall init
  recall install --all
  recall doctor

quick smoke test:
  recall add "hello from $(hostname) at $(date)"
  recall search "hello"

then tell me which apps need a restart. claude desktop and cursor do, claude
code picks up the new mcp server on its next session.

don't touch any config file recall doesn't manage. don't paste contents of
~/.recall/ anywhere, it's local on purpose.
`;
