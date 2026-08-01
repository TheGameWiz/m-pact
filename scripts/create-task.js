#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { appendGeneratedMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  booleanArg,
  localTimestamp,
  memberName,
  resolveRootPath,
  runCli,
  sanitizeSlug,
} = require("./lib/helper-common");
const { setCurrentTask: replaceCurrentTask } = require("./lib/task-state");

const VALID_PRIORITIES = new Set(["p1", "p2", "p3", "p4", "px"]);
const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "title",
  "task",
  "priority",
  "source",
  "owner",
  "context",
  "acceptance",
  "agent",
  "log-title",
  "director-intent",
  "source-input",
  "no-current",
];

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

function cappedTaskSlug(title) {
  return (sanitizeSlug(title) || "task").slice(0, 72).replace(/-+$/g, "") || "task";
}

function listFromArgs(value) {
  if (!value) {
    return [];
  }
  return String(value).split("|").map((item) => item.trim()).filter(Boolean);
}

function buildTaskMarkdown({ timestamp, source, owner, priority, title, context, acceptance }) {
  const lines = [
    "# Task Entry",
    "",
    `Timestamp: ${timestamp.body}`,
    `Source: ${source}`,
    `Owner: ${owner}`,
    `Priority: ${priority}`,
    "Status: Active",
    "",
    "## Task",
    `- ${title}`,
  ];
  if (context && context.trim()) {
    lines.push("", "## Context", context.trim());
  }
  if (acceptance && acceptance.trim()) {
    lines.push("", "## Acceptance", acceptance.trim());
  }
  lines.push("");
  return lines.join("\n");
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const identity = validateProjectWrite({ rootPath, input, args });
  const title = args.title || args.task;
  if (!title || !String(title).trim()) {
    throw new Error("title or task is required");
  }
  const priority = String(args.priority || "px").toLowerCase();
  if (!VALID_PRIORITIES.has(priority)) {
    throw new Error("priority must be one of p1, p2, p3, p4, or px");
  }
  const source = args.source || "director";
  const owner = args.owner || "shared";
  const context = args.context || "";
  const acceptance = args.acceptance || "";
  const agent = args.agent || "agent";
  const initialLogBody = input.body || "";

  const tasksPath = tasksPathForRoot(rootPath);
  fs.mkdirSync(tasksPath, { recursive: true });
  return withDirectoryLock(tasksPath, () => {
    const number = nextTaskNumber(tasksPath);
    const taskFolder = `A__${priority}-t${String(number).padStart(4, "0")}-${cappedTaskSlug(title)}`;
    const taskPath = path.join(tasksPath, taskFolder);
    fs.mkdirSync(taskPath);

    const now = new Date();
    const timestamp = localTimestamp(now);
    fs.writeFileSync(path.join(taskPath, "task.md"), buildTaskMarkdown({
      timestamp,
      source,
      owner,
      priority,
      title: String(title).trim(),
      context,
      acceptance,
    }), "utf8");

    let member = null;
    if (initialLogBody && String(initialLogBody).trim()) {
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
          body: String(initialLogBody),
          directorIntent: args["director-intent"],
          sourceInput: args["source-input"],
        },
        timestamp,
        record: 1,
      });
      appendGeneratedMember(path.join(taskPath, "log.zip"), member, logContent, now);
    }

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
    };
  });
}

runCli(main, { acceptedFlags: ACCEPTED_FLAGS, stringFlags: ["root", "project-id", "user-root", "input", "title", "task", "priority", "source", "owner", "context", "acceptance", "agent", "log-title", "director-intent", "source-input"] });
