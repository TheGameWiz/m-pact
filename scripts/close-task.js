#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const {
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { transitionTaskState } = require("./lib/task-state");

function removeCurrentSentinel(tasksPath, folder) {
  const fs = require("fs");
  const pointerPath = path.join(tasksPath, `current__${folder}`);
  if (fs.existsSync(pointerPath)) {
    fs.unlinkSync(pointerPath);
  }
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
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
    return { ok: true, operation: "close-task", task: transition.task, status: transition.status };
  });
}

runCli(main);
