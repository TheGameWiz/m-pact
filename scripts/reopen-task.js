#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const {
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { setCurrentTask, transitionTaskState } = require("./lib/task-state");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "task",
  "task-path",
];

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["C"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const folder = path.basename(taskPath);
  const tasksPath = path.dirname(taskPath);
  return withDirectoryLock(tasksPath, () => {
    const transition = transitionTaskState({
      taskPath,
      fromPrefix: "C",
      toPrefix: "A",
      fromStatus: "Closed",
      toStatus: "Active",
    });
    const sentinel = setCurrentTask(tasksPath, transition.newPath);
    return { ok: true, operation: "reopen-task", projectId: identity.projectId, projectPath: identity.projectPath, crossProject: identity.crossProject || undefined, task: transition.task, status: transition.status, sentinel };
  });
}

runCli(main, { acceptedFlags: ACCEPTED_FLAGS, stringFlags: ["root", "project-id", "user-root", "task", "task-path"] });
