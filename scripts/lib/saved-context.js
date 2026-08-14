"use strict";

const fs = require("fs");
const path = require("path");
const { sanitizeSlug } = require("./helper-common");
const { ensureScratchDirectory } = require("./scratch");

const SAVED_CONTEXT_STALE_MS = 10 * 60 * 1000;
const SAVED_CONTEXT_PATTERN = /^saved-context-([a-z0-9]+)-(\d{8}-\d{6})\.md$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function savedContextTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("") + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function savedContextFileName(agent, date = new Date()) {
  return `saved-context-${savedContextAgentToken(agent)}-${savedContextTimestamp(date)}.md`;
}

function savedContextAgentToken(agent) {
  const token = sanitizeSlug(agent);
  if (!token || token.includes("-")) {
    throw new Error(`agent token must sanitize to a single non-empty token with no dash: ${agent}`);
  }
  return token;
}

function savedContextTimestampMs(timestamp) {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(String(timestamp || ""));
  if (!match) {
    return NaN;
  }
  const [, yyyy, mm, dd, hh, min, ss] = match;
  return new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    Number(ss),
  ).getTime();
}

function savedContextInfoFromName(name) {
  const match = SAVED_CONTEXT_PATTERN.exec(String(name || ""));
  if (!match) {
    return null;
  }
  return {
    name,
    agent: match[1],
    timestamp: match[2],
  };
}

function listSavedContexts(rootPath, agent = null) {
  const scratchDir = ensureScratchDirectory(rootPath);
  const expectedAgent = agent ? savedContextAgentToken(agent) : null;
  return fs.readdirSync(scratchDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const parsed = savedContextInfoFromName(entry.name);
      if (!parsed || (expectedAgent && parsed.agent !== expectedAgent)) {
        return null;
      }
      const filePath = path.join(scratchDir, entry.name);
      const stat = fs.statSync(filePath);
      return {
        ...parsed,
        path: filePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        modified: stat.mtime.toISOString(),
        timestampMs: savedContextTimestampMs(parsed.timestamp),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function deleteSavedContext(context) {
  try {
    fs.unlinkSync(context.path);
    return null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    return `${context.path} (${error.code || error.message})`;
  }
}

function deleteSavedContextsForAgent(rootPath, agent) {
  const failures = [];
  for (const context of listSavedContexts(rootPath, agent)) {
    const failure = deleteSavedContext(context);
    if (failure) {
      failures.push(failure);
    }
  }
  return failures;
}

function cleanupDuplicateSavedContexts(rootPath, agent) {
  const contexts = listSavedContexts(rootPath, agent);
  if (contexts.length <= 1) {
    return { current: contexts[0] || null, removed: [], failed: [] };
  }
  const current = contexts[contexts.length - 1];
  const removed = [];
  const failed = [];
  for (const context of contexts.slice(0, -1)) {
    const failure = deleteSavedContext(context);
    if (failure) {
      failed.push(failure);
    } else {
      removed.push(context.name);
    }
  }
  return { current, removed, failed };
}

function parseSavedContextAnswer(value) {
  const match = /^(RESTORE|DISCARD):(.+)$/.exec(String(value || "").trim());
  if (!match) {
    return null;
  }
  return {
    action: match[1],
    filename: match[2],
  };
}

function readSavedContext(context) {
  return fs.readFileSync(context.path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function writeSavedContext(rootPath, agent, body, date = new Date()) {
  const scratchDir = ensureScratchDirectory(rootPath);
  const failures = deleteSavedContextsForAgent(rootPath, agent);
  if (failures.length > 0) {
    throw new Error(`could not replace existing saved context file(s): ${failures.join(", ")}`);
  }
  const name = savedContextFileName(agent, date);
  const filePath = path.join(scratchDir, name);
  fs.writeFileSync(filePath, String(body || ""), { encoding: "utf8", flag: "wx" });
  return {
    name,
    path: filePath,
    timestamp: savedContextInfoFromName(name).timestamp,
  };
}

function savedContextAgeMs(context, now = Date.now()) {
  return now - context.timestampMs;
}

module.exports = {
  SAVED_CONTEXT_PATTERN,
  SAVED_CONTEXT_STALE_MS,
  cleanupDuplicateSavedContexts,
  deleteSavedContext,
  listSavedContexts,
  parseSavedContextAnswer,
  readSavedContext,
  savedContextAgentToken,
  savedContextAgeMs,
  savedContextFileName,
  savedContextInfoFromName,
  savedContextTimestamp,
  savedContextTimestampMs,
  writeSavedContext,
};
