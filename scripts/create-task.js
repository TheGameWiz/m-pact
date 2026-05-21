#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { appendMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
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
  const title = input.title || args.title || input.task || args.task;
  if (!title || !String(title).trim()) {
    throw new Error("title or task is required");
  }
  const priority = String(input.priority || args.priority || "px").toLowerCase();
  if (!VALID_PRIORITIES.has(priority)) {
    throw new Error("priority must be one of p1, p2, p3, p4, or px");
  }
  const source = input.source || args.source || "director";
  const owner = input.owner || args.owner || "shared";
  const context = input.context || args.context || "";
  const acceptance = input.acceptance || args.acceptance || "";
  const agent = input.agent || args.agent || "agent";
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
        title: input.logTitle || input.log_title || args["log-title"] || "initial-task-handoff",
        extension: ".md",
        includeSource: true,
      });
      const logContent = buildTaskLogMarkdown({
        input: {
          ...input,
          agent,
          title: input.logTitle || input.log_title || args["log-title"] || "Initial Task Handoff",
          body: String(initialLogBody),
          directorIntent: input.directorIntent || input.director_intent || args["director-intent"],
          sourceInput: input.sourceInput || input.source_input || args["source-input"],
          noSpecUpdateNeededBecause: input.noSpecUpdateNeededBecause || input.no_spec_update_needed_because,
        },
        timestamp,
        record: 1,
      });
      appendMember(path.join(taskPath, "log.zip"), member, logContent, now);
    }

    const sentinel = booleanArg(args, "no-current") ? null : replaceCurrentTask(tasksPath, taskPath);
    return {
      ok: true,
      operation: "create-task",
      rootPath,
      taskPath,
      record: number,
      member,
      sentinel,
      timestamp: timestamp.body,
    };
  });
}

runCli(main);
