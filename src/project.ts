import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

// project id from .git/config, fallback to cwd basename. no subprocess —
// recall save runs on every hook, the cost adds up.
export function currentProject(cwd = process.cwd()): string {
  const config = findGitConfig(cwd);
  if (config) {
    const url = readOriginUrl(config);
    if (url) return normalizeRemote(url);
  }
  return basename(cwd);
}

// walk up from cwd, return the resolved config path. handles worktrees and
// submodules where .git is a file containing `gitdir: <path>`.
function findGitConfig(start: string): string | null {
  let dir = start;
  while (true) {
    const dotGit = join(dir, ".git");
    if (existsSync(dotGit)) {
      const stat = statSync(dotGit);
      if (stat.isDirectory()) return existsSync(join(dotGit, "config")) ? join(dotGit, "config") : null;
      if (stat.isFile()) return resolveGitFilePointer(dotGit);
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// `.git` files contain `gitdir: <path>` (absolute or relative to .git's dir).
// for worktrees the gitdir points at .git/worktrees/<name>/, where commondir
// then points at the parent repo's .git/ that holds config.
function resolveGitFilePointer(gitFile: string): string | null {
  let raw: string;
  try { raw = readFileSync(gitFile, "utf8"); } catch { return null; }
  const m = raw.match(/^gitdir:\s*(.+?)\s*$/m);
  if (!m) return null;
  const gitdir = isAbsolute(m[1]!) ? m[1]! : resolve(dirname(gitFile), m[1]!);
  const config = join(gitdir, "config");
  if (existsSync(config)) return config;
  // worktree → look at commondir for the parent repo's config.
  const commondirFile = join(gitdir, "commondir");
  if (existsSync(commondirFile)) {
    const cd = readFileSync(commondirFile, "utf8").trim();
    const parent = isAbsolute(cd) ? cd : resolve(gitdir, cd);
    if (existsSync(join(parent, "config"))) return join(parent, "config");
  }
  return null;
}

// parse `[remote "origin"] url = ...` out of git's ini-ish config.
function readOriginUrl(configPath: string): string | null {
  let text: string;
  try { text = readFileSync(configPath, "utf8"); } catch { return null; }
  let inOrigin = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      inOrigin = /^\[remote\s+"origin"\]/.test(line);
      continue;
    }
    if (inOrigin && line.startsWith("url")) {
      const eq = line.indexOf("=");
      if (eq > 0) return line.slice(eq + 1).trim();
    }
  }
  return null;
}

// turn git@github.com:foo/bar.git or https://github.com/foo/bar into "foo/bar".
function normalizeRemote(url: string): string {
  const stripped = url.replace(/\.git$/, "").replace(/^git@([^:]+):/, "https://$1/");
  try {
    const u = new URL(stripped);
    return u.pathname.replace(/^\/+/, "") || stripped;
  } catch {
    return stripped;
  }
}
