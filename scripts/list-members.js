#!/usr/bin/env node
"use strict";

const {
  listContainerMembers,
  resolveContainer,
  withContainerOperationLock,
} = require("./lib/container-state");
const { runCli } = require("./lib/helper-common");

const ACCEPTED_FLAGS = ["root", "task", "task-path", "container"];

function main({ args }) {
  const context = resolveContainer({}, args, { allowedStates: ["A", "C"] });
  return withContainerOperationLock(context, () => ({
    ok: true,
    operation: "list-members",
    rootPath: context.rootPath,
    taskPath: context.taskPath,
    zipPath: context.zipPath,
    members: listContainerMembers(context),
  }));
}

runCli(main, { acceptedFlags: ACCEPTED_FLAGS, stringFlags: ["root", "task", "task-path", "container"] });
