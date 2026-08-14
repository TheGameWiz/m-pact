#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { listMembers, readMember } = require("./lib/zip-record-store");
const { REFRESH_ACCEPTED_FLAGS, assertKnownFlags, assertMpactAllowedInCurrentSession, isMpactHookContext, resolveAgentIdentity } = require("./lib/helper-common");
const {
  latestMember,
  withRecordMetadata,
} = require("./lib/container-state");
const {
  agentTaskLogPosition,
  newestAuthoredTaskLogMember,
} = require("./lib/active-items");
const { formatTaskLogCatalogLines } = require("./lib/task-log-catalog");
const {
  formatOrphanedSpecMembers,
  orphanedSpecificationMembers,
} = require("./lib/orphaned-companions");
const { installMpactRuntime, isUserRootComplete } = require("./lib/install-runtime");
const {
  adoptionNotice,
  defaultUserRoot,
  ensureCounterInitialized,
  readCounterSentinel,
  readProjectSentinel,
  validateProjectMemorySetupLocationVerdict,
} = require("./lib/project-identity");
const {
  pruneScratchDirectory,
  refreshBundlePath,
  removeRefreshBundle,
} = require("./lib/scratch");
const {
  SAVED_CONTEXT_STALE_MS,
  cleanupDuplicateSavedContexts,
  deleteSavedContext,
  listSavedContexts,
  parseSavedContextAnswer,
  readSavedContext,
  savedContextAgeMs,
} = require("./lib/saved-context");

const MIN_NODE_MAJOR = 18;
const EOL = os.EOL;
const RECENT_SESSION_BUDGET_BYTES = 25 * 1024;
const TRUNCATION_NOTICE = "\n\n[Truncated to fit the 25KB recent-session refresh budget.]";
const HOOK_RECEIPT_EMISSION_NOTE = "M-PACT HOOK NOTE: This refresh output was injected into agent context only. The Director has not seen the receipt. Verify the bundle, emit the receipt body verbatim at the start of the first response, follow any required refresh decision block, then continue the Director's requested work. In Antigravity, injected text is transient and the fast path must complete this turn.";

function parseArgs(argv) {
  const options = {
    startPath: process.cwd(),
    allowUserRootOnly: false,
    agent: null,
    savedContext: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--StartPath" || arg === "-StartPath" || arg === "--start-path") && next) {
      options.startPath = next;
      i++;
    } else if (arg === "--AllowUserRootOnly" || arg === "-AllowUserRootOnly" || arg === "--allow-user-root-only") {
      options.allowUserRootOnly = true;
    } else if (arg === "--agent" && next) {
      options.agent = next;
      i++;
    } else if ((arg === "--SavedContext" || arg === "-SavedContext" || arg === "--saved-context") && next) {
      options.savedContext = next;
      i++;
    }
  }

  return options;
}

function addLine(lines, line = "") {
  lines.push(line);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function existsDir(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveExisting(filePath) {
  return fs.realpathSync(filePath);
}

function convertInputPath(inputPath) {
  const match = inputPath.match(/^\/([a-zA-Z])\/(.*)$/);
  if (match && process.platform === "win32") {
    return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, "\\")}`;
  }
  return inputPath;
}

function formatList(items) {
  if (!items || items.length === 0) {
    return "[]";
  }
  return `[${items.join(", ")}]`;
}

function formatDisplayPath(filePath) {
  if (!filePath || filePath.startsWith("(")) {
    return filePath;
  }
  return process.platform === "win32" ? filePath.replace(/\\/g, "/") : filePath;
}

function formatDisplayPathList(items) {
  return formatList((items || []).map(formatDisplayPath));
}

function describeProjectIdentity(activeRoot, userRoot) {
  if (!activeRoot) {
    return { receipt: "projectIdentity=(none)", manifest: "- Project identity: (none)" };
  }
  const initialIdentity = readProjectSentinel(activeRoot);
  const initialCounter = readCounterSentinel(userRoot, { allowMissing: true });
  if (initialIdentity.state === "missing") {
    try {
      if (initialCounter.state === "missing") {
        ensureCounterInitialized(userRoot);
      } else if (initialCounter.state !== "valid") {
        throw new Error(`project identity counter is malformed: ${initialCounter.state}`);
      }
      const block = adoptionNotice(activeRoot).mpactNotice;
      return {
        receipt: "projectIdentity=adoption-required",
        manifest: "- Project identity: adoption-required",
        adoptionBlock: block,
      };
    } catch (error) {
      return {
        receipt: `projectIdentity=blocked`,
        manifest: `- Project identity: blocked (${error.message})`,
      };
    }
  }
  if (initialIdentity.state === "valid" && initialCounter.state === "missing") {
    try {
      ensureCounterInitialized(userRoot);
    } catch (error) {
      return {
        receipt: `projectId=${initialIdentity.projectId}; projectIdentity=blocked`,
        manifest: `- Project identity: project ${initialIdentity.projectId}; blocked (${error.message})`,
      };
    }
  }
  const identity = initialIdentity;
  if (identity.state !== "valid") {
    return {
      receipt: `projectIdentity=${identity.state}`,
      manifest: `- Project identity: ${identity.state}`,
    };
  }
  const counter = readCounterSentinel(userRoot);
  if (counter.state !== "valid") {
    return {
      receipt: `projectId=${identity.projectId}; projectIdentity=counter-${counter.state}`,
      manifest: `- Project identity: project ${identity.projectId}; counter ${counter.state}`,
    };
  }
  const status = identity.projectId > counter.value ? "id-above-counter" : "ok";
  return {
    receipt: `projectId=${identity.projectId}; projectIdentity=${status}`,
    manifest: `- Project identity: project ${identity.projectId}; ${status}`,
  };
}

function listSessionArtifacts(root) {
  const artifacts = [];
  const sessionsZip = path.join(root, "sessions.zip");
  if (existsFile(sessionsZip)) {
    for (const member of listMembers(sessionsZip)) {
      artifacts.push({
        name: member.name,
        label: `${sessionsZip}#${member.name}`,
        modified: member.modified,
        readFull: () => readMember(sessionsZip, member.name).toString("utf8"),
      });
    }
  }

  return artifacts.sort((a, b) => b.name.localeCompare(a.name));
}

function addArtifact(lines, title, artifactPath, body) {
  addLine(lines, `### ${title}`);
  addLine(lines);
  addLine(lines, `Path: ${formatDisplayPath(artifactPath)}`);
  addLine(lines);
  addLine(lines, "```text");
  addLine(lines, String(body || "").trimEnd());
  addLine(lines, "```");
  addLine(lines);
}

function getArtifactByteCount(title, artifactPath, body) {
  const lines = [
    `### ${title}`,
    "",
    `Path: ${formatDisplayPath(artifactPath)}`,
    "",
    "```text",
    String(body || "").trimEnd(),
    "```",
    "",
  ];
  return utf8ByteCount(lines.join(EOL) + EOL);
}

function truncateTextToByteBudget(text, maxBytes, notice = TRUNCATION_NOTICE) {
  if (maxBytes <= 0) {
    return "";
  }

  const source = String(text || "").trimEnd();
  if (utf8ByteCount(source) <= maxBytes) {
    return source;
  }

  const noticeBytes = utf8ByteCount(notice);
  const bodyBudget = Math.max(0, maxBytes - noticeBytes);
  let clipped = Buffer.from(source, "utf8").subarray(0, bodyBudget).toString("utf8").trimEnd();
  while (utf8ByteCount(clipped) + noticeBytes > maxBytes && clipped.length > 0) {
    clipped = clipped.slice(0, -1).trimEnd();
  }

  if (utf8ByteCount(notice) > maxBytes) {
    return clipped;
  }

  return `${clipped}${notice}`;
}

function writeFailureAndExit(resolvedStart, failures) {
  console.log("AUDIT: FAIL");
  console.log("M-PACT REFRESH FAILURE");
  console.log(`StartPath: ${formatDisplayPath(resolvedStart)}`);
  console.log(`Failure count: ${failures.length}`);
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
  console.log("END REFRESH FAILURE");
  process.exit(1);
}

function writeProjectSetupRequiredAndExit(details) {
  console.log("M-PACT PROJECT SETUP REQUIRED");
  console.log(`StartPath: ${formatDisplayPath(details.resolvedStart)}`);
  console.log(`Active: (none found)`);
  console.log(`Project: (none found)`);
  console.log(`User: ${formatDisplayPath(details.userDisplay)}`);
  console.log(`Chain: ${formatDisplayPathList(details.chain)}`);
  console.log("No project .AgentMemory/ root was found for this workspace.");
  console.log("Ask the Director whether to create project M-PACT scaffolding here before emitting any refresh receipt.");
  console.log("Question: No project M-PACT root was found for this workspace. Create project M-PACT scaffolding here? This will add .AgentMemory/. Artifact folders and ZIP containers are created lazily when first used. Project startup shims are not part of project bootstrap. Answer yes or no.");
  console.log("If yes: follow references/bootstrap-project.md, then run refresh again.");
  console.log("If no: say \"M-PACT: no memory root here; refresh skipped\" and stop. User-root-only refresh requires a separate explicit Director request with --AllowUserRootOnly.");
  console.log("END PROJECT SETUP REQUIRED");
  process.exit(0);
}

function utf8ByteCount(text) {
  if (text == null) {
    return 0;
  }
  return Buffer.byteLength(String(text), "utf8");
}

function formatKB(bytes) {
  return String(Math.round((bytes / 1024) * 10) / 10);
}

function listMarkdownFiles(dirPath) {
  if (!existsDir(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => ({
      name: entry.name,
      fullName: path.join(dirPath, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listDirectories(dirPath, prefix) {
  if (!existsDir(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function taskNumberValue(taskName) {
  const match = /-t(\d{4})-/.exec(taskName);
  return match ? Number.parseInt(match[1], 10) : -1;
}

function taskLogMembers(taskPath) {
  const logZip = path.join(taskPath, "log.zip");
  if (!existsFile(logZip)) {
    return [];
  }
  return listMembers(logZip)
    .map((member) => withRecordMetadata(member, { recordsExpected: true }))
    .sort((a, b) => {
      const ar = a.record === null ? Number.MAX_SAFE_INTEGER : a.record;
      const br = b.record === null ? Number.MAX_SAFE_INTEGER : b.record;
      return ar - br || a.name.localeCompare(b.name);
    });
}

function formatAgeSince(isoTimestamp) {
  const time = Date.parse(isoTimestamp);
  if (!Number.isFinite(time)) {
    return "(unknown)";
  }
  return formatAgeMs(Date.now() - time);
}

function formatAgeMs(ageMs) {
  if (!Number.isFinite(ageMs)) {
    return "(unknown)";
  }
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

function addAgentTaskLogRefresh(lines, taskPath, agent) {
  if (!agent) {
    throw new Error("agent task-log refresh requires resolved agent identity");
  }
  const logZip = path.join(taskPath, "log.zip");
  const members = taskLogMembers(taskPath);
  const newest = latestMember(members, { defaultSort: "record-asc" });
  const position = agentTaskLogPosition(members, agent);
  const cursorRecord = newestAuthoredTaskLogMember(members, agent);
  addLine(lines, "## Agent Task Log Refresh");
  addLine(lines);
  addLine(lines, `Agent: ${agent}`);
  addLine(lines, `Task: ${path.basename(taskPath)}`);
  addLine(lines, `Read-cursor: ${position.readCursor}`);
  addLine(lines, `Unread records after read-cursor: ${position.unread.length}; by author: ${position.unreadByAuthor}`);
  addLine(lines, `Newest record age: ${newest ? formatAgeSince(newest.modified) : "(none)"}`);
  for (const line of formatTaskLogCatalogLines(members, { taskId: taskNumberValue(path.basename(taskPath)) >= 0 ? `t${String(taskNumberValue(path.basename(taskPath))).padStart(4, "0")}` : path.basename(taskPath) })) {
    addLine(lines, line);
  }
  if (!cursorRecord) {
    addLine(lines, "Task-log cursor record: (none)");
    addLine(lines, "This agent has no authored task log record on the current task. Take a handoff when task-log catch-up is needed.");
    addLine(lines);
    return;
  }
  addLine(lines, `Task-log cursor record: ${String(cursorRecord.record).padStart(4, "0")} (${cursorRecord.name})`);
  addLine(lines, `Task-log cursor age: ${formatAgeSince(cursorRecord.modified)}`);
  addLine(lines);
  const text = readMember(logZip, cursorRecord.name).toString("utf8");
  addArtifact(lines, "agent-task-log-cursor", `${logZip}#${cursorRecord.name}`, text);
}

function writeSavedContextDecisionRequiredAndExit(details) {
  console.log("M-PACT SAVED CONTEXT DECISION REQUIRED");
  console.log(`Root: ${formatDisplayPath(details.rootPath)}`);
  console.log(`Agent: ${details.agent}`);
  console.log(`SavedContextTimestamp: ${details.context.timestamp}`);
  console.log(`SavedContextFile: ${details.context.name}`);
  console.log(`SavedContextAge: ${formatAgeMs(savedContextAgeMs(details.context))}`);
  console.log(`Saved context is older than the ${Math.round(SAVED_CONTEXT_STALE_MS / 60000)} minute automatic restore threshold.`);
  console.log("Ask the Director whether to use this saved context before emitting any refresh receipt.");
  console.log(`If yes: run refresh again with --saved-context RESTORE:${details.context.name}`);
  console.log(`If no: run refresh again with --saved-context DISCARD:${details.context.name}`);
  console.log("END SAVED CONTEXT DECISION REQUIRED");
  process.exit(0);
}

function writeSavedContextUnhandledAndExit(details) {
  console.log("AUDIT: FAIL");
  console.log("M-PACT REFRESH FAILURE");
  console.log(`StartPath: ${formatDisplayPath(details.resolvedStart)}`);
  console.log("Failure count: 1");
  console.log("- M-PACT SAVED CONTEXT UNHANDLED: saved context file(s) are present, but refresh cannot decide which running agent owns this startup.");
  console.log(`Root: ${formatDisplayPath(details.rootPath)}`);
  console.log(`Agent: (unresolved)`);
  console.log(`Reason: ${details.reason}`);
  console.log("SavedContextFiles:");
  for (const context of details.contexts) {
    console.log(`- ${context.name}`);
  }
  console.log("Pass --agent <token> from a recognized local runtime or fix the conflicting provider markers before emitting any refresh receipt.");
  console.log("END REFRESH FAILURE");
  process.exit(1);
}

function addAgentTaskLogRefreshUnavailable(lines, taskPath, reason) {
  addLine(lines, "## Agent Task Log Refresh");
  addLine(lines);
  addLine(lines, `Task: ${path.basename(taskPath)}`);
  addLine(lines, "Agent: (unresolved)");
  addLine(lines, `Per-agent saved context restore unavailable: ${reason}`);
  addLine(lines, "Pass --agent <token> to override when running from an unrecognized local runtime.");
  addLine(lines);
}

function orphanedCompanionsForTask(taskPath) {
  const orphaned = orphanedSpecificationMembers(taskPath);
  if (orphaned.length === 0) {
    return null;
  }
  return `${path.basename(taskPath)}: ${formatOrphanedSpecMembers(orphaned)}`;
}

function orderActiveTasks(taskNames, currentTask) {
  const sorted = [...taskNames].sort((a, b) => taskNumberValue(b) - taskNumberValue(a) || a.localeCompare(b));
  if (!currentTask || !sorted.includes(currentTask)) {
    return sorted;
  }
  return [currentTask, ...sorted.filter((taskName) => taskName !== currentTask)];
}

function generatedTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offsetHour = pad(Math.floor(abs / 60));
  const offsetMinute = pad(abs % 60);
  return `${year}-${month}-${day} ${hour}:${minute}:${second} ${sign}${offsetHour}:${offsetMinute}`;
}

function assertSupportedNode() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
    writeFailureAndExit(process.cwd(), [
      `Node.js ${MIN_NODE_MAJOR}+ is required; current version is ${process.versions.node}`,
    ]);
  }
}

function main() {
  assertMpactAllowedInCurrentSession();
  assertSupportedNode();

  const argv = process.argv.slice(2);
  assertKnownFlags(argv, REFRESH_ACCEPTED_FLAGS);
  const options = parseArgs(argv);
  // Agent identity resolves before any root-dependent halt so every later
  // no-bundle exit can name the deterministic bundle it must remove.
  let agentResolution = null;
  let agentResolutionError = null;
  try {
    agentResolution = resolveAgentIdentity({ explicitAgent: options.agent, scriptPath: process.argv[1] });
  } catch (error) {
    if (options.agent || options.savedContext) {
      throw error;
    }
    agentResolutionError = error;
  }
  const failures = [];
  const sessionReads = [];
  const bundle = [];
  const coreRuleNames = [];
  const ruleIndexParts = [];
  const scriptDir = __dirname;
  const skillDir = path.dirname(scriptDir);
  const startupContractPath = path.join(skillDir, "references", "startup-contract.md");
  let refreshInstallResults = null;
  let refreshExternalActions = [];
  let refreshSetupFailed = false;
  let startupContractText = null;
  let activeTaskNames = [];
  let startupTaskRead = "(none)";
  let startupTaskText = "";
  let currentTaskPointer = "(none)";
  const missingOrAmbiguous = [];
  const orphanedSpecCompanions = [];
  let savedContextRestore = null;
  let setupLocationRefusal = null;

  if (existsFile(startupContractPath)) {
    try {
      startupContractText = readText(startupContractPath);
    } catch (error) {
      failures.push(`Failed to read startup contract reference: ${startupContractPath} (${error.message})`);
    }
  } else {
    failures.push(`Missing startup contract reference: ${startupContractPath}`);
  }

  const inputStartPath = convertInputPath(options.startPath);
  let resolvedStart = options.startPath;
  let startDir = null;
  try {
    const stat = fs.statSync(inputStartPath);
    startDir = stat.isDirectory() ? inputStartPath : path.dirname(inputStartPath);
    resolvedStart = resolveExisting(startDir);
  } catch (error) {
    failures.push(`StartPath could not be resolved: ${options.startPath} (${error.message})`);
    writeFailureAndExit(options.startPath, failures);
  }

  const userRoot = defaultUserRoot();
  if (!isUserRootComplete(userRoot)) {
    try {
      const setup = installMpactRuntime({ skillRoot: skillDir, userRoot });
      refreshInstallResults = setup.results;
      refreshExternalActions = setup.externalActions || [];
    } catch (error) {
      refreshSetupFailed = true;
      failures.push(`Failed to initialize missing user root ${userRoot}: ${error.message}`);
    }
  }
  if (!refreshSetupFailed && !existsDir(userRoot)) {
    failures.push(`Required user root is missing after setup attempt: ${userRoot}`);
  }

  const nearestFirstProjectRoots = [];
  let cursor = resolvedStart;
  while (cursor) {
    const candidate = path.join(cursor, ".AgentMemory");
    if (existsDir(candidate)) {
      nearestFirstProjectRoots.push(resolveExisting(candidate));
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  const projectRoots = nearestFirstProjectRoots.slice().reverse();
  const activeRoot = projectRoots.length > 0 ? projectRoots[projectRoots.length - 1] : null;
  const chain = [];
  if (existsDir(userRoot)) {
    chain.push(resolveExisting(userRoot));
  }
  for (const root of projectRoots) {
    chain.push(root);
  }

  // Delete early, write late: remove this agent's deterministic bundle as soon
  // as the scratch root is known, so any halt below leaves no stale bundle. A
  // successful refresh rewrites it at the end. Halts before this point have no
  // scratch root and therefore nothing to delete.
  const bundleAgentToken = agentResolution ? agentResolution.agent : null;
  const bundleScratchRoot = activeRoot || (existsDir(userRoot) ? resolveExisting(userRoot) : null);
  if (bundleScratchRoot) {
    removeRefreshBundle(bundleScratchRoot, bundleAgentToken);
  }

  if (!activeRoot && !options.allowUserRootOnly) {
    const setupVerdict = validateProjectMemorySetupLocationVerdict({
      projectPath: resolvedStart,
      userRoot,
    });
    if (!setupVerdict.ok) {
      setupLocationRefusal = setupVerdict.message;
      options.allowUserRootOnly = true;
    }
  }

  if (!activeRoot && !options.allowUserRootOnly) {
    if (failures.length > 0) {
      writeFailureAndExit(resolvedStart, failures);
    }
    writeProjectSetupRequiredAndExit({
      resolvedStart,
      userDisplay: resolveExisting(userRoot),
      chain,
    });
  }

  for (const root of chain) {
    const rulesDir = path.join(root, "rules");
    const rules = listMarkdownFiles(rulesDir);
    const nonCoreCount = rules.filter((rule) => !rule.name.startsWith("core-")).length;
    ruleIndexParts.push(`${formatDisplayPath(root)}: ${rules.length} rules, ${nonCoreCount} unread non-core`);

    for (const rule of rules.filter((item) => item.name.startsWith("core-"))) {
      coreRuleNames.push(rule.name);
    }
  }

  let sessionBudgetUsed = 0;
  let sessionBudgetTruncated = false;

  if (activeRoot) {
    const file = listSessionArtifacts(activeRoot)[0];
    if (file) {
      try {
        let text = file.readFull();
        let mode = "full";
        let artifactBytes = getArtifactByteCount(mode, file.label, text);
        if (artifactBytes > RECENT_SESSION_BUDGET_BYTES) {
          mode = "full-truncated";
          const overheadBytes = getArtifactByteCount(mode, file.label, "");
          text = truncateTextToByteBudget(text, RECENT_SESSION_BUDGET_BYTES - overheadBytes);
          artifactBytes = getArtifactByteCount(mode, file.label, text);
          sessionBudgetTruncated = true;
        }
        sessionReads.push({ root: activeRoot, path: file.label, mode, text, modified: file.modified });
        sessionBudgetUsed += artifactBytes;
      } catch (error) {
        failures.push(`Failed to read selected active-root session: ${file.label} (${error.message})`);
      }
    }
  }

  if (activeRoot) {
    const tasksDir = path.join(activeRoot, "tasks");
    if (existsDir(tasksDir)) {
      activeTaskNames = listDirectories(tasksDir, "A__");
      for (const taskName of activeTaskNames) {
        const taskPath = path.join(tasksDir, taskName);
        const taskMd = path.join(taskPath, "task.md");
        if (!existsFile(taskMd)) {
          missingOrAmbiguous.push(`active task folder is missing task.md: ${taskName}`);
        }
        const orphaned = orphanedCompanionsForTask(taskPath);
        if (orphaned) {
          orphanedSpecCompanions.push(orphaned);
        }
      }
      let selectedTask = null;
      const taskEntries = fs.readdirSync(tasksDir, { withFileTypes: true });
      const currentPointers = taskEntries
        .filter((entry) => entry.isFile() && entry.name.startsWith("current__"))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      if (currentPointers.length === 1) {
        const pointerName = currentPointers[0];
        const pointerPath = path.join(tasksDir, pointerName);
        const pointerStat = fs.statSync(pointerPath);
        currentTaskPointer = pointerName.slice("current__".length);
        const candidateTaskPath = path.join(tasksDir, currentTaskPointer);
        if (pointerStat.size !== 0) {
          missingOrAmbiguous.push(`current task pointer ${pointerName} must be a zero-byte sentinel`);
        }
        if (/^A__/.test(currentTaskPointer) && existsDir(candidateTaskPath)) {
          selectedTask = currentTaskPointer;
        } else {
          missingOrAmbiguous.push(`stale current task pointer ${pointerName}; remove it or explicitly choose an active task`);
        }
      } else if (currentPointers.length > 1) {
        currentTaskPointer = "(none; multiple current task sentinels)";
        missingOrAmbiguous.push(`multiple current task sentinels found: ${currentPointers.join(", ")}; no current task selected`);
      }

      activeTaskNames = orderActiveTasks(activeTaskNames, selectedTask);

      if (selectedTask) {
        const taskMd = path.join(tasksDir, selectedTask, "task.md");
        if (existsFile(taskMd)) {
          try {
            startupTaskText = readText(taskMd);
            startupTaskRead = `${selectedTask}/task.md`;
          } catch (error) {
            failures.push(`Failed to read startup task file: ${taskMd} (${error.message})`);
          }
        } else {
          missingOrAmbiguous.push(`selected startup task is missing task.md: ${taskMd}`);
        }
      }
    }
  }

  if (failures.length > 0) {
    writeFailureAndExit(resolvedStart, failures);
  }

  const savedContextRoot = activeRoot || resolveExisting(userRoot);
  if (agentResolution && agentResolution.agent) {
    const cleanup = cleanupDuplicateSavedContexts(savedContextRoot, agentResolution.agent);
    if (cleanup.failed.length > 0) {
      throw new Error(`could not clean up duplicate saved context file(s): ${cleanup.failed.join(", ")}`);
    }
    const currentSavedContext = cleanup.current;
    if (options.savedContext) {
      const answer = parseSavedContextAnswer(options.savedContext);
      if (!answer) {
        throw new Error("--saved-context must be RESTORE:<filename> or DISCARD:<filename>");
      }
      if (!currentSavedContext || answer.filename !== currentSavedContext.name) {
        throw new Error(`--saved-context names a missing, wrong, or stale file: ${answer.filename}`);
      }
      const body = answer.action === "RESTORE" ? readSavedContext(currentSavedContext) : null;
      const failure = deleteSavedContext(currentSavedContext);
      if (failure) {
        throw new Error(`could not delete consumed saved context file: ${failure}`);
      }
      savedContextRestore = {
        action: answer.action === "RESTORE" ? "restored" : "discarded",
        agent: agentResolution.agent,
        context: currentSavedContext,
        body,
      };
    } else if (currentSavedContext) {
      if (savedContextAgeMs(currentSavedContext) >= SAVED_CONTEXT_STALE_MS) {
        writeSavedContextDecisionRequiredAndExit({
          rootPath: savedContextRoot,
          agent: agentResolution.agent,
          context: currentSavedContext,
        });
      }
      const body = readSavedContext(currentSavedContext);
      const failure = deleteSavedContext(currentSavedContext);
      if (failure) {
        throw new Error(`could not delete consumed saved context file: ${failure}`);
      }
      savedContextRestore = {
        action: "restored",
        agent: agentResolution.agent,
        context: currentSavedContext,
        body,
      };
    }
  } else if (options.savedContext) {
    throw new Error("saved context answer requires resolved agent identity");
  } else {
    const unhandledContexts = listSavedContexts(savedContextRoot);
    if (unhandledContexts.length > 0) {
      writeSavedContextUnhandledAndExit({
        resolvedStart,
        rootPath: savedContextRoot,
        reason: agentResolutionError ? agentResolutionError.message : "agent identity could not be resolved",
        contexts: unhandledContexts,
      });
    }
  }

  const chainDisplay = formatDisplayPathList(chain);
  const projectDisplay = activeRoot ? formatDisplayPath(activeRoot) : "(none found)";
  const activeDisplay = projectDisplay;
  const userDisplay = formatDisplayPath(resolveExisting(userRoot));
  const ruleIndexDisplay = ruleIndexParts.length > 0 ? ruleIndexParts.join("; ") : "(none)";
  const missingOrAmbiguousDisplay = missingOrAmbiguous.length > 0 ? formatList(missingOrAmbiguous) : "[(none)]";
  const projectRootsDisplay = formatDisplayPathList(projectRoots);
  const projectIdentityDisplay = describeProjectIdentity(activeRoot, userRoot);
  const orphanedSpecCompanionsDisplay = orphanedSpecCompanions.length > 0 ? orphanedSpecCompanions.join("; ") : null;
  const receiptLines = [
    "M-PACT MEMORY REFRESH",
    `activeProjectRoot=${activeDisplay}; ${projectIdentityDisplay.receipt}`,
    ...(setupLocationRefusal ? [`projectSetup=skipped-disallowed-location; reason=${setupLocationRefusal}`] : []),
    ...(savedContextRestore ? [`savedContext=${savedContextRestore.action}; agent=${savedContextRestore.agent}; timestamp=${savedContextRestore.context.timestamp}; filename=${savedContextRestore.context.name}`] : []),
    ...refreshExternalActions.map((action) => `providerSetup=${action}`),
    ...(orphanedSpecCompanionsDisplay ? [`orphanedSpecMembers=${orphanedSpecCompanionsDisplay}`] : []),
    "audit=PASS; bundle=loaded; output-complete=END REFRESH BUNDLE",
  ];
  addLine(bundle, "AUDIT: PASS");
  addLine(bundle, "M-PACT REFRESH BUNDLE");
  addLine(bundle, `Generated: ${generatedTimestamp()}`);
  addLine(bundle, `StartPath: ${formatDisplayPath(resolvedStart)}`);
  addLine(bundle);
  addLine(bundle, "BEGIN REFRESH RECEIPT");
  for (const line of receiptLines) {
    addLine(bundle, line);
  }
  addLine(bundle, "END REFRESH RECEIPT");
  if (projectIdentityDisplay.adoptionBlock) {
    addLine(bundle);
    addLine(bundle, projectIdentityDisplay.adoptionBlock);
  }
  if (savedContextRestore && savedContextRestore.body !== null) {
    addLine(bundle);
    addLine(bundle, "## Saved Context Restore");
    addLine(bundle);
    addLine(bundle, `Agent: ${savedContextRestore.agent}`);
    addLine(bundle, `SavedContextTimestamp: ${savedContextRestore.context.timestamp}`);
    addLine(bundle, `SavedContextFile: ${savedContextRestore.context.name}`);
    addLine(bundle);
    addLine(bundle, "```text");
    addLine(bundle, String(savedContextRestore.body || "").trimEnd());
    addLine(bundle, "```");
  }
  addLine(bundle);
  addLine(bundle, "## Root And Startup Manifest");
  addLine(bundle);
  addLine(bundle, `- Start path: ${formatDisplayPath(resolvedStart)}`);
  addLine(bundle, `- Required user root: ${userDisplay}`);
  addLine(bundle, `- User setup during refresh: ${refreshInstallResults ? "performed" : "not needed"}`);
  if (refreshInstallResults) {
    for (const result of refreshInstallResults) {
      addLine(bundle, `  - ${result}`);
    }
  }
  addLine(bundle, `- Project roots, broad-to-specific: ${projectRootsDisplay}`);
  addLine(bundle, `- Active project root: ${activeDisplay}`);
  if (setupLocationRefusal) {
    addLine(bundle, `- Project setup skipped: ${setupLocationRefusal}`);
  }
  addLine(bundle, projectIdentityDisplay.manifest);
  addLine(bundle, `- Memory chain, broad-to-specific: ${chainDisplay}`);
  addLine(bundle, `- Missing or ambiguous: ${missingOrAmbiguousDisplay}`);
  addLine(bundle, `- Orphaned specification companions: ${orphanedSpecCompanionsDisplay || "(none)"}`);
  addLine(bundle, "- Startup session selection: active root only by filename descending; newest session full or truncated, with rendered session artifact capped at 25KB.");
  addLine(bundle, "- Startup task selection: active root only, read task.md only when exactly one zero-byte tasks/current__<task-folder> sentinel points to an active task; never infer a replacement current task.");
  addLine(bundle, "- Startup exclusions: rule bodies, design specification bodies, task logs, journals, and case studies.");
  addLine(bundle);
  addLine(bundle, "## Protocol References Loaded Or Verified");
  addLine(bundle);
  addArtifact(bundle, "startup-contract.md", startupContractPath, startupContractText);
  addLine(bundle, "## Core Rule Names Noted");
  addLine(bundle);
  addLine(bundle, `Rule index: ${ruleIndexDisplay}.`);
  addLine(bundle, "This rule index is level one of the rules: each filename below is a rule in force as stated. When current work correlates to an entry, read the rule body before proceeding; the body is the controlling detail. Non-core rules are lookup-only.");
  addLine(bundle);
  if (coreRuleNames.length === 0) {
    addLine(bundle, "(none)");
    addLine(bundle);
  } else {
    for (const ruleName of coreRuleNames) {
      addLine(bundle, `- ${ruleName}`);
    }
    addLine(bundle);
  }

  addLine(bundle, "## Recent Sessions Loaded");
  addLine(bundle);
  addLine(bundle, `Budget: ${formatKB(RECENT_SESSION_BUDGET_BYTES)}KB rendered session artifacts; used ${formatKB(sessionBudgetUsed)}KB.`);
  addLine(bundle, "Session entries are point-in-time project notes. They may or may not be useful, and they may be stale.");
  addLine(bundle, "If a session entry disagrees with this bundle's task sections or the current-task sentinel, those task sections and sentinel are authoritative.");
  if (sessionBudgetTruncated) {
    addLine(bundle, "Newest session was truncated to fit the recent-session budget.");
  }
  addLine(bundle);
  if (sessionReads.length === 0) {
    addLine(bundle, "(none)");
    addLine(bundle);
  } else {
    for (const session of sessionReads) {
      addLine(bundle, `Rendered session age: ${formatAgeSince(session.modified)}`);
      addLine(bundle);
      addArtifact(bundle, `${session.mode}: ${path.basename(session.path)}`, session.path, session.text);
    }
  }

  addLine(bundle, "## Active Tasks Noted");
  addLine(bundle);
  if (activeTaskNames.length === 0) {
    addLine(bundle, "(none)");
    addLine(bundle);
  } else {
    for (const taskName of activeTaskNames) {
      addLine(bundle, `- ${taskName}`);
    }
    addLine(bundle);
  }

  if (startupTaskRead !== "(none)") {
    const taskFolder = startupTaskRead.replace(/\/task\.md$/, "");
    const taskPath = path.join(activeRoot, "tasks", taskFolder, "task.md");
    addArtifact(bundle, `Startup task: ${startupTaskRead}`, taskPath, startupTaskText);
    if (agentResolution && agentResolution.agent) {
      addAgentTaskLogRefresh(bundle, path.dirname(taskPath), agentResolution.agent);
    } else {
      addAgentTaskLogRefreshUnavailable(bundle, path.dirname(taskPath), agentResolutionError ? agentResolutionError.message : "agent identity could not be resolved");
    }
  }

  addLine(bundle, "END REFRESH BUNDLE");

  const bundleText = bundle.join(EOL) + EOL;
  const bundleBytes = utf8ByteCount(bundleText);
  const bundleLineCount = bundleText.split(/\r?\n/).length - 1;

  const scratchRoot = activeRoot || resolveExisting(userRoot);
  const pruneResult = pruneScratchDirectory(scratchRoot);
  const bundlePath = refreshBundlePath(scratchRoot, bundleAgentToken);
  fs.writeFileSync(bundlePath, bundleText, { encoding: "utf8" });

  console.log("AUDIT: PASS");
  console.log("M-PACT REFRESH BUNDLE MANIFEST");
  console.log(`BundlePath: ${bundlePath}`);
  console.log(`BundleBytes: ${bundleBytes}`);
  console.log(`LineCount: ${bundleLineCount}`);
  console.log(`RecentSessionBudgetKB: ${formatKB(RECENT_SESSION_BUDGET_BYTES)}`);
  if (pruneResult.failed.length > 0) {
    console.log(`ScratchPruneWarning: ${pruneResult.failed.join(", ")}`);
  }
  console.log("BEGIN REFRESH RECEIPT");
  for (const line of receiptLines) {
    console.log(line);
  }
  console.log("END REFRESH RECEIPT");
  if (projectIdentityDisplay.adoptionBlock) {
    console.log(projectIdentityDisplay.adoptionBlock);
  }
  if (isMpactHookContext()) {
    console.log(HOOK_RECEIPT_EMISSION_NOTE);
  }
  console.log("END REFRESH BUNDLE");
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
