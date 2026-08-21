#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const AGENTS_JSON_FILENAME = "Agents.json";
const PROVIDER_SESSION_ENV = {
  antigravity: ["ANTIGRAVITY_CONVERSATION_ID"],
  claude: ["CLAUDE_CODE_SESSION_ID"],
  codex: ["CODEX_THREAD_ID", "CODEX_SESSION_ID"],
};

function agentsJsonPath(taskPath) {
  return path.join(taskPath, AGENTS_JSON_FILENAME);
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeSessionEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const provider = normalizeString(entry.provider);
  const agent = normalizeString(entry.agent);
  const id = normalizeString(entry.id);
  if (!provider || !agent || !id) {
    return null;
  }
  return { provider, agent, id };
}

function dedupeSessions(entries) {
  const seen = new Set();
  const sessions = [];
  for (const entry of entries || []) {
    const normalized = normalizeSessionEntry(entry);
    if (!normalized) {
      continue;
    }
    const key = `${normalized.provider}\u0000${normalized.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sessions.push(normalized);
  }
  return sessions;
}

function parseAgentSessions(text, filePath) {
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`could not parse ${filePath}: ${error.message}`);
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  if (document.version !== 1) {
    throw new Error(`${filePath} has unsupported version: ${document.version}`);
  }
  if (!Array.isArray(document.sessions)) {
    throw new Error(`${filePath} must contain a sessions array`);
  }
  return dedupeSessions(document.sessions);
}

function readAgentSessions(taskPath) {
  const filePath = agentsJsonPath(taskPath);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return parseAgentSessions(fs.readFileSync(filePath, "utf8"), filePath);
}

function writeAgentSessions(taskPath, sessions) {
  const filePath = agentsJsonPath(taskPath);
  const tempPath = `${filePath}.tmp`;
  if (fs.existsSync(tempPath)) {
    throw new Error(`orphan Agents.json temp file exists; refusing overwrite: ${tempPath}`);
  }
  const body = `${JSON.stringify({ version: 1, sessions }, null, 2)}\n`;
  fs.writeFileSync(tempPath, body, "utf8");
  fs.renameSync(tempPath, filePath);
}

function recordAgentSession(taskPath, entry) {
  const normalized = normalizeSessionEntry(entry);
  if (!normalized) {
    return { recorded: false, reason: "missing-session-fields" };
  }
  const sessions = readAgentSessions(taskPath);
  if (sessions.some((session) => session.provider === normalized.provider && session.id === normalized.id)) {
    return { recorded: false, reason: "duplicate" };
  }
  writeAgentSessions(taskPath, [...sessions, normalized]);
  return { recorded: true };
}

function providerSessionIdForAgent(agent, env = process.env) {
  const provider = normalizeString(agent).toLowerCase();
  const names = PROVIDER_SESSION_ENV[provider] || [];
  for (const name of names) {
    const value = normalizeString(env[name]);
    if (value) {
      return { provider, id: value, envName: name };
    }
  }
  return null;
}

function recordCurrentAgentSession(taskPath, agent, env = process.env) {
  const current = providerSessionIdForAgent(agent, env);
  if (!current) {
    return { recorded: false, reason: "missing-provider-session-id" };
  }
  return recordAgentSession(taskPath, {
    provider: current.provider,
    agent,
    id: current.id,
  });
}

module.exports = {
  AGENTS_JSON_FILENAME,
  PROVIDER_SESSION_ENV,
  agentsJsonPath,
  providerSessionIdForAgent,
  readAgentSessions,
  recordAgentSession,
  recordCurrentAgentSession,
};
