#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const {
  appendGeneratedMembers,
  appendMember,
  listMembers,
  readMember,
} = require("./lib/zip-record-store");
const {
  withRecordMetadata,
} = require("./lib/container-state");
const {
  designSpecMemberName,
  clearedUnresolvedItems,
  currentItemMembers,
  currentItemVersionMap,
  itemContent,
  listDesignSpecMembers,
  logItemHistory,
} = require("./lib/design-spec");
const {
  activeItemReceipt,
  enforceActiveItemHandoff,
  newestTaskLogMember,
  parseActiveItems,
} = require("./lib/active-items");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const { formatCloseStatusSection } = require("./lib/close-status");
const {
  agentTokenValidator,
  localTimestamp,
  memberName,
  resolveAgentToken,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { transitionTaskState, withTaskOperationLock } = require("./lib/task-state");
const { recordCurrentAgentSession } = require("./lib/agents-store");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "task",
  "task-path",
  "agent",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];
const FLAG_VALUE_VALIDATORS = {
  agent: agentTokenValidator,
};

function removeCurrentSentinel(tasksPath, folder) {
  const fs = require("fs");
  const pointerPath = path.join(tasksPath, `current__${folder}`);
  if (fs.existsSync(pointerPath)) {
    fs.unlinkSync(pointerPath);
  }
}

function validateNextLogRecord(logMembers) {
  const records = logMembers.map((member) => member.record);
  if (logMembers.some((member) => !Number.isFinite(member.record))) {
    throw new Error("unnumbered log member exists");
  }
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record)) {
      throw new Error(`log record collision exists at ${String(record).padStart(4, "0")}`);
    }
    seen.add(record);
  }
  const sorted = [...records].sort((a, b) => a - b);
  for (let index = 0; index < sorted.length; index++) {
    if (sorted[index] !== index + 1) {
      throw new Error(`log records are non-contiguous at ${String(index + 1).padStart(4, "0")}`);
    }
  }
  return sorted.length + 1;
}

function closeStatusFromLatest(latestBody, unresolved, versionByNumber) {
  const active = parseActiveItems(latestBody, { strict: false });
  const unfinished = active
    ? active.items.map((item) => {
      const id = item.tag.match(/^(\d+)/);
      const number = id ? Number.parseInt(id[1], 10) : null;
      const version = number === null ? null : versionByNumber.get(number);
      return { tag: item.tag, number, version };
    }).filter((item) => item.number !== null)
    : [];
  return {
    unfinished,
    clearedUnresolved: unresolved || [],
  };
}

function closeActiveItemSection(latestRecord, latestBody, versionByNumber) {
  const active = parseActiveItems(latestBody, { strict: false });
  if (!active) {
    return "";
  }
  const lines = [
    `## Active Items (derives from ${String(latestRecord).padStart(4, "0")})`,
    "- (none)",
  ];
  if (active.items.length > 0) {
    lines.push("", "## Cleared");
    for (const item of active.items) {
      const id = item.tag.match(/^(\d+)/);
      const number = id ? Number.parseInt(id[1], 10) : null;
      const version = number === null ? null : versionByNumber.get(number);
      lines.push(`- [${item.tag}] VERSION ${String(version || 0).padStart(4, "0")}: closed by Director task close`);
    }
  }
  return lines.join("\n");
}

function skippedAbsorption(reason, state = {}) {
  const writtenMembers = state.specMembersWritten || [];
  if (writtenMembers.length > 0) {
    return {
      closeAbsorption: "skipped-partial",
      closeAbsorptionReason: `absorption failed after writing specification member(s) without a paired log record: ${reason}`,
      closeAbsorptionSpecMembers: writtenMembers.join(", "),
      absorbedItems: state.absorbedItems || "(unknown)",
      logMember: undefined,
      activeItems: undefined,
    };
  }
  return {
    closeAbsorption: "skipped",
    closeAbsorptionReason: reason,
    absorbedItems: "(none)",
    logMember: undefined,
    activeItems: undefined,
  };
}

function attemptAbsorbBeforeClose(taskPath, state) {
  const specZipPath = path.join(taskPath, "specification.zip");
  const logZipPath = path.join(taskPath, "log.zip");
  const zipOptions = { requireExistingParent: true };
  const specState = listDesignSpecMembers(specZipPath);
  if (specState.format === "empty") {
    return {
      closeAbsorption: "skipped",
      closeAbsorptionReason: "no design specification container exists",
      absorbedItems: "(none)",
      logMember: undefined,
      activeItems: undefined,
    };
  }
  if (specState.format === "legacy") {
    return {
      closeAbsorption: "skipped",
      closeAbsorptionReason: "legacy-format specification container has no write path",
      absorbedItems: "(none)",
      logMember: undefined,
      activeItems: undefined,
    };
  }
  if (specState.format === "mixed") {
    return {
      closeAbsorption: "skipped",
      closeAbsorptionReason: "mixed legacy/new-format specification container is ambiguous",
      absorbedItems: "(none)",
      logMember: undefined,
      activeItems: undefined,
    };
  }

  const logMembers = listMembers(logZipPath, zipOptions).map((member) => withRecordMetadata(member, { recordsExpected: true }));
  const existingNumbers = new Set(currentItemMembers(specState.members).map((member) => member.itemNumber));
  const history = logItemHistory(logZipPath, logMembers);
  const versionByNumber = currentItemVersionMap(specState.members);
  for (const item of history) {
    if (!versionByNumber.has(item.number) && Number.isFinite(item.lastTextRecord)) {
      versionByNumber.set(item.number, item.lastTextRecord);
    }
  }
  const unabsorbed = history.filter((item) => !existingNumbers.has(item.number));
  const latest = newestTaskLogMember(logMembers);
  const latestBody = latest ? readMember(logZipPath, latest.name, zipOptions).toString("utf8") : "";
  const unresolved = clearedUnresolvedItems(logZipPath, logMembers);
  const status = closeStatusFromLatest(latestBody, unresolved, versionByNumber);
  if (unabsorbed.length === 0 && status.unfinished.length === 0 && status.clearedUnresolved.length === 0) {
    return {
      closeAbsorption: "none-needed",
      closeAbsorptionReason: "no unabsorbed design specification items",
      absorbedItems: "(none)",
      logMember: undefined,
      activeItems: undefined,
      closeUnfinished: 0,
      closeClearedUnresolved: 0,
    };
  }

  let logRecord;
  try {
    logRecord = validateNextLogRecord(logMembers);
  } catch (error) {
    return skippedAbsorption(`could not safely predict paired log record: ${error.message}`, state);
  }

  for (const item of unabsorbed) {
    if (!versionByNumber.has(item.number)) {
      versionByNumber.set(item.number, logRecord);
    }
  }
  const activeSection = latest ? closeActiveItemSection(latest.record, latestBody, versionByNumber) : "";
  const absorbedList = unabsorbed.map((item) => `${String(item.number).padStart(4, "0")}-${item.slug}`).join(", ") || "(none)";
  state.absorbedItems = absorbedList;
  const body = [
    unabsorbed.length > 0
      ? "Close-time design specification absorption before task close."
      : "Close status record before task close.",
    "",
    `Absorbed item(s): ${absorbedList}`,
    "",
    "The task is closing after this absorption. Any open work is being closed by Director instruction rather than kept open.",
    "",
    formatCloseStatusSection(status),
    activeSection ? `\n${activeSection}` : "",
  ].join("\n").replace(/\s*$/, "");
  const activeSummary = enforceActiveItemHandoff({
    body,
    latestRecord: latest ? latest.record : null,
    latestBody,
    requireVersionDeclarations: true,
  });
  const recordBody = activeSummary && activeSummary.body ? activeSummary.body : body;

  const now = new Date();
  const batch = unabsorbed.map((item) => ({
    member: designSpecMemberName({
      itemNumber: item.number,
      logRecord,
      slug: item.slug,
    }),
    content: itemContent({
      itemNumber: item.number,
      logRecord,
      slug: item.slug,
      text: item.text,
    }),
  }));
  if (batch.length > 0) {
    appendGeneratedMembers(specZipPath, batch, now, zipOptions);
    state.specMembersWritten = batch.map((entry) => entry.member);
  }
  const timestamp = localTimestamp(now);
  const logAppend = appendMember(logZipPath, ({ record }) => {
    if (record !== logRecord) {
      throw new Error(`paired close absorption log record changed during write: expected ${logRecord}, got ${record}`);
    }
    return {
      member: memberName({
        number: record,
        source: "close",
        title: "close time design item absorption",
        extension: ".md",
        includeSource: true,
      }),
      content: buildTaskLogMarkdown({
        record,
        timestamp,
        input: {
          agent: "close",
          title: "Close-Time Design Item Absorption",
          body: recordBody,
          directorIntent: "Absorb unabsorbed design specification items before closing the task.",
        },
      }),
    };
  }, now, zipOptions);
  return {
    closeAbsorption: "written",
    closeAbsorptionReason: unabsorbed.length > 0
      ? "absorbed unabsorbed design specification items before close"
      : "wrote close status record before close",
    absorbedItems: absorbedList,
    logMember: logAppend.member,
    activeItems: activeItemReceipt(activeSummary),
    closeUnfinished: status.unfinished.length,
    closeClearedUnresolved: status.clearedUnresolved.length,
  };
}

function absorbBeforeClose(taskPath) {
  const state = {
    absorbedItems: "(none)",
    specMembersWritten: [],
  };
  try {
    return attemptAbsorbBeforeClose(taskPath, state);
  } catch (error) {
    return skippedAbsorption(`unexpected absorption error: ${error.message}`, state);
  }
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const agent = resolveAgentToken(args);
  const folder = path.basename(taskPath);
  const tasksPath = path.dirname(taskPath);
  return withDirectoryLock(tasksPath, () => withTaskOperationLock(taskPath, () => {
      const absorption = absorbBeforeClose(taskPath);
      const transition = transitionTaskState({
        taskPath,
        fromPrefix: "A",
        toPrefix: "C",
      });
      removeCurrentSentinel(tasksPath, folder);
      recordCurrentAgentSession(transition.newPath, agent);
      return {
      ok: true,
      operation: "close-task",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      task: transition.task,
      status: transition.status,
      closeAbsorption: absorption.closeAbsorption,
      closeAbsorptionReason: absorption.closeAbsorptionReason,
      closeAbsorptionSpecMembers: absorption.closeAbsorptionSpecMembers,
      absorbedItems: absorption.absorbedItems,
      closeUnfinished: absorption.closeUnfinished,
      closeClearedUnresolved: absorption.closeClearedUnresolved,
      logMember: absorption.logMember,
      activeItems: absorption.activeItems,
      };
    }));
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "task", "task-path", "agent"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: FLAG_VALUE_VALIDATORS,
});
