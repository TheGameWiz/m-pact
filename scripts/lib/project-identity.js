"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { withDirectoryLock } = require("./directory-lock");
const { booleanArg, sanitizeSlug } = require("./helper-common");
const { findActiveRoot } = require("./task-state");

const PROJECT_PREFIX = "project__";
const COUNTER_PREFIX = "project-count__";
const ADOPTION_NOTICE_BEGIN = "M-PACT PROJECT ADOPTION REQUIRED";
const ADOPTION_NOTICE_END = "END M-PACT PROJECT ADOPTION REQUIRED";
const IDENTITY_NOTICE_BEGIN = "M-PACT PROJECT IDENTITY REQUIRED";
const IDENTITY_NOTICE_END = "END M-PACT PROJECT IDENTITY REQUIRED";

function notice(message) {
  const error = new Error(message);
  error.mpactNotice = [
    IDENTITY_NOTICE_BEGIN,
    message,
    IDENTITY_NOTICE_END,
  ].join("\n");
  error.exitCode = 1;
  return error;
}

function adoptionNotice(rootPath) {
  const displayRoot = path.resolve(rootPath);
  const error = new Error(`Project identity adoption is required for this root: ${displayRoot}`);
  error.mpactNotice = [
    ADOPTION_NOTICE_BEGIN,
    `Project identity is missing for this root: ${displayRoot}`,
    "This existing .AgentMemory root has not been adopted into M-PACT project identity.",
    "Adopting it will mint the next local project ID and write one helper-owned project sentinel.",
    "Question: Adopt this project root into M-PACT project identity now? Answer yes or no.",
    "If yes: run the project identity adoption helper for this root, refresh, then retry the original operation.",
    "If no: no identity will be written; reads may continue, but durable project writes to this root will keep halting for adoption.",
    ADOPTION_NOTICE_END,
  ].join("\n");
  error.exitCode = 1;
  error.adoptionRequired = true;
  return error;
}

function fail(message) {
  throw new Error(message);
}

function defaultUserRoot() {
  if (process.env.MPACT_USER_ROOT && process.env.MPACT_USER_ROOT.trim()) {
    return path.resolve(process.env.MPACT_USER_ROOT);
  }
  const homePath = process.platform === "win32" && process.env.USERPROFILE && process.env.USERPROFILE.trim()
    ? process.env.USERPROFILE
    : os.homedir();
  return path.join(homePath, ".AgentMemoryRoot");
}

function isProjectRoot(rootPath) {
  return path.basename(rootPath) === ".AgentMemory";
}

function isUserRoot(rootPath) {
  return path.basename(rootPath) === ".AgentMemoryRoot";
}

function normalizeCompare(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function samePath(a, b) {
  return normalizeCompare(a) === normalizeCompare(b);
}

// The slug must describe the root's canonical location, so the root has to exist.
// Resolving a missing path would silently yield a non-canonical slug and a bogus
// sentinel name; fail loudly instead.
function projectLocationForRoot(rootPath) {
  const candidate = path.resolve(rootPath);
  if (!fs.existsSync(candidate)) {
    fail(`project identity requires an existing .AgentMemory root: ${candidate}`);
  }
  const resolved = fs.realpathSync(candidate);
  if (!isProjectRoot(resolved)) {
    fail(`project identity requires a .AgentMemory root: ${resolved}`);
  }
  return path.dirname(resolved);
}

function expectedProjectSentinelName(rootPath) {
  return `${PROJECT_PREFIX}${sanitizeSlug(projectLocationForRoot(rootPath))}`;
}

function listSentinels(rootPath, prefix) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }
  return fs.readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function parseBareInteger(text, label) {
  const trimmed = String(text).trim();
  if (!/^\d+$/.test(trimmed)) {
    fail(`${label} must be a bare integer`);
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(value)) {
    fail(`${label} is not a safe integer`);
  }
  return value;
}

function readProjectSentinel(rootPath) {
  const names = listSentinels(rootPath, PROJECT_PREFIX);
  if (names.length === 0) {
    return { state: "missing" };
  }
  if (names.length > 1) {
    return { state: "multiple", names };
  }
  const name = names[0];
  const sentinelPath = path.join(rootPath, name);
  const stat = fs.statSync(sentinelPath);
  if (stat.size === 0) {
    return { state: "empty", name, sentinelPath };
  }
  let projectId;
  try {
    projectId = parseBareInteger(fs.readFileSync(sentinelPath, "utf8"), "project sentinel contents");
  } catch (error) {
    return { state: "invalid-content", name, sentinelPath, message: error.message };
  }
  const expectedName = expectedProjectSentinelName(rootPath);
  if (name !== expectedName) {
    return { state: "path-mismatch", name, expectedName, sentinelPath, projectId };
  }
  return { state: "valid", name, sentinelPath, projectId };
}

function readCounterSentinel(userRoot, { allowMissing = false } = {}) {
  const names = listSentinels(userRoot, COUNTER_PREFIX);
  if (names.length === 0) {
    if (allowMissing) {
      return { state: "missing", value: 0 };
    }
    return { state: "missing" };
  }
  if (names.length > 1) {
    return { state: "multiple", names };
  }
  const name = names[0];
  const counterPath = path.join(userRoot, name);
  const stat = fs.statSync(counterPath);
  if (stat.size !== 0) {
    return { state: "nonzero", name, counterPath };
  }
  const suffix = name.slice(COUNTER_PREFIX.length);
  if (!/^\d+$/.test(suffix)) {
    return { state: "invalid", name, counterPath };
  }
  const value = Number.parseInt(suffix, 10);
  if (!Number.isSafeInteger(value)) {
    return { state: "invalid", name, counterPath };
  }
  return { state: "valid", name, counterPath, value };
}

function assertCounter(counter) {
  if (counter.state !== "valid") {
    if (counter.state === "missing") {
      throw notice("Project identity counter is missing. Refresh or retry the helper so M-PACT can initialize local project identity.");
    }
    fail(`project identity counter is malformed: ${counter.state}`);
  }
}

function ensureCounterReadyUnlocked(userRoot) {
  const counter = readCounterSentinel(userRoot, { allowMissing: true });
  if (counter.state === "valid") {
    return { counter, initialized: false };
  }
  if (counter.state !== "missing") {
    fail(`project identity counter is malformed: ${counter.state}`);
  }
  writeCounterSentinel(userRoot, 0);
  return { counter: readCounterSentinel(userRoot), initialized: true };
}

function writeCounterSentinel(userRoot, value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail("project identity counter value must be a non-negative safe integer");
  }
  const counter = readCounterSentinel(userRoot, { allowMissing: true });
  const nextPath = path.join(userRoot, `${COUNTER_PREFIX}${value}`);
  if (counter.state === "missing") {
    fs.closeSync(fs.openSync(nextPath, "wx"));
    return;
  }
  if (counter.state !== "valid") {
    fail(`project identity counter is malformed: ${counter.state}`);
  }
  if (counter.value === value) {
    return;
  }
  fs.renameSync(counter.counterPath, nextPath);
}

function ensureCounterInitialized(userRoot) {
  fs.mkdirSync(userRoot, { recursive: true });
  return withDirectoryLock(userRoot, () => {
    const counter = readCounterSentinel(userRoot, { allowMissing: true });
    if (counter.state === "valid") {
      return { created: false, value: counter.value };
    }
    if (counter.state !== "missing") {
      fail(`project identity counter is malformed: ${counter.state}`);
    }
    writeCounterSentinel(userRoot, 0);
    return { created: true, value: 0 };
  });
}

function mintProjectId(userRoot) {
  fs.mkdirSync(userRoot, { recursive: true });
  return withDirectoryLock(userRoot, () => {
    return mintProjectIdUnlocked(userRoot);
  });
}

function mintProjectIdUnlocked(userRoot) {
  const counter = readCounterSentinel(userRoot);
  assertCounter(counter);
  const next = counter.value + 1;
  fs.renameSync(counter.counterPath, path.join(userRoot, `${COUNTER_PREFIX}${next}`));
  return next;
}

function writeProjectSentinel(rootPath, projectId) {
  const name = expectedProjectSentinelName(rootPath);
  const sentinelPath = path.join(rootPath, name);
  for (const existing of listSentinels(rootPath, PROJECT_PREFIX)) {
    const existingPath = path.join(rootPath, existing);
    if (existingPath !== sentinelPath) {
      fs.unlinkSync(existingPath);
    }
  }
  fs.writeFileSync(sentinelPath, String(projectId), "utf8");
  return { name, sentinelPath };
}

function initializeProjectIdentity(rootPath, userRoot = defaultUserRoot()) {
  const resolvedRoot = fs.realpathSync(rootPath);
  return withDirectoryLock(userRoot, () => {
    return withDirectoryLock(resolvedRoot, () => {
      const counterState = ensureCounterReadyUnlocked(userRoot);
      const existing = readProjectSentinel(resolvedRoot);
      if (existing.state === "valid") {
        if (existing.projectId > counterState.counter.value) {
          fail("project identity is above the counter high-water mark; repair project identity state before retrying");
        }
        return {
          adopted: false,
          counterInitialized: counterState.initialized,
          projectId: existing.projectId,
          rootPath: resolvedRoot,
          sentinel: existing.name,
        };
      }
      if (existing.state !== "missing") {
        fail(`project identity sentinel is malformed: ${existing.state}`);
      }
      const projectId = mintProjectIdUnlocked(userRoot);
      const written = writeProjectSentinel(resolvedRoot, projectId);
      return {
        adopted: true,
        counterInitialized: counterState.initialized,
        projectId,
        rootPath: resolvedRoot,
        sentinel: written.name,
      };
    });
  });
}

function adoptProjectIdentity(rootPath, userRoot = defaultUserRoot()) {
  const resolvedRoot = fs.realpathSync(rootPath);
  if (!fs.existsSync(userRoot)) {
    fail(`Required user root is missing: ${userRoot}`);
  }
  return withDirectoryLock(userRoot, () => {
    return withDirectoryLock(resolvedRoot, () => {
      const counterState = ensureCounterReadyUnlocked(userRoot);
      const existing = readProjectSentinel(resolvedRoot);
      if (existing.state === "valid") {
        if (existing.projectId > counterState.counter.value) {
          fail("project identity is above the counter high-water mark; repair project identity state before retrying");
        }
        return { adopted: false, projectId: existing.projectId, rootPath: resolvedRoot, sentinel: existing.name };
      }
      if (existing.state !== "missing") {
        fail(`project identity adoption requires a missing sentinel, found: ${existing.state}`);
      }
      const projectId = mintProjectIdUnlocked(userRoot);
      const written = writeProjectSentinel(resolvedRoot, projectId);
      return { adopted: true, projectId, rootPath: resolvedRoot, sentinel: written.name };
    });
  });
}

function repairProjectIdentity(rootPath, userRoot = defaultUserRoot()) {
  const resolvedRoot = fs.realpathSync(rootPath);
  if (!fs.existsSync(userRoot)) {
    fail(`Required user root is missing: ${userRoot}`);
  }
  return withDirectoryLock(userRoot, () => {
    return withDirectoryLock(resolvedRoot, () => {
      const existing = readProjectSentinel(resolvedRoot);
      if (existing.state === "valid") {
        return { repaired: false, projectId: existing.projectId, rootPath: resolvedRoot, sentinel: existing.name };
      }
      if (existing.state !== "path-mismatch") {
        fail(`project identity repair requires a path-mismatched sentinel, found: ${existing.state}`);
      }
      ensureCounterReadyUnlocked(userRoot);
      const projectId = mintProjectIdUnlocked(userRoot);
      const written = writeProjectSentinel(resolvedRoot, projectId);
      return { repaired: true, projectId, rootPath: resolvedRoot, oldSentinel: existing.name, sentinel: written.name };
    });
  });
}

// Failure text names the resolved project PATH, never the stored project ID. The path
// is not a secret - the caller already supplied or resolved it - and it is the only part
// of an identity failure a human can act on. The ID stays hidden per section 9.1.
function mismatchMessage(projectPath) {
  return `Home resolved to ${projectPath}, which is not the project you declared. Refresh to load this project, or change directory back to the project you meant.`;
}

function pathMismatchMessage(rootPath) {
  return `Project identity path does not match project root ${path.dirname(rootPath)}. Run the project identity repair helper, refresh, then retry.`;
}

function projectIdFromInput(input = {}, args = {}) {
  const value = args["project-id"];
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return parseBareInteger(value, "project ID declaration");
}

function validateProjectRootHealth(rootPath, userRoot = defaultUserRoot()) {
  const resolvedRoot = fs.realpathSync(rootPath);
  const identity = readProjectSentinel(resolvedRoot);
  if (identity.state === "missing") {
    throw adoptionNotice(resolvedRoot);
  }
  if (identity.state === "multiple") {
    fail(`multiple project identity sentinels found: ${identity.names.join(", ")}`);
  }
  if (identity.state === "empty" || identity.state === "invalid-content") {
    fail(`project identity sentinel is malformed: ${identity.state}`);
  }
  if (identity.state === "path-mismatch") {
    throw notice(pathMismatchMessage(resolvedRoot));
  }
  const counter = readCounterSentinel(userRoot);
  assertCounter(counter);
  if (identity.projectId > counter.value) {
    fail("project identity is above the counter high-water mark; repair project identity state before retrying");
  }
  return { identity, counter };
}

function ensureProjectRootHealth(rootPath, userRoot = defaultUserRoot()) {
  const resolvedRoot = fs.realpathSync(rootPath);
  if (!fs.existsSync(userRoot)) {
    fail(`Required user root is missing: ${userRoot}`);
  }
  return withDirectoryLock(userRoot, () => {
    return withDirectoryLock(resolvedRoot, () => {
      let { counter, initialized: counterInitialized } = ensureCounterReadyUnlocked(userRoot);
      let identity = readProjectSentinel(resolvedRoot);

      if (identity.state === "missing") {
        throw adoptionNotice(resolvedRoot);
      } else if (identity.state === "multiple") {
        fail(`multiple project identity sentinels found: ${identity.names.join(", ")}`);
      } else if (identity.state === "empty" || identity.state === "invalid-content") {
        fail(`project identity sentinel is malformed: ${identity.state}`);
      } else if (identity.state === "path-mismatch") {
        throw notice(pathMismatchMessage(resolvedRoot));
      }

      if (identity.projectId > counter.value) {
        fail("project identity is above the counter high-water mark; repair project identity state before retrying");
      }

      return { identity, counter, counterInitialized };
    });
  });
}

function userRootFromInput(input = {}, args = {}, fallback = defaultUserRoot()) {
  return path.resolve(input.userRoot || input.user_root || args.userRoot || args["user-root"] || fallback);
}

function validateProjectWrite({ rootPath, input = {}, args = {}, userRoot = null }) {
  userRoot = userRootFromInput(input, args, userRoot || defaultUserRoot());
  const resolvedRoot = fs.realpathSync(rootPath);
  if (isUserRoot(resolvedRoot)) {
    return { rootPath: resolvedRoot, projectId: null, projectPath: null, userRoot: true, crossProject: false };
  }
  if (!isProjectRoot(resolvedRoot)) {
    fail(`rootPath is not an M-PACT memory root: ${resolvedRoot}`);
  }
  const explicitCrossProject = booleanArg(args, "cross-project");
  const { identity } = ensureProjectRootHealth(resolvedRoot, userRoot);
  const projectPath = path.dirname(resolvedRoot);
  const discoveredRoot = findActiveRoot(process.cwd());
  const differsFromDiscovery = !discoveredRoot || !samePath(discoveredRoot, resolvedRoot);
  const declared = projectIdFromInput(input, args);
  if (differsFromDiscovery && explicitCrossProject) {
    // --cross-project is permission to proceed WITHOUT a declaration, not permission
    // to ignore one. A declaration that contradicts the target is agent confusion and
    // still halts; only the requirement to supply one is lifted.
    if (declared !== null && declared !== identity.projectId) {
      throw notice(mismatchMessage(projectPath));
    }
    return { rootPath: resolvedRoot, projectId: identity.projectId, projectPath, userRoot: false, crossProject: true };
  }
  if (declared === null) {
    throw notice(`This write targets project root ${projectPath}. Refresh to load it, then retry with --project-id from the receipt.`);
  }
  if (declared !== identity.projectId) {
    throw notice(mismatchMessage(projectPath));
  }
  return { rootPath: resolvedRoot, projectId: identity.projectId, projectPath, userRoot: false, crossProject: false };
}

module.exports = {
  ADOPTION_NOTICE_BEGIN,
  ADOPTION_NOTICE_END,
  COUNTER_PREFIX,
  IDENTITY_NOTICE_BEGIN,
  IDENTITY_NOTICE_END,
  PROJECT_PREFIX,
  adoptProjectIdentity,
  adoptionNotice,
  defaultUserRoot,
  ensureCounterInitialized,
  expectedProjectSentinelName,
  initializeProjectIdentity,
  isProjectRoot,
  isUserRoot,
  mintProjectId,
  readCounterSentinel,
  readProjectSentinel,
  repairProjectIdentity,
  ensureProjectRootHealth,
  validateProjectRootHealth,
  validateProjectWrite,
  writeCounterSentinel,
  writeProjectSentinel,
};
