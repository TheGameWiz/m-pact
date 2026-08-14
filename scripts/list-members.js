#!/usr/bin/env node
"use strict";

const {
  listContainerMembers,
  resolveContainer,
  withContainerOperationLock,
} = require("./lib/container-state");
const { DEFAULT_UNSUPPORTED_OPERATION_FLAGS, runCli } = require("./lib/helper-common");

const ACCEPTED_FLAGS = ["root", "task", "task-path", "container"];
const REQUIRED_FLAGS = ["container"];
const REQUIRED_ONE_OF = [];

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

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "task", "task-path", "container"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
});
