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
const IDENTITY_NOTICE_EXIT_CODE = 4;

function notice(message) {
  const error = new Error(message);
  error.mpactNotice = [
    IDENTITY_NOTICE_BEGIN,
    message,
    IDENTITY_NOTICE_END,
  ].join("\n");
  error.exitCode = IDENTITY_NOTICE_EXIT_CODE;
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
  error.exitCode = IDENTITY_NOTICE_EXIT_CODE;
  error.adoptionRequired = true;
  return error;
}

function fail(message) {
  throw new Error(message);
}

function defaultUserRoot(env = process.env) {
  if (env.MPACT_USER_ROOT && env.MPACT_USER_ROOT.trim()) {
    return path.resolve(env.MPACT_USER_ROOT);
  }
  const homePath = process.platform === "win32" && env.USERPROFILE && env.USERPROFILE.trim()
    ? env.USERPROFILE
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

function pathContains(parentPath, childPath) {
  const parent = normalizeCompare(parentPath);
  const child = normalizeCompare(childPath);
  const relative = path.relative(parent, child);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function setupLocationRefusalMessage({ projectPath, userRoot, home }) {
  const candidate = path.resolve(projectPath);
  const user = path.resolve(userRoot);
  const homePath = path.resolve(home || os.homedir());
  if (pathContains(candidate, user)) {
    return `Project memory cannot be created at ${candidate} because the user root occupies that level: ${user}. Project memory belongs in a project folder.`;
  }
  if (samePath(candidate, homePath)) {
    return `Project memory cannot be created at the home directory ${candidate}. Project memory belongs in a project folder.`;
  }
  if (samePath(candidate, path.parse(candidate).root)) {
    return `Project memory cannot be created at filesystem root ${candidate}. Project memory belongs in a project folder.`;
  }
  return null;
}

function validateProjectMemorySetupLocationVerdict({ projectPath, userRoot = defaultUserRoot(), home = os.homedir() } = {}) {
  const message = setupLocationRefusalMessage({ projectPath, userRoot, home });
  if (message) {
    return { ok: false, message };
  }
  return { ok: true, projectPath: path.resolve(projectPath), userRoot: path.resolve(userRoot), home: path.resolve(home) };
}

function validateProjectMemorySetupLocation(options) {
  const verdict = validateProjectMemorySetupLocationVerdict(options);
  if (!verdict.ok) {
    fail(verdict.message);
  }
  return verdict;
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

function pruneProjectSentinels(rootPath, keepName) {
  const removed = [];
  for (const existing of listSentinels(rootPath, PROJECT_PREFIX)) {
    if (existing === keepName) {
      continue;
    }
    fs.unlinkSync(path.join(rootPath, existing));
    removed.push(existing);
  }
  return removed;
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
        assertProjectIdentityCanProceed(resolvedRoot, existing);
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
      const counterState = ensureCounterReadyUnlocked(userRoot);
      const existing = readProjectSentinel(resolvedRoot);
      if (existing.state === "valid") {
        return { repaired: false, projectId: existing.projectId, rootPath: resolvedRoot, sentinel: existing.name };
      }
      if (existing.state === "multiple") {
        const expectedName = expectedProjectSentinelName(resolvedRoot);
        if (existing.names.includes(expectedName)) {
          const sentinelPath = path.join(resolvedRoot, expectedName);
          let projectId;
          try {
            projectId = parseBareInteger(fs.readFileSync(sentinelPath, "utf8"), "project sentinel contents");
          } catch (error) {
            fail(`matching project identity sentinel is malformed: ${error.message}`);
          }
          if (projectId > counterState.counter.value) {
            fail("matching project identity is above the counter high-water mark; repair project identity state before retrying");
          }
          const removed = pruneProjectSentinels(resolvedRoot, expectedName);
          return { repaired: removed.length > 0, projectId, rootPath: resolvedRoot, removed: removed.join(", "), sentinel: expectedName };
        }
        const projectId = mintProjectIdUnlocked(userRoot);
        const written = writeProjectSentinel(resolvedRoot, projectId);
        return { repaired: true, projectId, rootPath: resolvedRoot, removed: existing.names.join(", "), sentinel: written.name };
      }
      if (existing.state !== "path-mismatch" && existing.state !== "empty" && existing.state !== "invalid-content") {
        fail(`project identity repair requires a path-mismatched, multiple, empty, or invalid-content sentinel state, found: ${existing.state}`);
      }
      const projectId = mintProjectIdUnlocked(userRoot);
      const written = writeProjectSentinel(resolvedRoot, projectId);
      return { repaired: true, projectId, rootPath: resolvedRoot, removed: existing.name, sentinel: written.name };
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
  const projectPath = path.dirname(rootPath);
  return [
    `Project identity path does not match project root ${projectPath}.`,
    "This usually means the project was renamed. It can also happen after a move or copy.",
    "Repair will repoint the project sentinel at the current location and assign a new project ID.",
    "Question: Is the current project location intended? Answer yes or no.",
    "If yes: run the project identity repair helper for this root, refresh, then retry the original operation.",
    "If no: change directory back to the intended project or open the intended session before retrying.",
  ].join("\n");
}

function multipleSentinelMessage(rootPath, names) {
  return [
    `Multiple project identity sentinels were found under ${rootPath}: ${names.join(", ")}.`,
    "Run the project identity repair helper for this root, then refresh and retry.",
  ].join("\n");
}

function foreignSentinelMessage(rootPath, names) {
  return [
    `Project identity sentinels belonging to other locations were found under ${rootPath}: ${names.join(", ")}.`,
    "None matches this root's current location. Repair will remove those sentinels and assign a new project identity.",
    "Question: Assign a new project identity for this current root? Answer yes or no.",
    "If yes: run the project identity repair helper for this root, refresh, then retry the original operation.",
    "If no: change directory back to the intended project or stop before writing durable project memory.",
  ].join("\n");
}

function corruptSentinelMessage(rootPath, identity) {
  const detail = identity.state === "invalid-content" && identity.message
    ? ` (${identity.message})`
    : "";
  return [
    `Project identity sentinel is corrupt under ${rootPath}: ${identity.state}${detail}.`,
    "Repair will remove the corrupt sentinel and assign a new project identity for this current root.",
    "Question: Assign a new project identity for this current root? Answer yes or no.",
    "If yes: run the project identity repair helper for this root, refresh, then retry the original operation.",
    "If no: stop before writing durable project memory.",
  ].join("\n");
}

function classifyProjectIdentity(rootPath, identity) {
  if (identity.state === "valid") {
    return { state: "valid", action: "proceed" };
  }
  if (identity.state === "missing") {
    return { state: "missing", action: "adopt", error: adoptionNotice(rootPath) };
  }
  if (identity.state === "multiple") {
    const expectedName = expectedProjectSentinelName(rootPath);
    return {
      state: "multiple",
      action: "repair",
      error: notice(identity.names.includes(expectedName)
        ? multipleSentinelMessage(rootPath, identity.names)
        : foreignSentinelMessage(rootPath, identity.names)),
    };
  }
  if (identity.state === "empty" || identity.state === "invalid-content") {
    return { state: identity.state, action: "repair", error: notice(corruptSentinelMessage(rootPath, identity)) };
  }
  if (identity.state === "path-mismatch") {
    return { state: "path-mismatch", action: "repair", error: notice(pathMismatchMessage(rootPath)) };
  }
  return { state: identity.state, action: "error", error: new Error(`project identity sentinel is malformed: ${identity.state}`) };
}

function assertProjectIdentityCanProceed(rootPath, identity) {
  const classification = classifyProjectIdentity(rootPath, identity);
  if (classification.action !== "proceed") {
    throw classification.error;
  }
  return classification;
}

function launcherProjectPathFromEnv() {
  const value = process.env.MPACT_LAUNCHER_PROJECT_PATH;
  return value && String(value).trim() ? path.resolve(String(value).trim()) : null;
}

function rootFromProjectLikePath(projectPath) {
  const resolved = path.resolve(projectPath);
  return path.basename(resolved) === ".AgentMemory"
    ? resolved
    : path.join(resolved, ".AgentMemory");
}

function launcherMismatchMessage({ launcherPath, projectPath }) {
  return [
    `Launcher reports current project path ${launcherPath}, but this write targets ${projectPath}.`,
    "This can happen when an existing agent session is resumed from a different visible workspace.",
    "Question: Is this write intended for the session's target project? Answer yes or no.",
    "If yes: unset or correct MPACT_LAUNCHER_PROJECT_PATH for this run, then retry.",
    "If no: open or resume the agent session for the intended project before writing durable memory.",
  ].join("\n");
}

function assertLauncherProjectIntent(resolvedRoot, projectPath) {
  const launcherPath = launcherProjectPathFromEnv();
  if (!launcherPath) {
    return;
  }
  const launcherRoot = rootFromProjectLikePath(launcherPath);
  if (!samePath(launcherRoot, resolvedRoot)) {
    throw notice(launcherMismatchMessage({ launcherPath, projectPath }));
  }
}

function projectIdFromInput(input = {}, args = {}) {
  const value = args["project-id"];
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return parseBareInteger(value, "project ID declaration");
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

      assertProjectIdentityCanProceed(resolvedRoot, identity);

      if (identity.projectId > counter.value) {
        fail("project identity is above the counter high-water mark; repair project identity state before retrying");
      }

      return { identity, counter, counterInitialized };
    });
  });
}

function userRootFromInput(input = {}, args = {}, fallback = defaultUserRoot()) {
  if (Object.prototype.hasOwnProperty.call(args, "user-root") && typeof args["user-root"] !== "string") {
    fail("--user-root requires a value");
  }
  return path.resolve(args["user-root"] || fallback);
}

// Library contract (relocated from references/memory-root-policy.md): callers of
// validateProjectWrite must catch identity-halt errors and surface error.mpactNotice
// to the Director rather than printing a raw stack; the notice carries the
// structured halt question the protocol expects.
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
  assertLauncherProjectIntent(resolvedRoot, projectPath);
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

function validateProjectWriteVerdict(options) {
  try {
    return { ok: true, value: validateProjectWrite(options) };
  } catch (error) {
    return {
      ok: false,
      message: error.message,
      mpactNotice: error.mpactNotice || null,
      exitCode: error.exitCode || 1,
      error,
    };
  }
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
  classifyProjectIdentity,
  defaultUserRoot,
  ensureCounterInitialized,
  expectedProjectSentinelName,
  initializeProjectIdentity,
  isProjectRoot,
  isUserRoot,
  readCounterSentinel,
  readProjectSentinel,
  repairProjectIdentity,
  ensureProjectRootHealth,
  validateProjectWrite,
  validateProjectMemorySetupLocation,
  validateProjectMemorySetupLocationVerdict,
  validateProjectWriteVerdict,
  writeCounterSentinel,
  writeProjectSentinel,
};
