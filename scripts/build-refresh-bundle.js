#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { listMembers, readMember } = require("./lib/zip-record-store");
const { providerSessionIdForAgent, recordCurrentAgentSession } = require("./lib/agents-store");
const { REFRESH_ACCEPTED_FLAGS, assertKnownFlags, assertMpactAllowedInCurrentSession, isMpactHookContext, resolveAgentIdentity } = require("./lib/helper-common");
const {
  newestResolvedAgentSessionPaths,
  resolveEntry,
} = require("./list-agent-session-paths");
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
const { withTaskOperationLock } = require("./lib/task-state");

function taskIdForTaskPath(taskPath) {
  const value = taskNumberValue(path.basename(taskPath));
  return value >= 0 ? `t${String(value).padStart(4, "0")}` : path.basename(taskPath);
}

function collapseBlankLines(lines) {
  const output = [];
  let blank = false;
  for (const line of lines) {
    if (line.trim() === "") {
      if (!blank) {
        output.push("");
      }
      blank = true;
      continue;
    }
    output.push(line);
    blank = false;
  }
  return output;
}

function compactRepeatedTaskLogItemLines(lines, seenItemMentions, member) {
  if (!seenItemMentions) {
    return lines;
  }
  const recordLabel = String(member.record).padStart(4, "0");
  return lines.map((line) => {
    const match = /^(- \[([A-Za-z0-9._-]+)\] )(.*)$/.exec(line);
    if (!match) {
      return line;
    }
    const normalized = line.trim();
    const previous = seenItemMentions.get(match[2]);
    if (previous && previous.normalized === normalized) {
      return `${match[1]}(unchanged repeat omitted; newest full mention retained in record ${previous.recordLabel})`;
    }
    seenItemMentions.set(match[2], { normalized, recordLabel });
    return line;
  });
}

function compactTaskLogText(text, options = {}) {
  const source = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
  const lines = source.length > 0 ? source.split("\n") : [];
  const output = [];
  let inFrontMatter = lines[0] === "---";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (inFrontMatter) {
      if (index === 0) {
        continue;
      }
      if (line === "---") {
        inFrontMatter = false;
      }
      continue;
    }
    if (/^(record|timestamp|agents|agent|source|task|taskPath|projectId):\s/i.test(line)) {
      continue;
    }
    if (/^(OK|PARTIAL|AUDIT):\s/.test(line)) {
      continue;
    }
    output.push(line);
  }
  return compactRepeatedTaskLogItemLines(collapseBlankLines(output), options.seenItemMentions, options.member)
    .join("\n")
    .trimEnd();
}

function renderFallbackTaskLogRecord(member, logZip, text) {
  return [
    `### task-log-digest: ${member.name}`,
    "",
    `Path: ${formatDisplayPath(`${logZip}#${member.name}`)}`,
    `Record: ${String(member.record).padStart(4, "0")}; author: ${member.author || "(none)"}; modified: ${member.modified}`,
    "",
    "```text",
    String(text || "").trimEnd(),
    "```",
    "",
  ].join(EOL);
}

function addFallbackTaskLogDigest(lines, taskPath, agent, budgetBytes = FALLBACK_TASK_LOG_BUDGET_BYTES) {
  const logZip = path.join(taskPath, "log.zip");
  const members = taskLogMembers(taskPath);
  const position = agentTaskLogPosition(members, agent);
  const cursorRecord = newestAuthoredTaskLogMember(members, agent);
  const cursor = cursorRecord ? cursorRecord.record : position.readCursor;
  const taskId = taskIdForTaskPath(taskPath);
  const candidates = members
    .filter((member) => member.record !== null && member.record <= cursor)
    .sort((a, b) => b.record - a.record || b.name.localeCompare(a.name));
  const selected = [];
  const seenItemMentions = new Map();
  let used = 0;
  for (const member of candidates) {
    const text = compactTaskLogText(readMember(logZip, member.name).toString("utf8"), { seenItemMentions, member });
    const rendered = renderFallbackTaskLogRecord(member, logZip, text);
    const bytes = utf8ByteCount(rendered);
    if (selected.length > 0 && used + bytes > budgetBytes) {
      break;
    }
    selected.push({ member, rendered, bytes });
    used += bytes;
  }
  const selectedRecords = selected.map((item) => item.member.record).filter(Number.isFinite);
  const oldestIncluded = selectedRecords.length > 0 ? Math.min(...selectedRecords) : null;
  const omittedOlder = oldestIncluded === null
    ? candidates.length
    : candidates.filter((member) => member.record < oldestIncluded).length;
  const omittedRange = omittedOlder > 0 && oldestIncluded !== null
    ? `0001-${String(oldestIncluded - 1).padStart(4, "0")}`
    : omittedOlder > 0 ? `0001-${String(cursor).padStart(4, "0")}` : "(none)";

  addLine(lines, "## Fallback Task Log Digest");
  addLine(lines);
  addLine(lines, `Budget: target ${formatKB(FALLBACK_TASK_LOG_BUDGET_BYTES)}KB; available ${formatKB(budgetBytes)}KB after soft spillover planning; used ${formatKB(used)}KB.`);
  addLine(lines, `Agent: ${agent}`);
  addLine(lines, `Task: ${path.basename(taskPath)}`);
  addLine(lines, `Read-cursor: ${position.readCursor}`);
  addLine(lines, `Task-log cursor record: ${cursorRecord ? `${String(cursorRecord.record).padStart(4, "0")} (${cursorRecord.name})` : "(none)"}`);
  addLine(lines, `Post-cursor records not inlined: ${position.unread.length}; by author: ${position.unreadByAuthor}`);
  addLine(lines, `Included records: ${selectedRecords.length > 0 ? `${String(Math.min(...selectedRecords)).padStart(4, "0")}-${String(Math.max(...selectedRecords)).padStart(4, "0")}` : "(none)"}`);
  addLine(lines, `Omitted older records: ${omittedOlder}; range: ${omittedRange}`);
  addLine(lines, `Manual inspection: node scripts/read-member-span.js --task ${taskId} --container task-log --after 0 --through ${String(cursor).padStart(4, "0")}`);
  addLine(lines, "Filtering: front matter and helper/lifecycle boilerplate removed; unchanged repeated tagged item lines are compressed while changed mentions are kept in full.");
  addLine(lines);
  if (selected.length === 0) {
    addLine(lines, "(none; this agent has no task-log cursor record yet)");
    addLine(lines);
    return { used, selectedCount: 0, omittedOlder, postCursorCount: position.unread.length };
  }
  for (const item of [...selected].reverse()) {
    lines.push(item.rendered.replace(/\s*$/, ""));
    addLine(lines);
  }
  return { used, selectedCount: selected.length, omittedOlder, postCursorCount: position.unread.length };
}

function isToolLikeTranscriptRecord(record) {
  const payload = record?.payload || {};
  const item = payload.item || {};
  const message = payload.message || record?.message || {};
  const role = String(record?.role || payload.role || message.role || item.role || "").toLowerCase();
  const type = String(record?.type || payload.type || message.type || item.type || "").toLowerCase();
  const source = String(record?.source || "").toUpperCase();
  const antigravityToolTypes = new Set([
    "CODE_ACTION",
    "GREP_SEARCH",
    "LIST_DIRECTORY",
    "READ_URL_CONTENT",
    "RUN_COMMAND",
    "SEARCH_WEB",
    "VIEW_FILE",
  ]);
  return role === "tool" || role === "function" || /tool|function_call/.test(type)
    || (source === "MODEL" && antigravityToolTypes.has(String(record?.type || "").toUpperCase()));
}

function transcriptRecordBody(record) {
  const payload = record?.payload || null;
  if (record?.type === "response_item" && payload) {
    return payload;
  }
  if (payload?.message) {
    return payload.message;
  }
  if (record?.message) {
    return record.message;
  }
  return record;
}

function transcriptRole(record) {
  const antigravityRole = antigravityTranscriptRole(record);
  if (antigravityRole) {
    return antigravityRole;
  }
  const body = transcriptRecordBody(record);
  const role = String(body?.role || "").toLowerCase();
  if (role === "user" || role === "director") {
    return "user";
  }
  if (role === "assistant") {
    return "assistant";
  }
  return null;
}

function antigravityTranscriptRole(record) {
  const source = String(record?.source || "").toUpperCase();
  const type = String(record?.type || "").toUpperCase();
  if (source === "USER_EXPLICIT" && type === "USER_INPUT") {
    return "user";
  }
  if (source === "MODEL" && type === "PLANNER_RESPONSE") {
    return "assistant";
  }
  return null;
}

function antigravityTranscriptText(record, role) {
  const source = String(record?.source || "").toUpperCase();
  const type = String(record?.type || "").toUpperCase();
  if (!(source === "USER_EXPLICIT" && type === "USER_INPUT") && !(source === "MODEL" && type === "PLANNER_RESPONSE")) {
    return null;
  }
  const content = typeof record?.content === "string" ? record.content : "";
  if (role !== "user") {
    return content;
  }
  const match = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i.exec(content);
  return match ? match[1] : content;
}

function transcriptTextValue(record, body, role) {
  const antigravityText = antigravityTranscriptText(record, role);
  if (antigravityText !== null) {
    return antigravityText;
  }
  return body.content ?? body.text ?? body;
}

function collectTranscriptText(value, output = []) {
  if (value === null || value === undefined) {
    return output;
  }
  if (typeof value === "string") {
    if (value.trim()) {
      output.push(value.trim());
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTranscriptText(item, output);
    }
    return output;
  }
  if (typeof value !== "object") {
    return output;
  }
  const type = String(value.type || "").toLowerCase();
  if (/tool|function_call|thinking_delta|signature_delta/.test(type)) {
    return output;
  }
  if (typeof value.text === "string") {
    collectTranscriptText(value.text, output);
  }
  if (typeof value.content === "string" || Array.isArray(value.content)) {
    collectTranscriptText(value.content, output);
  }
  if (value.message) {
    collectTranscriptText(value.message.content || value.message.text, output);
  }
  return output;
}

function currentProviderSession(agent) {
  const current = providerSessionIdForAgent(agent);
  if (!current) {
    return null;
  }
  return {
    provider: current.provider,
    agent,
    id: current.id,
  };
}

function currentProviderSessions(agent) {
  const session = currentProviderSession(agent);
  return session ? [session] : [];
}

function readTranscriptTurns(session) {
  const turns = [];
  let droppedToolOrLifecycle = 0;
  const lines = readText(session.path).split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      droppedToolOrLifecycle += 1;
      continue;
    }
    if (isToolLikeTranscriptRecord(record)) {
      droppedToolOrLifecycle += 1;
      continue;
    }
    const role = transcriptRole(record);
    if (!role) {
      droppedToolOrLifecycle += 1;
      continue;
    }
    const body = transcriptRecordBody(record);
    const text = collectTranscriptText(transcriptTextValue(record, body, role)).join("\n").trim();
    if (!text) {
      droppedToolOrLifecycle += 1;
      continue;
    }
    turns.push({ role, text });
  }
  return { turns, droppedToolOrLifecycle };
}

function renderTranscriptTurn(session, turn) {
  return [
    `### native-session-tail: ${session.provider}/${session.agent}`,
    "",
    `Path: ${formatDisplayPath(session.path)}`,
    `Modified: ${session.modified}`,
    "",
    "```text",
    `${turn.role}: ${turn.text}`,
    "```",
    "",
  ].join(EOL);
}

function estimateFallbackNativeTranscriptNeed(sessions) {
  const resolved = [];
  sessions.forEach((session, registryIndex) => {
    const entry = resolveEntry(session);
    if (entry) {
      resolved.push({ ...entry, registryIndex });
    }
  });
  let bytes = 0;
  let turns = 0;
  for (const session of newestResolvedAgentSessionPaths(resolved)) {
    const read = readTranscriptTurns(session);
    for (const turn of read.turns) {
      bytes += utf8ByteCount(renderTranscriptTurn(session, turn));
      turns += 1;
    }
  }
  return { bytes, turns };
}

function addFallbackNativeTranscriptTail(lines, sessions, agent, budgetBytes = FALLBACK_TRANSCRIPT_BUDGET_BYTES, options = {}) {
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
  const selectedSessions = newestResolvedAgentSessionPaths(resolved);
  const selectedTurns = [];
  const summaries = [];
  let used = 0;
  let omittedOlder = 0;
  let droppedToolOrLifecycle = 0;
  for (const session of selectedSessions) {
    const read = readTranscriptTurns(session);
    droppedToolOrLifecycle += read.droppedToolOrLifecycle;
    let includedForSession = 0;
    for (let index = read.turns.length - 1; index >= 0; index--) {
      const rendered = renderTranscriptTurn(session, read.turns[index]);
      const bytes = utf8ByteCount(rendered);
      if (selectedTurns.length > 0 && used + bytes > budgetBytes) {
        omittedOlder += index + 1;
        break;
      }
      if (selectedTurns.length === 0 && bytes > budgetBytes) {
        const overhead = utf8ByteCount(renderTranscriptTurn(session, { role: read.turns[index].role, text: "" }));
        const text = truncateTextToByteBudget(read.turns[index].text, Math.max(0, budgetBytes - overhead), FALLBACK_TRUNCATION_NOTICE);
        const clipped = renderTranscriptTurn(session, { role: read.turns[index].role, text });
        selectedTurns.push({ session, rendered: clipped });
        used += utf8ByteCount(clipped);
      } else {
        selectedTurns.push({ session, rendered });
        used += bytes;
      }
      includedForSession += 1;
    }
    summaries.push(`${session.provider}/${session.agent}: included ${includedForSession} of ${read.turns.length} filtered turn(s)`);
    if (used >= budgetBytes) {
      break;
    }
  }

  addLine(lines, "## Native Session Tail");
  addLine(lines);
  addLine(lines, `Budget: target ${formatKB(options.targetBudgetBytes || FALLBACK_TRANSCRIPT_BUDGET_BYTES)}KB; available ${formatKB(budgetBytes)}KB after soft spillover planning; used ${formatKB(used)}KB.`);
  addLine(lines, "Role: conversational nuance only; task log and artifacts remain authoritative on conflict.");
  addLine(lines, `Agent: ${agent}`);
  if (options.registryLabel) {
    addLine(lines, `Session registry: ${options.registryLabel}`);
  }
  addLine(lines, `Resolved current-agent session paths: ${selectedSessions.length}; unresolved current-agent session anchors: ${unresolved.length}.`);
  addLine(lines, `Included/omitted turns: ${summaries.length > 0 ? summaries.join("; ") : "(none)"}; omitted older filtered turns: ${omittedOlder}.`);
  addLine(lines, `Dropped tool/lifecycle blocks: ${droppedToolOrLifecycle}.`);
  addLine(lines, `Manual inspection: ${options.manualInspection || "node scripts/list-agent-session-paths.js --task <task>"} then inspect the selected provider JSONL directly.`);
  addLine(lines);
  if (selectedTurns.length === 0) {
    addLine(lines, "(none)");
    addLine(lines);
    return { used, selectedCount: 0, omittedOlder, droppedToolOrLifecycle };
  }
  for (const turn of [...selectedTurns].reverse()) {
    lines.push(turn.rendered.replace(/\s*$/, ""));
    addLine(lines);
  }
  return { used, selectedCount: selectedTurns.length, omittedOlder, droppedToolOrLifecycle };
}

function fallbackContextReason(savedContextRestore) {
  if (savedContextRestore && savedContextRestore.action === "restored") {
    return null;
  }
  if (savedContextRestore && savedContextRestore.action === "discarded") {
    return "saved context discarded";
  }
  return "no saved context available";
}

function addNoSavedContextFallbackBundle(lines, taskPath, agent, reason) {
  addLine(lines, "## No Saved Context Fallback Bundle");
  addLine(lines);
  addLine(lines, `Reason: ${reason}.`);
  addLine(lines, `Soft total budget: ${formatKB(FALLBACK_TOTAL_BUDGET_BYTES)}KB. With a current task, refresh favors task-log state (${formatKB(FALLBACK_TASK_LOG_BUDGET_BYTES)}KB) over transcript nuance (${formatKB(FALLBACK_TRANSCRIPT_BUDGET_BYTES)}KB); without a current task, it uses up to ${formatKB(TASKLESS_FALLBACK_TRANSCRIPT_BUDGET_BYTES)}KB for the current native transcript.`);
  addLine(lines, "This section is generated by the refresh helper; do not self-fetch replacement context unless the truncation report says more is needed.");
  addLine(lines);
  if (!agent) {
    addLine(lines, "(agent unresolved; per-agent fallback context unavailable)");
    addLine(lines);
    return;
  }
  if (!taskPath) {
    const sessions = currentProviderSessions(agent);
    addLine(lines, "Task-log fallback: unavailable because no current task is selected.");
    addLine(lines, "Native transcript source: current provider session ID from this refresh environment.");
    addLine(lines);
    if (sessions.length === 0) {
      addLine(lines, "(current provider session ID unavailable; taskless transcript fallback unavailable)");
      addLine(lines);
      return;
    }
    addFallbackNativeTranscriptTail(lines, sessions, agent, TASKLESS_FALLBACK_TRANSCRIPT_BUDGET_BYTES, {
      targetBudgetBytes: TASKLESS_FALLBACK_TRANSCRIPT_BUDGET_BYTES,
      registryLabel: "current provider session (not persisted)",
      manualInspection: "inspect the provider JSONL path shown above",
    });
    addLine(lines);
    return;
  }
  const sessions = currentProviderSessions(agent);
  const transcriptNeed = estimateFallbackNativeTranscriptNeed(sessions);
  const transcriptTargetUse = Math.min(transcriptNeed.bytes, FALLBACK_TRANSCRIPT_BUDGET_BYTES);
  const taskLogBudget = Math.min(
    FALLBACK_TOTAL_BUDGET_BYTES,
    FALLBACK_TASK_LOG_BUDGET_BYTES + Math.max(0, FALLBACK_TRANSCRIPT_BUDGET_BYTES - transcriptTargetUse),
  );
  const taskLogResult = addFallbackTaskLogDigest(lines, taskPath, agent, taskLogBudget);
  const transcriptBudget = Math.max(0, FALLBACK_TOTAL_BUDGET_BYTES - taskLogResult.used);
  if (sessions.length === 0) {
    addLine(lines, "## Native Session Tail");
    addLine(lines);
    addLine(lines, "(current provider session ID unavailable; transcript fallback unavailable)");
    addLine(lines);
  } else {
    addFallbackNativeTranscriptTail(lines, sessions, agent, transcriptBudget, {
      registryLabel: "current provider session (not persisted)",
      manualInspection: "inspect the provider JSONL path shown above",
    });
  }
}

const MIN_NODE_MAJOR = 18;
const EOL = os.EOL;
const FALLBACK_TOTAL_BUDGET_BYTES = 15 * 1024;
const FALLBACK_TASK_LOG_BUDGET_BYTES = 10 * 1024;
const FALLBACK_TRANSCRIPT_BUDGET_BYTES = 5 * 1024;
const TASKLESS_FALLBACK_TRANSCRIPT_BUDGET_BYTES = 10 * 1024;
const FALLBACK_TRUNCATION_NOTICE = "\n\n[Truncated to fit the fallback section byte budget.]";
const HOOK_OUTPUT_HEADER = "M-PACT HOOK OUTPUT";

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

function truncateTextToByteBudget(text, maxBytes, notice = FALLBACK_TRUNCATION_NOTICE) {
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

function addRecoveryAnchors(lines, taskPath, agent) {
  addLine(lines, "## Recovery Anchors");
  addLine(lines);
  addLine(lines, "Use these pointers for targeted recovery when restored or generated context is not enough. Do not read whole raw transcripts by default; inspect them only when missing conversation nuance matters.");
  addLine(lines);
  if (!taskPath) {
    const session = agent ? currentProviderSession(agent) : null;
    addLine(lines, "- Current task: (none; no valid open current task selected)");
    addLine(lines, "- Durable task history: unavailable without a current task.");
    if (session) {
      const resolved = resolveEntry(session);
      addLine(lines, `- Current native transcript: provider=${session.provider}; agent=${session.agent}; id=${session.id}${resolved ? `; path=${formatDisplayPath(resolved.path)}` : "; path=(not found yet)"}`);
    } else {
      addLine(lines, "- Current native transcript: unavailable; provider session ID is not exposed in this refresh environment.");
    }
    addLine(lines);
    return;
  }
  const taskId = taskIdForTaskPath(taskPath);
  const taskLogCursor = agent ? agentTaskLogPosition(taskLogMembers(taskPath), agent).readCursor : null;
  const taskLogCursorLabel = Number.isFinite(taskLogCursor) ? String(taskLogCursor).padStart(4, "0") : "<read-cursor>";
  const session = agent ? currentProviderSession(agent) : null;
  addLine(lines, `- Current task: ${taskId}; folder: ${path.basename(taskPath)}; path: ${formatDisplayPath(taskPath)}`);
  addLine(lines, `- Durable task history: ${formatDisplayPath(path.join(taskPath, "log.zip"))}`);
  addLine(lines, `- Task-log catch-up: \`node scripts/read-member-span.js --task ${taskId} --container task-log --after ${taskLogCursorLabel}\``);
  if (session) {
    const resolved = resolveEntry(session);
    addLine(lines, `- Current native transcript: provider=${session.provider}; agent=${session.agent}; id=${session.id}${resolved ? `; path=${formatDisplayPath(resolved.path)}` : "; path=(not found yet)"}`);
  } else {
    addLine(lines, "- Current native transcript: unavailable; provider session ID is not exposed in this refresh environment.");
  }
  addLine(lines, `- Raw transcript trailhead: ${formatDisplayPath(path.join(taskPath, "Agents.json"))}`);
  addLine(lines, `- Transcript paths: \`node scripts/list-agent-session-paths.js --task ${taskId}\``);
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
  let currentTaskPathForSessionCapture = null;
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
      let currentPointerValid = false;
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
        currentPointerValid = true;
        if (pointerStat.size !== 0) {
          missingOrAmbiguous.push(`current task pointer ${pointerName} must be a zero-byte sentinel`);
          currentPointerValid = false;
        }
        if (/^A__/.test(currentTaskPointer) && existsDir(candidateTaskPath)) {
          selectedTask = currentTaskPointer;
        } else {
          missingOrAmbiguous.push(`stale current task pointer ${pointerName}; remove it or explicitly choose an active task`);
          currentPointerValid = false;
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
            if (currentPointerValid) {
              currentTaskPathForSessionCapture = path.dirname(taskMd);
            }
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
  if (currentTaskPathForSessionCapture && agentResolution && agentResolution.agent && /projectIdentity=ok\b/.test(projectIdentityDisplay.receipt)) {
    withTaskOperationLock(currentTaskPathForSessionCapture, () => {
      recordCurrentAgentSession(currentTaskPathForSessionCapture, agentResolution.agent);
    });
  }
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
  addLine(bundle, "## Startup Load Metadata");
  addLine(bundle);
  addLine(bundle, "Generated for M-PACT startup refresh or Director-requested refresh. The receipt block above is the compact user-visible refresh receipt. The terminal marker for a complete bundle is `END REFRESH BUNDLE`.");
  const fallbackReason = fallbackContextReason(savedContextRestore);
  let startupTaskPathForFallback = null;
  addLine(bundle);
  addRecoveryAnchors(bundle, currentTaskPathForSessionCapture, agentResolution ? agentResolution.agent : null);
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
    startupTaskPathForFallback = path.dirname(taskPath);
    addArtifact(bundle, `Startup task: ${startupTaskRead}`, taskPath, startupTaskText);
    if (agentResolution && agentResolution.agent) {
      addAgentTaskLogRefresh(bundle, path.dirname(taskPath), agentResolution.agent);
    } else {
      addAgentTaskLogRefreshUnavailable(bundle, path.dirname(taskPath), agentResolutionError ? agentResolutionError.message : "agent identity could not be resolved");
    }
  }

  if (fallbackReason) {
    addNoSavedContextFallbackBundle(bundle, startupTaskPathForFallback, agentResolution ? agentResolution.agent : null, fallbackReason);
  }

  addLine(bundle, "END REFRESH BUNDLE");

  const bundleText = bundle.join(EOL) + EOL;
  const bundleBytes = utf8ByteCount(bundleText);
  const bundleLineCount = bundleText.split(/\r?\n/).length - 1;

  const scratchRoot = activeRoot || resolveExisting(userRoot);
  const pruneResult = pruneScratchDirectory(scratchRoot);
  const bundlePath = refreshBundlePath(scratchRoot, bundleAgentToken);
  fs.writeFileSync(bundlePath, bundleText, { encoding: "utf8" });

  if (isMpactHookContext()) {
    console.log(HOOK_OUTPUT_HEADER);
  }
  console.log("AUDIT: PASS");
  console.log("M-PACT REFRESH BUNDLE MANIFEST");
  console.log(`BundlePath: ${bundlePath}`);
  console.log(`BundleBytes: ${bundleBytes}`);
  console.log(`LineCount: ${bundleLineCount}`);
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
  console.log("END REFRESH BUNDLE");
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
