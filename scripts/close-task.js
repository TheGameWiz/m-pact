#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const {
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { transitionTaskState } = require("./lib/task-state");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "task",
  "task-path",
];

function removeCurrentSentinel(tasksPath, folder) {
  const fs = require("fs");
  const pointerPath = path.join(tasksPath, `current__${folder}`);
  if (fs.existsSync(pointerPath)) {
    fs.unlinkSync(pointerPath);
  }
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const folder = path.basename(taskPath);
  const tasksPath = path.dirname(taskPath);
  return withDirectoryLock(tasksPath, () => {
    const transition = transitionTaskState({
      taskPath,
      fromPrefix: "A",
      toPrefix: "C",
      fromStatus: "Active",
      toStatus: "Closed",
    });
    removeCurrentSentinel(tasksPath, folder);
    return { ok: true, operation: "close-task", projectId: identity.projectId, projectPath: identity.projectPath, crossProject: identity.crossProject || undefined, task: transition.task, status: transition.status };
  });
}

runCli(main, { acceptedFlags: ACCEPTED_FLAGS, stringFlags: ["root", "project-id", "user-root", "task", "task-path"] });
