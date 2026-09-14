#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { readAgentSessions } = require("./lib/agents-store");
const {
  DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");

const ACCEPTED_FLAGS = [
  "root",
  "user-root",
  "task",
  "task-path",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

function homeDir(env = process.env) {
  return env.USERPROFILE || env.HOME || os.homedir();
}

function statEntry(entry, filePath, extra = {}) {
  const stat = fs.statSync(filePath);
  return {
    ...entry,
    ...extra,
    path: filePath,
    modified: stat.mtime.toISOString(),
    sizeBytes: stat.size,
  };
}

function modifiedTime(entry) {
  const parsed = Date.parse(entry && entry.modified);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortNewestFirst(entries) {
  return [...(entries || [])].sort((a, b) => {
    return modifiedTime(b) - modifiedTime(a)
      || (Number.isFinite(b.registryIndex) ? b.registryIndex : -1) - (Number.isFinite(a.registryIndex) ? a.registryIndex : -1)
      || String(a.path || "").localeCompare(String(b.path || ""));
  });
}

function sortResolvedAgentSessionPaths(entries) {
  return [...(entries || [])].sort((a, b) => {
    return String(a.provider || "").localeCompare(String(b.provider || ""))
      || String(a.agent || "").localeCompare(String(b.agent || ""))
      || modifiedTime(b) - modifiedTime(a)
      || (Number.isFinite(b.registryIndex) ? b.registryIndex : -1) - (Number.isFinite(a.registryIndex) ? a.registryIndex : -1)
      || String(a.path || "").localeCompare(String(b.path || ""));
  });
}

function newestResolvedAgentSessionPaths(entries) {
  const groups = new Map();
  for (const entry of sortResolvedAgentSessionPaths(entries)) {
    const key = `${entry.provider}\u0000${entry.agent}`;
    if (!groups.has(key)) {
      groups.set(key, entry);
    }
  }
  return [...groups.values()].sort((a, b) => modifiedTime(b) - modifiedTime(a) || String(a.provider || "").localeCompare(String(b.provider || "")));
}

function safeReaddir(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function findClaudePath(entry, env = process.env) {
  const configRoot = env.CLAUDE_CONFIG_DIR || path.join(homeDir(env), ".claude");
  const projectsRoot = path.join(configRoot, "projects");
  for (const project of safeReaddir(projectsRoot)) {
    if (!project.isDirectory()) {
      continue;
    }
    const candidate = path.join(projectsRoot, project.name, `${entry.id}.jsonl`);
    if (fs.existsSync(candidate)) {
      return statEntry(entry, candidate);
    }
  }
  return null;
}

function readCodexIndex(codexRoot) {
  const indexPath = path.join(codexRoot, "session_index.jsonl");
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  const records = new Map();
  for (const line of fs.readFileSync(indexPath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      const record = JSON.parse(line);
      if (record && record.id) {
        records.set(String(record.id), record);
      }
    } catch {
      // The index is only a hint for title/confirmation; malformed lines do not
      // prevent bounded filename resolution from finding the transcript.
    }
  }
  return records;
}

function findFilesBySuffix(rootPath, suffix, options = {}) {
  const maxDepth = options.maxDepth || 8;
  const found = [];
  function walk(dirPath, depth) {
    if (depth > maxDepth) {
      return;
    }
    for (const entry of safeReaddir(dirPath)) {
      const candidate = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(candidate, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith(suffix)) {
        found.push(candidate);
      }
    }
  }
  if (fs.existsSync(rootPath)) {
    walk(rootPath, 0);
  }
  return found;
}

function findCodexPath(entry, env = process.env) {
  const codexRoot = env.CODEX_HOME || path.join(homeDir(env), ".codex");
  const index = readCodexIndex(codexRoot);
  const indexed = index ? index.get(entry.id) : null;
  const matches = findFilesBySuffix(path.join(codexRoot, "sessions"), `-${entry.id}.jsonl`);
  if (matches.length === 0) {
    return null;
  }
  const newest = sortNewestFirst(matches.map((match) => statEntry(entry, match)))[0];
  return {
    ...newest,
    title: indexed?.thread_name,
  };
}

function antigravityRoots(env = process.env) {
  const geminiRoot = path.join(homeDir(env), ".gemini");
  return safeReaddir(geminiRoot)
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("antigravity"))
    .map((entry) => path.join(geminiRoot, entry.name));
}

function findAntigravityPath(entry, env = process.env) {
  for (const root of antigravityRoots(env)) {
    const candidate = path.join(root, "brain", entry.id, ".system_generated", "logs", "transcript.jsonl");
    if (fs.existsSync(candidate)) {
      return statEntry(entry, candidate);
    }
  }
  return null;
}

function resolveEntry(entry, env = process.env) {
  if (entry.provider === "claude") {
    return findClaudePath(entry, env);
  }
  if (entry.provider === "codex") {
    return findCodexPath(entry, env);
  }
  if (entry.provider === "antigravity") {
    return findAntigravityPath(entry, env);
  }
  return null;
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A", "C"] });
  const sessions = readAgentSessions(taskPath);
  const resolved = [];
  const unresolved = [];
  sessions.forEach((session, registryIndex) => {
    const entry = resolveEntry(session);
    if (entry) {
      resolved.push({ ...entry, registryIndex });
    } else {
      unresolved.push(session);
    }
  });
  return {
    ok: true,
    operation: "list-agent-session-paths",
    taskPath,
    sessionCount: sessions.length,
    resolvedCount: resolved.length,
    unresolvedCount: unresolved.length,
    agentSessionPaths: sortResolvedAgentSessionPaths(resolved),
    unresolvedAgentSessions: unresolved,
  };
}

if (require.main === module) {
  runCli(main, {
    acceptedFlags: ACCEPTED_FLAGS,
    stringFlags: ACCEPTED_FLAGS,
    requiredFlags: REQUIRED_FLAGS,
    requiredOneOf: REQUIRED_ONE_OF,
    unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  });
}

module.exports = {
  antigravityRoots,
  findAntigravityPath,
  findClaudePath,
  findCodexPath,
  newestResolvedAgentSessionPaths,
  resolveEntry,
  sortResolvedAgentSessionPaths,
};
