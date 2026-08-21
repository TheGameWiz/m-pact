#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  resolveRootPath: resolveMemoryRootPath,
  resolveTaskPath: resolveMemoryTaskPath,
} = require("./task-state");
const {
  ensureActiveScratchDirectory,
  isGeneratedScratchPath,
  pruneScratchDirectory,
  resolveActiveMemoryRoot,
} = require("./scratch");

const MIN_NODE_MAJOR = 18;
const MEMBER_NAME_MAX = 128;
const MPACT_SUPPRESS_BEGIN = "M-PACT SUPPRESSED";
const MPACT_SUPPRESS_END = "END M-PACT SUPPRESSED";
const MPACT_SUPPRESS_EXIT_CODE = 3;
const MPACT_HOOK_CONTEXT_FLAG = "hook";
const REFRESH_ACCEPTED_FLAGS = [
  "StartPath",
  "-StartPath",
  "start-path",
  "AllowUserRootOnly",
  "-AllowUserRootOnly",
  "allow-user-root-only",
  "SavedContext",
  "-SavedContext",
  "saved-context",
  "agent",
  MPACT_HOOK_CONTEXT_FLAG,
];
const consumedTempInputPaths = new Set();
let activeScratchDir = null;
let activeScratchRoot = null;
const AGENT_PROVIDERS = {
  codex: [".codex", "skills", "m-pact"],
  claude: [".claude", "skills", "m-pact"],
};
const PROVIDER_TOKENS = new Set(["codex", "claude", "antigravity"]);
const RESERVED_AGENT_TOKENS = new Set(["gemini"]);
const DECLARED_AGENT_ENV = "MPACT_AGENT";
const ANTIGRAVITY_AGENT_ENV = "ANTIGRAVITY_AGENT";
const CLAUDE_AGENT_ENV = "CLAUDECODE";
const CODEX_AGENT_ENV_VARS = [
  "CODEX_INTERNAL_ORIGINATOR_OVERRIDE",
  "CODEX_PERMISSION_PROFILE",
  "CODEX_SANDBOX_NETWORK_DISABLED",
  "CODEX_THREAD_ID",
];
const AGENT_IDENTITY_ENV_VARS = [
  DECLARED_AGENT_ENV,
  ANTIGRAVITY_AGENT_ENV,
  CLAUDE_AGENT_ENV,
  ...CODEX_AGENT_ENV_VARS,
];
const STDIN_INPUT_FLAG = "from-stdin";
const DEFAULT_STDIN_FLAGS = [STDIN_INPUT_FLAG];

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function shouldReadStdin(args = {}, stdinFlags = DEFAULT_STDIN_FLAGS) {
  return stdinFlags.some((flag) => hasOwn(args, flag));
}

function assertNodeVersion() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
    throw new Error(`Node.js ${MIN_NODE_MAJOR} or newer is required.`);
  }
}

function isMpactSuppressed() {
  return Boolean(process.env.MPACT_SUPPRESS);
}

function suppressionNotice() {
  return [
    MPACT_SUPPRESS_BEGIN,
    "MPACT_SUPPRESS is truthy; the launching environment owns startup and runtime context in this session.",
    "M-PACT refresh and helpers are disabled here. Unset MPACT_SUPPRESS or use a normal session to run M-PACT.",
    MPACT_SUPPRESS_END,
  ].join("\n");
}

function isMpactHookContext(argv = process.argv.slice(2)) {
  return argv.includes(`--${MPACT_HOOK_CONTEXT_FLAG}`);
}

// Hard gate honored by every helper entrypoint. When MPACT_SUPPRESS is truthy the
// launching environment (for example ConflabCode) owns context, so the helper
// prints a deterministic notice before doing any work. Direct invocations remain
// scriptable failures; installed hook invocations exit cleanly so the notice can
// be injected as context without recording a failed hook run.
function assertMpactAllowedInCurrentSession() {
  if (!isMpactSuppressed()) {
    return;
  }
  process.stdout.write(`${suppressionNotice()}\n`);
  process.exit(isMpactHookContext() ? 0 : MPACT_SUPPRESS_EXIT_CODE);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const DEFAULT_UNSUPPORTED_OPERATION_FLAGS = {
  delete: "Deleting memory records is not supported because records are append-only history. Write a later record that corrects or supersedes the wrong one.",
  remove: "Removing memory records is not supported because records are append-only history. Write a later record that corrects or supersedes the wrong one.",
  rm: "Removing memory records is not supported because records are append-only history. Write a later record that corrects or supersedes the wrong one.",
  purge: "Purging memory records is not supported because records are append-only history. Write a later record that corrects or supersedes the wrong one.",
  edit: "Editing task-log records in place is not supported because task logs are append-only history. Write a later record that corrects or supersedes the wrong one. Journal entries are the controlled exception; use modify-journal-entry only when the Director explicitly asks to modify a journal entry.",
  modify: "Modifying task-log records in place is not supported because task logs are append-only history. Write a later record that corrects or supersedes the wrong one. Journal entries are the controlled exception; use modify-journal-entry only when the Director explicitly asks to modify a journal entry.",
  renumber: "Renumbering memory records is not supported because record numbers are derived from the append-only container. Leave the original numbering intact and write a later corrective record if needed.",
  reorder: "Reordering memory records is not supported because record order is append-only history. Leave the original order intact and write a later corrective record if needed.",
  "remove-item": "Removing a design specification item is not supported because item identity and provenance are append-only. Clear or supersede the item in a later task log or design specification update.",
  "delete-item": "Deleting a design specification item is not supported because item identity and provenance are append-only. Clear or supersede the item in a later task log or design specification update.",
  "remove-design-item": "Removing a design specification item is not supported because item identity and provenance are append-only. Clear or supersede the item in a later task log or design specification update.",
  "delete-design-item": "Deleting a design specification item is not supported because item identity and provenance are append-only. Clear or supersede the item in a later task log or design specification update.",
};

function assertUnsupportedOperationFlags(argv, unsupportedFlags = {}) {
  const unsupported = unsupportedFlags instanceof Map
    ? unsupportedFlags
    : new Map(Object.entries(unsupportedFlags || {}));
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const flag = arg.slice(2);
    if (!unsupported.has(flag)) {
      continue;
    }
    const message = unsupported.get(flag);
    throw new Error(typeof message === "function" ? message(arg) : message);
  }
}

function assertKnownFlags(argv, acceptedFlags = [], unsupportedFlags = {}) {
  assertNoHelpProbe(argv);
  assertUnsupportedOperationFlags(argv, unsupportedFlags);
  const accepted = new Set(acceptedFlags);
  for (const arg of argv) {
    const flag = arg.startsWith("--")
      ? arg.slice(2)
      : accepted.has(arg)
        ? arg
        : null;
    if (flag === null) {
      continue;
    }
    if (!accepted.has(flag)) {
      throw new Error(`unrecognized flag: ${arg}`);
    }
  }
}

function assertStringFlagValues(args, flags = []) {
  for (const flag of flags) {
    if (!Object.prototype.hasOwnProperty.call(args, flag)) {
      continue;
    }
    const value = args[flag];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`--${flag} requires a value`);
    }
  }
}

function hasArg(args, name) {
  return Object.prototype.hasOwnProperty.call(args, name);
}

function assertRequiredFlags(args, flags = []) {
  for (const flag of flags) {
    if (!hasArg(args, flag)) {
      throw new Error(`--${flag} is required`);
    }
  }
}

function assertRequiredOneOf(args, groups = []) {
  for (const group of groups) {
    if (!Array.isArray(group) || group.length === 0) {
      continue;
    }
    if (!group.some((flag) => hasArg(args, flag))) {
      throw new Error(`one of ${group.map((flag) => `--${flag}`).join(", ")} is required`);
    }
  }
}

function assertFlagValueValidators(args, validators = {}) {
  for (const [flag, validate] of Object.entries(validators || {})) {
    if (!hasArg(args, flag)) {
      continue;
    }
    const message = validate(args[flag], args);
    if (typeof message === "string" && message.length > 0) {
      throw new Error(message);
    }
  }
}

function booleanArg(args, name) {
  if (!Object.prototype.hasOwnProperty.call(args, name)) {
    return false;
  }
  const value = args[name];
  if (value === true) {
    return true;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`--${name} accepts only true or false when a value is provided`);
}

function readStdin() {
  try {
    return normalizeLineEndings(fs.readFileSync(0, "utf8"));
  } catch {
    return "";
  }
}

function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeForContainment(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function realpathForContainment(filePath) {
  const realpath = fs.realpathSync.native || fs.realpathSync;
  return realpath(path.resolve(filePath));
}

function isInsideDirectory(filePath, directoryPath) {
  const file = normalizeForContainment(filePath);
  const directory = normalizeForContainment(directoryPath);
  const relative = path.relative(directory, file);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function readInputFile(inputPath) {
  const realInputPath = realpathForContainment(inputPath);
  const realTempPath = realpathForContainment(os.tmpdir());
  const text = normalizeLineEndings(fs.readFileSync(realInputPath, "utf8"));
  if (activeScratchDir && isGeneratedScratchPath(realInputPath, activeScratchDir)) {
    consumedTempInputPaths.add(realInputPath);
  } else if (isInsideDirectory(realInputPath, realTempPath)) {
    consumedTempInputPaths.add(realInputPath);
  }
  return text;
}

function prepareActiveScratchDirectory(args = {}) {
  activeScratchDir = null;
  activeScratchRoot = null;
  try {
    activeScratchRoot = resolveActiveMemoryRoot({
      startPath: process.cwd(),
      userRoot: args["user-root"],
    });
    activeScratchDir = ensureActiveScratchDirectory({
      startPath: process.cwd(),
      userRoot: args["user-root"],
    });
  } catch {
    activeScratchRoot = null;
    activeScratchDir = null;
  }
  return activeScratchDir;
}

function readInput(args, options = {}) {
  const text = args.input
    ? readInputFile(args.input)
    : shouldReadStdin(args, options.stdinFlags || []) ? readStdin() : "";
  return text.length > 0 ? { body: text } : {};
}

function assertNoHelpProbe(argv) {
  if (!argv.includes("--help") && !argv.includes("-h")) {
    return;
  }
  throw new Error("M-PACT helpers do not support --help or -h. Read the relevant M-PACT reference procedure and use its example helper call.");
}

const RECEIPT_SCALAR_KEYS = [
  "record", "member", "timestamp", "task", "status", "projectId", "projectPath", "crossProject", "taskPath", "taskSource", "taskState", "rootPath", "zipPath", "oldPath", "newPath", "sentinel", "rulePath", "memberCount", "query", "readCursor", "unreadCount", "unreadByAuthor", "readFrom", "readThrough", "nextCursor", "truncated", "membersRead", "specMember", "designSpecFormat", "designSpecNotice", "implementationReview", "currentBlob", "itemCount", "unabsorbedCount", "clearedUnresolved", "recordsSinceBlob", "openDependencies", "blobMember", "itemsWritten", "itemsRead", "projectionStatus", "batchStrategy", "closeAbsorption", "closeAbsorptionReason", "closeAbsorptionSpecMembers", "absorbedItems", "closeUnfinished", "closeClearedUnresolved", "reopenUnfinished", "reopenClearedUnresolved", "logMember", "activeRecord", "activeTagged", "activeItems", "orphanedSpecMembers", "repairedSpecMember", "repairRecord", "announcement", "collisionGroups", "taskLogCatalog", "sessionCount", "resolvedCount", "unresolvedCount", "normalized", "warning",
];
const RECEIPT_STRUCTURED_KEYS = new Set(["ok", "operation", "exitCode", "members", "matches", "agentSessionPaths", "unresolvedAgentSessions", "content", "activeItemList"]);

function assertRegisteredReceiptKeys(value) {
  const registered = new Set([...RECEIPT_SCALAR_KEYS, ...RECEIPT_STRUCTURED_KEYS]);
  const unknown = Object.keys(value || {}).filter((key) => !registered.has(key));
  if (unknown.length > 0) {
    throw new Error(`helper receipt returned unregistered key(s): ${unknown.join(", ")}`);
  }
}

function writeReceipt(value) {
  assertRegisteredReceiptKeys(value);
  const prefix = value.ok === false ? "PARTIAL" : "OK";
  const lines = [
    `${prefix}: ${value.operation || "helper"}`,
  ];
  for (const key of RECEIPT_SCALAR_KEYS) {
    if (value[key] !== undefined && value[key] !== null) {
      lines.push(`${key}: ${value[key]}`);
    }
  }
  if (Array.isArray(value.members)) {
    lines.push("members:");
    for (const member of value.members) {
      const record = member.record === undefined || member.record === null ? "" : ` record=${member.record}`;
      const author = member.author === undefined || member.author === null ? "" : ` author=${member.author}`;
      const score = member.score === undefined ? "" : ` score=${member.score}`;
      lines.push(`- ${member.name} size=${member.size}${record}${author}${score} modified=${member.modified}`);
    }
  }
  if (Array.isArray(value.matches)) {
    lines.push("matches:");
    for (const match of value.matches) {
      const record = match.record === undefined || match.record === null ? "" : ` record=${match.record}`;
      const score = match.score === undefined ? "" : ` score=${match.score}`;
      lines.push(`- ${match.name || match.member} size=${match.size}${record}${score} modified=${match.modified}`);
    }
  }
  if (Array.isArray(value.agentSessionPaths)) {
    lines.push("agentSessionPaths:");
    for (const entry of value.agentSessionPaths) {
      lines.push(`- provider=${entry.provider} agent=${entry.agent} id=${entry.id} path=${entry.path} modified=${entry.modified} sizeBytes=${entry.sizeBytes}`);
    }
  }
  if (Array.isArray(value.unresolvedAgentSessions)) {
    lines.push("unresolvedAgentSessions:");
    for (const entry of value.unresolvedAgentSessions) {
      lines.push(`- provider=${entry.provider} agent=${entry.agent} id=${entry.id}`);
    }
  }
  if (value.content !== undefined) {
    lines.push("content:");
    lines.push(String(value.content).replace(/\s*$/, ""));
  }
  if (value.activeItemList !== undefined) {
    lines.push("BEGIN ACTIVE ITEMS");
    lines.push(String(value.activeItemList).replace(/\s*$/, ""));
    lines.push("END ACTIVE ITEMS");
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function drainConsumedTempInputFiles() {
  const paths = [...consumedTempInputPaths];
  consumedTempInputPaths.clear();
  const failed = [];
  for (const inputPath of paths) {
    try {
      fs.unlinkSync(inputPath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        failed.push(`${inputPath} (${error.code || error.message})`);
      }
    }
  }
  return failed;
}

function pruneActiveScratchDirectory() {
  if (!activeScratchRoot) {
    return [];
  }
  try {
    return pruneScratchDirectory(activeScratchRoot).failed;
  } catch (error) {
    return [`${activeScratchRoot} (${error.code || error.message})`];
  }
}

function appendWarning(result, warning) {
  if (!warning) {
    return result;
  }
  return {
    ...result,
    warning: result.warning ? `${result.warning}; ${warning}` : warning,
  };
}

function localZoneLabel(date) {
  const override = process.env.MPACT_ZONE_LABEL;
  if (override && override.trim()) {
    return override.trim();
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "shortGeneric",
    }).formatToParts(date);
    const zone = parts.find((part) => part.type === "timeZoneName");
    if (zone && zone.value) {
      return zone.value;
    }
  } catch {
    // Fall through to numeric offset.
  }
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function localTimestamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const datePart = `${yyyy}-${mm}-${dd}`;
  const zone = localZoneLabel(date);
  const filenameZone = sanitizeSlug(zone) || "local";
  return {
    body: `${datePart} ${hh}:${min}:${ss} ${zone}`,
    filename: `${datePart}-${hh}${min}${ss}-${filenameZone}`,
    date: datePart,
    zone,
    filenameZone,
  };
}

function sanitizeSlug(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function validateAgentToken(value) {
  const token = String(value || "");
  const slug = sanitizeSlug(token);
  return slug.length > 0 && !slug.includes("-");
}

function agentTokenValidator(value) {
  if (validateAgentToken(value)) {
    return null;
  }
  return `agent token must sanitize to a single non-empty token with no dash: ${value}`;
}

function defaultHomeDir(env = process.env) {
  return env.USERPROFILE || env.HOME || os.homedir();
}

function normalizePathForCompare(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function safeRealpath(value) {
  try {
    return realpathForContainment(value);
  } catch {
    return path.resolve(value);
  }
}

function pathLooksSymlinked(value) {
  return normalizePathForCompare(value) !== normalizePathForCompare(safeRealpath(value));
}

function providerInstallRoot(provider, env = process.env) {
  const home = defaultHomeDir(env);
  return path.join(home, ...AGENT_PROVIDERS[provider]);
}

function installedProviderFromScriptPath(scriptPath = process.argv[1], env = process.env) {
  if (!scriptPath) {
    return null;
  }
  const scriptDir = path.dirname(path.resolve(scriptPath));
  const skillRoot = path.dirname(scriptDir);
  if (path.basename(scriptDir).toLowerCase() !== "scripts") {
    return null;
  }
  if (pathLooksSymlinked(skillRoot)) {
    return null;
  }
  const normalizedSkillRoot = normalizePathForCompare(skillRoot);
  for (const provider of Object.keys(AGENT_PROVIDERS)) {
    const expectedRoot = providerInstallRoot(provider, env);
    if (pathLooksSymlinked(expectedRoot)) {
      continue;
    }
    if (normalizedSkillRoot === normalizePathForCompare(expectedRoot)) {
      return provider;
    }
  }
  return null;
}

function environmentProviderMarkers(env = process.env) {
  const markers = [];
  if (env[CLAUDE_AGENT_ENV]) {
    markers.push({ provider: "claude", name: CLAUDE_AGENT_ENV });
  }
  if (env[ANTIGRAVITY_AGENT_ENV]) {
    markers.push({ provider: "antigravity", name: ANTIGRAVITY_AGENT_ENV });
  }
  for (const name of CODEX_AGENT_ENV_VARS) {
    if (env[name]) {
      markers.push({ provider: "codex", name });
    }
  }
  return markers;
}

function environmentProvider(env = process.env) {
  const markers = environmentProviderMarkers(env);
  const providers = [...new Set(markers.map((marker) => marker.provider))];
  if (providers.length > 1) {
    throw new Error(`agent identity environment markers disagree: ${markers.map((marker) => `${marker.name}=${marker.provider}`).join(", ")}`);
  }
  return providers[0] || null;
}

function resolveAgentIdentity(options = {}) {
  const explicitAgent = options.explicitAgent;
  if (explicitAgent !== undefined && explicitAgent !== null && explicitAgent !== "") {
    const validation = agentTokenValidator(explicitAgent);
    if (validation) {
      throw new Error(validation);
    }
    return { agent: sanitizeSlug(explicitAgent), source: "explicit" };
  }

  const env = options.env || process.env;
  const scriptPath = options.scriptPath || process.argv[1];
  const pathProvider = installedProviderFromScriptPath(scriptPath, env);
  const envProvider = environmentProvider(env);
  if (pathProvider && envProvider && pathProvider !== envProvider) {
    throw new Error(`agent identity mismatch: installed skill path resolved ${pathProvider} but environment resolved ${envProvider}`);
  }
  const declaredAgent = env[DECLARED_AGENT_ENV];
  if (declaredAgent !== undefined && declaredAgent !== null && declaredAgent !== "") {
    const validation = agentTokenValidator(declaredAgent);
    if (validation) {
      throw new Error(validation);
    }
    const declared = sanitizeSlug(declaredAgent);
    if (RESERVED_AGENT_TOKENS.has(declared)) {
      throw new Error(`${DECLARED_AGENT_ENV} names a retired provider token and cannot be used for declared agent identity: ${declared}`);
    }
    const detectedProvider = pathProvider || envProvider;
    if (PROVIDER_TOKENS.has(declared) && detectedProvider && declared !== detectedProvider) {
      throw new Error(`${DECLARED_AGENT_ENV} resolved ${declared} but provider detection resolved ${detectedProvider}`);
    }
    return { agent: declared, source: "declared-environment" };
  }
  const agent = pathProvider || envProvider;
  if (!agent) {
    throw new Error("could not resolve agent identity; pass --agent explicitly or run from a recognized installed M-PACT provider skill");
  }
  return { agent, source: pathProvider ? "installed-skill-path" : "environment" };
}

function resolveAgentToken(args = {}, options = {}) {
  return resolveAgentIdentity({
    explicitAgent: args.agent,
    scriptPath: options.scriptPath,
    env: options.env,
  }).agent;
}

function memberName({ number, source, title, extension = ".md", includeSource = true }) {
  const prefix = includeSource
    ? `${String(number).padStart(4, "0")}-${sanitizeSlug(source) || "agent"}-`
    : `${String(number).padStart(4, "0")}-`;
  const suffix = extension.startsWith(".") ? extension : `.${extension}`;
  const available = MEMBER_NAME_MAX - prefix.length - suffix.length;
  if (available < 8) {
    throw new Error("member prefix leaves too little room for a descriptive slug");
  }
  let slug = sanitizeSlug(title) || "entry";
  if (slug.length > available) {
    slug = slug.slice(0, available).replace(/-+$/g, "");
  }
  if (!slug) {
    slug = "entry";
  }
  return `${prefix}${slug}${suffix}`;
}

function resolveTaskPath(input, args, options = {}) {
  return resolveMemoryTaskPath(input, args, options);
}

function resolveRootPath(input, args) {
  return resolveMemoryRootPath(input, args);
}

function yamlScalar(value) {
  if (value === undefined || value === null || value === "") {
    return "\"\"";
  }
  const text = String(value);
  if (/^[A-Za-z0-9_.\/+-]+$/.test(text)) {
    return text;
  }
  return JSON.stringify(text);
}

function yamlList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "[]";
  }
  return `[${values.map((value) => yamlScalar(value)).join(", ")}]`;
}

function runCli(main, options = {}) {
  try {
    assertNodeVersion();
    assertMpactAllowedInCurrentSession();
    const argv = process.argv.slice(2);
    assertKnownFlags(argv, options.acceptedFlags || [], options.unsupportedFlags || {});
    const args = parseArgs(argv);
    assertStringFlagValues(args, options.stringFlags || []);
    assertRequiredFlags(args, options.requiredFlags || []);
    assertRequiredOneOf(args, options.requiredOneOf || []);
    assertFlagValueValidators(args, options.flagValueValidators || {});
    prepareActiveScratchDirectory(args);
    const input = readInput(args, { stdinFlags: options.stdinFlags || [] });
    const result = main({ args, input });
    const cleanupFailures = drainConsumedTempInputFiles();
    const pruneFailures = pruneActiveScratchDirectory();
    let resultWithWarnings = result;
    if (cleanupFailures.length > 0) {
      resultWithWarnings = appendWarning(resultWithWarnings, `could not delete consumed helper input file(s): ${cleanupFailures.join(", ")}`);
    }
    if (pruneFailures.length > 0) {
      resultWithWarnings = appendWarning(resultWithWarnings, `could not prune stale helper scratch file(s): ${pruneFailures.join(", ")}`);
    }
    writeReceipt(resultWithWarnings);
    if (resultWithWarnings && resultWithWarnings.ok === false) {
      process.exit(resultWithWarnings.exitCode || 1);
    }
  } catch (error) {
    if (error && error.mpactNotice) {
      process.stdout.write(`${error.mpactNotice}\n`);
      process.exit(error.exitCode || 1);
    }
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  MEMBER_NAME_MAX,
  AGENT_IDENTITY_ENV_VARS,
  ANTIGRAVITY_AGENT_ENV,
  CLAUDE_AGENT_ENV,
  CODEX_AGENT_ENV_VARS,
  DECLARED_AGENT_ENV,
  MPACT_SUPPRESS_BEGIN,
  MPACT_SUPPRESS_END,
  MPACT_SUPPRESS_EXIT_CODE,
  MPACT_HOOK_CONTEXT_FLAG,
  STDIN_INPUT_FLAG,
  REFRESH_ACCEPTED_FLAGS,
  DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  assertMpactAllowedInCurrentSession,
  assertNoHelpProbe,
  assertKnownFlags,
  assertUnsupportedOperationFlags,
  assertFlagValueValidators,
  assertRequiredFlags,
  assertRequiredOneOf,
  assertStringFlagValues,
  booleanArg,
  isMpactHookContext,
  isMpactSuppressed,
  shouldReadStdin,
  localTimestamp,
  memberName,
  normalizeLineEndings,
  parseArgs,
  readInputFile,
  resolveAgentIdentity,
  resolveAgentToken,
  resolveRootPath,
  resolveTaskPath,
  runCli,
  sanitizeSlug,
  agentTokenValidator,
  validateAgentToken,
  yamlList,
  yamlScalar,
};
