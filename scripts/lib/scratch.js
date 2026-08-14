"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { findActiveRoot } = require("./task-state");

const SCRATCH_DIR_NAME = ".tmp";
const SCRATCH_GITIGNORE = "*\n";
const SCRATCH_STALE_MS = 60 * 60 * 1000;
const SCRATCH_FILE_PATTERN = /^m-pact-(?:input|content|log|refresh)-[a-f0-9]{32}\.md$/;

function defaultUserRoot(env = process.env) {
  if (env.MPACT_USER_ROOT && env.MPACT_USER_ROOT.trim()) {
    return path.resolve(env.MPACT_USER_ROOT);
  }
  const homePath = process.platform === "win32" && env.USERPROFILE && env.USERPROFILE.trim()
    ? env.USERPROFILE
    : os.homedir();
  return path.join(homePath, ".AgentMemoryRoot");
}

function normalizeForCompare(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function samePath(a, b) {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

function realpathOrResolved(value) {
  try {
    return fs.realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function resolveActiveMemoryRoot({ startPath = process.cwd(), userRoot = null } = {}) {
  const activeRoot = findActiveRoot(startPath);
  if (activeRoot) {
    return activeRoot;
  }
  const fallback = path.resolve(userRoot || defaultUserRoot());
  return fs.existsSync(fallback) ? fs.realpathSync(fallback) : fallback;
}

function scratchDirForRoot(rootPath) {
  const resolvedRoot = path.resolve(rootPath);
  return path.join(resolvedRoot, SCRATCH_DIR_NAME);
}

function ensureScratchDirectory(rootPath) {
  const scratchDir = scratchDirForRoot(rootPath);
  fs.mkdirSync(scratchDir, { recursive: true });
  const ignorePath = path.join(scratchDir, ".gitignore");
  if (!fs.existsSync(ignorePath) || fs.readFileSync(ignorePath, "utf8") !== SCRATCH_GITIGNORE) {
    fs.writeFileSync(ignorePath, SCRATCH_GITIGNORE, "utf8");
  }
  return fs.realpathSync(scratchDir);
}

function ensureActiveScratchDirectory(options = {}) {
  return ensureScratchDirectory(resolveActiveMemoryRoot(options));
}

function generatedScratchFileName(kind = "input") {
  const normalized = String(kind || "input").toLowerCase();
  if (!["input", "content", "log"].includes(normalized)) {
    throw new Error(`unsupported scratch file kind: ${kind}`);
  }
  return `m-pact-${normalized}-${crypto.randomUUID().replace(/-/g, "")}.md`;
}

function generatedScratchPath(rootPath, kind = "input") {
  return path.join(ensureScratchDirectory(rootPath), generatedScratchFileName(kind));
}

// Refresh bundles are current startup artifacts, not scratch buffers: one
// deterministic bundle per agent per scratch root, overwritten on success and
// deleted on no-bundle halts. The name deliberately stays outside
// SCRATCH_FILE_PATTERN so bundles never depend on age-based pruning, while the
// pattern keeps its legacy refresh alternative so old random-named bundles
// continue to drain.
function refreshBundleFileName(agentToken) {
  const token = String(agentToken || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `m-pact-refresh-${token || "unresolved"}.md`;
}

function refreshBundlePath(rootPath, agentToken) {
  return path.join(ensureScratchDirectory(rootPath), refreshBundleFileName(agentToken));
}

function removeRefreshBundle(rootPath, agentToken) {
  const bundlePath = path.join(scratchDirForRoot(rootPath), refreshBundleFileName(agentToken));
  try {
    fs.unlinkSync(bundlePath);
    return { path: bundlePath, removed: true };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { path: bundlePath, removed: false };
    }
    throw error;
  }
}

function isGeneratedScratchFileName(name) {
  return SCRATCH_FILE_PATTERN.test(String(name || ""));
}

function isGeneratedScratchPath(filePath, scratchDir) {
  const resolvedScratch = realpathOrResolved(scratchDir);
  const resolvedFile = realpathOrResolved(filePath);
  return samePath(path.dirname(resolvedFile), resolvedScratch)
    && isGeneratedScratchFileName(path.basename(resolvedFile));
}

function pruneScratchDirectory(rootPath, { now = Date.now(), staleMs = SCRATCH_STALE_MS } = {}) {
  const scratchDir = ensureScratchDirectory(rootPath);
  const removed = [];
  const failed = [];
  for (const entry of fs.readdirSync(scratchDir, { withFileTypes: true })) {
    if (!entry.isFile() || !isGeneratedScratchFileName(entry.name)) {
      continue;
    }
    const fullPath = path.join(scratchDir, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs < staleMs) {
        continue;
      }
      fs.unlinkSync(fullPath);
      removed.push(fullPath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        failed.push(`${fullPath} (${error.code || error.message})`);
      }
    }
  }
  return { scratchDir, removed, failed };
}

module.exports = {
  SCRATCH_DIR_NAME,
  SCRATCH_FILE_PATTERN,
  SCRATCH_GITIGNORE,
  SCRATCH_STALE_MS,
  defaultUserRoot,
  ensureActiveScratchDirectory,
  ensureScratchDirectory,
  generatedScratchFileName,
  generatedScratchPath,
  isGeneratedScratchFileName,
  isGeneratedScratchPath,
  pruneScratchDirectory,
  refreshBundleFileName,
  refreshBundlePath,
  removeRefreshBundle,
  resolveActiveMemoryRoot,
  scratchDirForRoot,
};
