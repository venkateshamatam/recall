import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodRawShape } from "zod";
import { warmup } from "./embeddings.js";
import { deleteMemory, getMemory, listMemories, saveMemory, searchMemories } from "./store.js";

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

export function buildServer() {
  const server = new McpServer(
    { name: "recall", version: "0.3.0" },
    {
      instructions:
        "shared cross-agent memory. recall_search before answering anything personal or project-specific. " +
        "recall_save for stable facts, preferences, decisions. memories auto-tag with the current project (git remote). " +
        "search defaults to the current project; pass project='all' for the global pool.",
    },
  );
  // sdk's tool() overloads recurse through zod generics under strict ts; one cast keeps it boring.
  const tool = server.tool.bind(server) as (n: string, d: string, s: ZodRawShape, h: (...a: any[]) => any) => void;

  tool("recall_save",
    "save a memory. defaults to tagging with the current project (git remote).",
    { content: z.string().min(1), project: z.string().optional() },
    async ({ content, project }) => text(await saveMemory(content, project)));

  tool("recall_search",
    "semantic search. defaults to current project; pass project='all' for global, or any project name to scope.",
    { query: z.string().min(1), limit: z.number().int().positive().max(50).optional(), project: z.string().optional() },
    async ({ query, limit, project }) => text(await searchMemories(query, limit ?? 10, project)));

  tool("recall_list",
    "recent memories, newest first. defaults to current project.",
    { limit: z.number().int().positive().max(100).optional(), project: z.string().optional() },
    async ({ limit, project }) => text(listMemories(limit ?? 20, project)));

  tool("recall_get",
    "fetch one memory by id.",
    { id: z.number().int().positive() },
    async ({ id }) => {
      const mem = getMemory(id);
      if (!mem) throw new Error(`memory ${id} not found`);
      return text(mem);
    });

  tool("recall_delete",
    "forget a memory. use when the user asks to delete something.",
    { id: z.number().int().positive() },
    async ({ id }) => text({ ok: deleteMemory(id), id }));

  return server;
}

export async function runServer() {
  // don't make the client wait on model startup.
  warmup().catch((e) => console.error(`[recall] warmup failed: ${(e as Error).message}`));
  await buildServer().connect(new StdioServerTransport());
}
