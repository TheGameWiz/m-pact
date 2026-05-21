#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { booleanArg, resolveRootPath, runCli } = require("./lib/helper-common");
const { clearCurrentSentinels, setCurrentTask, validateTaskPath } = require("./lib/task-state");

function resolveTaskFolder(rootPath, args, input) {
  const value = input.task || input.taskPath || args.task || args["task-path"];
  if (!value) {
    throw new Error("task is required");
  }
  const tasksPath = path.join(rootPath, "tasks");
  const taskIdMatch = /^t?(\d{1,4})$/i.exec(String(value).trim());
  let candidate;
  if (taskIdMatch) {
    const taskId = `t${taskIdMatch[1].padStart(4, "0")}`;
    const matches = fs.readdirSync(tasksPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.includes(`-${taskId}-`))
      .map((entry) => path.join(tasksPath, entry.name));
    if (matches.length === 0) {
      throw new Error(`task not found: ${taskId}`);
    }
    if (matches.length > 1) {
      throw new Error(`multiple tasks match ${taskId}`);
    }
    candidate = matches[0];
  } else {
    candidate = path.isAbsolute(value) ? path.resolve(value) : path.resolve(tasksPath, value);
  }
  if (!candidate) {
    throw new Error(`task not found: ${value}`);
  }
  if (path.dirname(candidate) !== path.resolve(tasksPath)) {
    throw new Error("task must be directly under root tasks folder");
  }
  const validated = validateTaskPath(candidate, {
    allowedStates: ["A"],
    sameTasksPath: tasksPath,
  });
  return { tasksPath, taskPath: validated.taskPath, folder: validated.folder };
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const rootTasksPath = path.join(rootPath, "tasks");
  if (booleanArg(args, "clear")) {
    return withDirectoryLock(rootTasksPath, () => {
      const cleared = clearCurrentSentinels(rootTasksPath);
      return { ok: true, operation: "clear-current-task", rootPath, status: `cleared ${cleared.length}` };
    });
  }
  const { tasksPath, taskPath, folder } = resolveTaskFolder(rootPath, args, input);
  return withDirectoryLock(tasksPath, () => {
    const sentinel = setCurrentTask(tasksPath, taskPath);
    return { ok: true, operation: "set-current-task", rootPath, taskPath, sentinel };
  });
}

runCli(main);
