#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const {
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { setCurrentTask, transitionTaskState } = require("./lib/task-state");

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["C"] });
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
    return { ok: true, operation: "reopen-task", task: transition.task, status: transition.status, sentinel };
  });
}

runCli(main);
