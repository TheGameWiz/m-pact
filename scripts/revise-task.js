#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const {
  appendMember,
  listMembers,
  readMember,
} = require("./lib/zip-record-store");
const {
  withRecordMetadata,
} = require("./lib/container-state");
const {
  activeItemReceipt,
  enforceActiveItemHandoff,
  newestTaskLogMember,
} = require("./lib/active-items");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const { mergeStructuredFields } = require("./lib/structured-task-input");
const {
  localTimestamp,
  DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  agentTokenValidator,
  memberName,
  resolveAgentToken,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const {
  buildTaskMarkdown,
  dominantLineEnding,
  normalizeForRoundTrip,
  normalizeRetiredTaskFieldsForComparison,
  parseTaskMarkdown,
  summarizeNormalization,
} = require("./lib/task-markdown");
const { setCurrentTask, taskFolderName, taskNumberFromFolder, withTaskOperationLock } = require("./lib/task-state");
const { recordCurrentAgentSession } = require("./lib/agents-store");

const VALID_PRIORITIES = new Set(["p1", "p2", "p3", "p4", "px"]);
const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "from-stdin",
  "task",
  "title",
  "priority",
  "source",
  "context",
  "acceptance",
  "agent",
  "log-title",
  "director-intent",
  "source-input",
];
const REQUIRED_FLAGS = ["task"];
const REQUIRED_ONE_OF = [];
const FLAG_VALUE_VALIDATORS = {
  title(value) {
    if (!String(value || "").trim()) {
      return "title is required";
    }
    return null;
  },
  priority(value) {
    if (!VALID_PRIORITIES.has(String(value || "").toLowerCase())) {
      return "priority must be one of p1, p2, p3, p4, or px";
    }
    return null;
  },
  agent: agentTokenValidator,
};

function hasArg(args, name) {
  return Object.prototype.hasOwnProperty.call(args, name);
}

function revisedFolderName(oldFolder, model) {
  const prefix = oldFolder.slice(0, 1);
  const taskNumber = taskNumberFromFolder(oldFolder);
  return taskFolderName({ state: prefix, priority: model.priority, number: taskNumber, title: model.title });
}

function writeVerifiedTaskMd(taskMdPath, content) {
  const tempPath = `${taskMdPath}.tmp`;
  if (fs.existsSync(tempPath)) {
    throw new Error(`orphan task.md temp file exists; refusing repair: ${tempPath}`);
  }
  fs.writeFileSync(tempPath, content, "utf8");
  const verified = fs.readFileSync(tempPath, "utf8");
  if (verified !== content) {
    fs.unlinkSync(tempPath);
    throw new Error("task.md temp file verification failed");
  }
  fs.unlinkSync(taskMdPath);
  fs.renameSync(tempPath, taskMdPath);
}

function augmentLogBody(body, { normalizedText }) {
  const notes = [];
  if (normalizedText) {
    notes.push(`Task document normalization: ${normalizedText}.`);
  }
  return notes.length > 0
    ? `${notes.join("\n")}\n\n${String(body || "").trim()}`.trimEnd()
    : String(body || "").trimEnd();
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A", "C"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const structured = mergeStructuredFields({ args, input, requireLog: true });
  const agent = resolveAgentToken(args);
  const logTitle = args["log-title"] || "Task Revision";

  return withDirectoryLock(path.dirname(taskPath), () => withTaskOperationLock(taskPath, () => {
    const oldFolder = path.basename(taskPath);
    const taskMdPath = path.join(taskPath, "task.md");
    const original = fs.readFileSync(taskMdPath, "utf8");
    const parsed = parseTaskMarkdown(original);
    const eol = dominantLineEnding(original);
    const renderedOriginal = buildTaskMarkdown(parsed.model, eol);
    const normalizedText = summarizeNormalization(parsed.normalized);

    const comparableOriginal = normalizedText
      ? normalizeRetiredTaskFieldsForComparison(original)
      : normalizeForRoundTrip(original);
    if (normalizeForRoundTrip(renderedOriginal) !== comparableOriginal) {
      throw new Error("task.md round-trip check failed; unmodelled content would be lost");
    }

    const nextModel = { ...parsed.model };
    if (hasArg(args, "title")) {
      nextModel.title = String(args.title).trim();
    }
    if (hasArg(args, "priority")) {
      nextModel.priority = String(args.priority).toLowerCase();
    }
    if (hasArg(args, "source")) {
      nextModel.source = String(args.source);
    }
    if (structured.present.has("Context") || hasArg(args, "context")) {
      nextModel.context = structured.context || "";
    }
    if (structured.present.has("Acceptance") || hasArg(args, "acceptance")) {
      nextModel.acceptance = structured.acceptance || "";
    }

    const newFolder = revisedFolderName(oldFolder, nextModel);
    if (newFolder !== oldFolder) {
      const collisionPath = path.join(path.dirname(taskPath), newFolder);
      if (fs.existsSync(collisionPath)) {
        throw new Error(`task revision target already exists: ${collisionPath}`);
      }
    }

    const logBody = augmentLogBody(structured.logBody, {
      normalizedText,
    });
    const logZipPathBeforeRename = path.join(taskPath, "log.zip");
    const zipOptions = { requireExistingParent: true };
    const logMembers = listMembers(logZipPathBeforeRename, zipOptions).map((member) => withRecordMetadata(member, { recordsExpected: true }));
    const latest = newestTaskLogMember(logMembers);
    const latestBody = latest ? readMember(logZipPathBeforeRename, latest.name, zipOptions).toString("utf8") : "";
    const activeSummary = enforceActiveItemHandoff({
      body: logBody,
      latestRecord: latest ? latest.record : null,
      latestBody,
    });
    const recordLogBody = activeSummary && activeSummary.body ? activeSummary.body : logBody;
    const revisedTaskMd = buildTaskMarkdown(nextModel, eol);
    writeVerifiedTaskMd(taskMdPath, revisedTaskMd);

    let newPath = taskPath;
    if (newFolder !== oldFolder) {
      newPath = path.join(path.dirname(taskPath), newFolder);
      fs.renameSync(taskPath, newPath);
      if (oldFolder.startsWith("A__") && fs.existsSync(path.join(path.dirname(newPath), `current__${oldFolder}`))) {
        setCurrentTask(path.dirname(newPath), newPath);
      }
    }

    const now = new Date();
    const timestamp = localTimestamp(now);
    const logZipPath = path.join(newPath, "log.zip");
    const logAppend = appendMember(logZipPath, ({ record }) => {
      const member = memberName({
        number: record,
        source: agent,
        title: logTitle,
        extension: ".md",
        includeSource: true,
      });
      const content = buildTaskLogMarkdown({
        record,
        timestamp,
        input: {
          agent,
          title: logTitle,
          body: recordLogBody,
          directorIntent: args["director-intent"] || "Revise task.md and record the paired task log.",
          sourceInput: args["source-input"],
        },
      });
      return { member, content };
    }, now, { requireExistingParent: true });

    recordCurrentAgentSession(newPath, agent);
    return {
      ok: true,
      operation: "revise-task",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      task: taskNumberFromFolder(newFolder),
      taskPath: newPath,
      oldPath: newPath === taskPath ? undefined : taskPath,
      newPath: newPath === taskPath ? undefined : newPath,
      logMember: logAppend.member,
      timestamp: timestamp.body,
      activeItems: activeItemReceipt(activeSummary),
      normalized: normalizedText || undefined,
    };
  }));
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "input", "task", "title", "priority", "source", "context", "acceptance", "agent", "log-title", "director-intent", "source-input"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: FLAG_VALUE_VALIDATORS,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  stdinFlags: ["from-stdin"],
});
