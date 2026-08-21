#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { appendGeneratedMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  activeItemReceipt,
  enforceActiveItemHandoff,
} = require("./lib/active-items");
const { mergeStructuredFields } = require("./lib/structured-task-input");
const {
  buildTaskMarkdown,
} = require("./lib/task-markdown");
const {
  booleanArg,
  agentTokenValidator,
  DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  localTimestamp,
  memberName,
  resolveAgentToken,
  resolveRootPath,
  runCli,
} = require("./lib/helper-common");
const { setCurrentTask: replaceCurrentTask, taskFolderName } = require("./lib/task-state");
const { recordCurrentAgentSession } = require("./lib/agents-store");

const VALID_PRIORITIES = new Set(["p1", "p2", "p3", "p4", "px"]);
const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "from-stdin",
  "title",
  "priority",
  "source",
  "context",
  "acceptance",
  "agent",
  "log-title",
  "director-intent",
  "source-input",
  "no-current",
];
const REQUIRED_FLAGS = ["title"];
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

function tasksPathForRoot(rootPath) {
  return path.join(rootPath, "tasks");
}

function existingTaskNumbers(tasksPath) {
  if (!fs.existsSync(tasksPath)) {
    return [];
  }
  return fs.readdirSync(tasksPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => /^[AC]__p[1234x]-t(\d{4})-/.exec(entry.name))
    .filter(Boolean)
    .map((match) => Number.parseInt(match[1], 10));
}

function nextTaskNumber(tasksPath) {
  return Math.max(0, ...existingTaskNumbers(tasksPath)) + 1;
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const identity = validateProjectWrite({ rootPath, input, args });
  const title = args.title;
  const priority = String(args.priority || "px").toLowerCase();
  const source = args.source || "director";
  const structured = mergeStructuredFields({ args, input });
  const context = structured.context || "";
  const acceptance = structured.acceptance || "";
  const agent = resolveAgentToken(args);
  const initialLogBody = structured.logBody || "";

  const tasksPath = tasksPathForRoot(rootPath);
  fs.mkdirSync(tasksPath, { recursive: true });
  return withDirectoryLock(tasksPath, () => {
    const number = nextTaskNumber(tasksPath);
    const taskFolder = taskFolderName({ state: "A", priority, number, title });
    const taskPath = path.join(tasksPath, taskFolder);
    fs.mkdirSync(taskPath);

    const now = new Date();
    const timestamp = localTimestamp(now);
    fs.writeFileSync(path.join(taskPath, "task.md"), buildTaskMarkdown({
      timestamp: timestamp.body,
      source,
      priority,
      title: String(title).trim(),
      context,
      acceptance,
    }), "utf8");

    let member = null;
    let activeSummary = null;
    if (initialLogBody && String(initialLogBody).trim()) {
      activeSummary = enforceActiveItemHandoff({
        body: String(initialLogBody),
        latestRecord: null,
        latestBody: "",
      });
      const recordBody = activeSummary && activeSummary.body ? activeSummary.body : String(initialLogBody);
      member = memberName({
        number: 1,
        source: agent,
        title: args["log-title"] || "initial-task-handoff",
        extension: ".md",
        includeSource: true,
      });
      const logContent = buildTaskLogMarkdown({
        input: {
          agent,
          title: args["log-title"] || "Initial Task Handoff",
          body: recordBody,
          directorIntent: args["director-intent"],
          sourceInput: args["source-input"],
        },
        timestamp,
        record: 1,
      });
      appendGeneratedMember(path.join(taskPath, "log.zip"), member, logContent, now);
    }

    recordCurrentAgentSession(taskPath, agent);
    const sentinel = booleanArg(args, "no-current") ? null : replaceCurrentTask(tasksPath, taskPath);
    return {
      ok: true,
      operation: "create-task",
      rootPath,
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      taskPath,
      record: number,
      member,
      sentinel,
      timestamp: timestamp.body,
      activeItems: activeItemReceipt(activeSummary),
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "input", "title", "priority", "source", "context", "acceptance", "agent", "log-title", "director-intent", "source-input"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: FLAG_VALUE_VALIDATORS,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  stdinFlags: ["from-stdin"],
});
