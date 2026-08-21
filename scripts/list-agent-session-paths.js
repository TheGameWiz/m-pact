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
  matches.sort();
  return statEntry(entry, matches[0], {
    title: indexed?.thread_name,
  });
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
  for (const session of sessions) {
    const entry = resolveEntry(session);
    if (entry) {
      resolved.push(entry);
    } else {
      unresolved.push(session);
    }
  }
  return {
    ok: true,
    operation: "list-agent-session-paths",
    taskPath,
    sessionCount: sessions.length,
    resolvedCount: resolved.length,
    unresolvedCount: unresolved.length,
    agentSessionPaths: resolved,
    unresolvedAgentSessions: unresolved,
  };
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ACCEPTED_FLAGS,
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
});

module.exports = {
  antigravityRoots,
  findAntigravityPath,
  findClaudePath,
  findCodexPath,
  resolveEntry,
};
