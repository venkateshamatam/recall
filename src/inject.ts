import { readFileSync } from "node:fs";
import { searchMemories, listMemories } from "./store.js";
import { currentProject } from "./project.js";

// claude code's UserPromptSubmit hook pipes a json event on stdin. anything we
// write to stdout gets injected into the model's context before it responds.
// the agent doesn't decide to call recall — it just gets the context for free.
// docs: https://docs.anthropic.com/en/docs/claude-code/hooks
const MAX_MEMORIES = 8;

export async function inject(opts: { seed?: string } = {}) {
  let seed = opts.seed ?? "";
  if (!seed && !process.stdin.isTTY) {
    const stdin = (await readStdin()).trim();
    seed = extractPrompt(stdin) ?? stdin;
  }

  const project = currentProject();
  const memories = seed.trim().length >= 3
    ? await searchMemories(seed, MAX_MEMORIES, project)
    : listMemories(MAX_MEMORIES, project);

  if (!memories.length) return; // nothing to inject — say nothing.

  const lines = [
    "<recall-memory>",
    `relevant memories from project ${project} (saved earlier across sessions and agents):`,
    "",
    ...memories.map((m, i) => `${i + 1}. ${m.content.replace(/\s+/g, " ").trim().slice(0, 400)}`),
    "</recall-memory>",
  ];
  process.stdout.write(lines.join("\n") + "\n");
}

// hook events are json with a `prompt` (or similar) field. fall through to raw text.
function extractPrompt(input: string): string | null {
  if (!input.startsWith("{")) return null;
  let event: any;
  try { event = JSON.parse(input); } catch { return null; }
  for (const k of ["prompt", "user_prompt", "message", "user_message", "content"]) {
    if (typeof event[k] === "string" && event[k].trim()) return event[k];
  }
  // some hook payloads point at a transcript file with the latest user turn.
  if (typeof event.transcript_path === "string") {
    try {
      const lines = readFileSync(event.transcript_path, "utf8").trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const obj = safeParse(lines[i]!);
        const role = obj?.role ?? obj?.message?.role;
        const content = obj?.content ?? obj?.message?.content;
        if (role === "user" && typeof content === "string") return content;
      }
    } catch { /* fall through */ }
  }
  return null;
}

function safeParse(line: string): any { try { return JSON.parse(line); } catch { return null; } }

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => { buf += c; });
    // best-effort: hooks must never fail.
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", () => resolve(buf));
  });
}
