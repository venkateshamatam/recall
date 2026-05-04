import { readFileSync } from "node:fs";
import { saveMemory } from "./store.js";
import { currentProject } from "./project.js";

const MAX_BYTES = 4096;

// claude code hooks pipe a json event on stdin (not raw transcript). pull
// transcript_path / last_assistant_message out of it. for non-claude callers
// the same code accepts plain text via --file.
// docs: https://docs.anthropic.com/en/docs/claude-code/hooks
export async function capture(opts: { agent?: string; file?: string } = {}) {
  let body = "";

  if (opts.file) {
    body = readFileSync(opts.file, "utf8");
  } else {
    const stdin = (await readStdin()).trim();
    body = extractFromHookEvent(stdin) ?? stdin;
  }

  const text = body.trim();
  if (text.length < 20) return;

  const trimmed = text.length <= MAX_BYTES ? text : "…" + text.slice(-MAX_BYTES);
  const header = `[${opts.agent ?? "agent"} · ${new Date().toISOString().slice(0, 16).replace("T", " ")}]`;
  await saveMemory(`${header}\n${trimmed}`, currentProject());
}

// pull a useful chunk out of a claude code hook payload. fall through to raw
// text when we can't recognize it (file pipes, codex, ad-hoc cli use).
function extractFromHookEvent(input: string): string | null {
  if (!input.startsWith("{")) return null;
  let event: any;
  try { event = JSON.parse(input); } catch { return null; }
  if (typeof event !== "object" || event === null) return null;

  // prefer the recorded transcript file if claude code pointed us at one.
  const path = typeof event.transcript_path === "string" ? event.transcript_path : null;
  if (path) {
    try {
      const raw = readFileSync(path, "utf8");
      const last = lastAssistantFromTranscript(raw);
      if (last) return last;
    } catch { /* fall through */ }
  }

  // fall back to whichever event field carries the latest assistant turn.
  for (const key of ["last_assistant_message", "last_message", "message", "assistant_message"]) {
    const v = event[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

// transcripts are jsonl; grab the last assistant content we can find.
function lastAssistantFromTranscript(raw: string): string | null {
  const lines = raw.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!.trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      const role = obj.role ?? obj.message?.role ?? obj.type;
      if (role !== "assistant") continue;
      const content = obj.content ?? obj.message?.content ?? obj.text;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const text = content.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("\n").trim();
        if (text) return text;
      }
    } catch { /* skip malformed line */ }
  }
  return null;
}

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
