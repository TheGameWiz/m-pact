#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { booleanArg, resolveRootPath, runCli } = require("./lib/helper-common");
const { validateProjectWrite } = require("./lib/project-identity");
const { listMembers } = require("./lib/zip-record-store");
const { withRecordMetadata } = require("./lib/container-state");
const { formatTaskLogCatalogReceipt } = require("./lib/task-log-catalog");
const { clearCurrentSentinels, setCurrentTask, taskNumberFromFolder, validateTaskPath } = require("./lib/task-state");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "task",
  "task-path",
  "clear",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [["task", "task-path", "clear"]];

function resolveTaskFolder(rootPath, args, input) {
  const value = args.task || args["task-path"];
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
  const identity = validateProjectWrite({ rootPath, input, args });
  const rootTasksPath = path.join(rootPath, "tasks");
  if (booleanArg(args, "clear")) {
    return withDirectoryLock(rootTasksPath, () => {
      const cleared = clearCurrentSentinels(rootTasksPath);
      return { ok: true, operation: "clear-current-task", rootPath, projectId: identity.projectId, projectPath: identity.projectPath, crossProject: identity.crossProject || undefined, status: `cleared ${cleared.length}` };
    });
  }
  const { tasksPath, taskPath, folder } = resolveTaskFolder(rootPath, args, input);
  return withDirectoryLock(tasksPath, () => {
    const sentinel = setCurrentTask(tasksPath, taskPath);
    const logMembers = listMembers(path.join(taskPath, "log.zip"), { requireExistingParent: true })
      .map((member) => withRecordMetadata(member, { recordsExpected: true }));
    return {
      ok: true,
      operation: "set-current-task",
      rootPath,
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      taskPath,
      sentinel,
      taskLogCatalog: formatTaskLogCatalogReceipt(logMembers, { taskId: taskNumberFromFolder(folder) }),
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "task", "task-path"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
});
