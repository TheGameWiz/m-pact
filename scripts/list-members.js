#!/usr/bin/env node
"use strict";

const {
  listContainerMembers,
  resolveContainer,
  withContainerOperationLock,
} = require("./lib/container-state");
const { runCli } = require("./lib/helper-common");

function main({ args, input }) {
  const context = resolveContainer(input, args, { allowedStates: ["A", "C"] });
  return withContainerOperationLock(context, () => ({
    ok: true,
    operation: "list-members",
    rootPath: context.rootPath,
    taskPath: context.taskPath,
    zipPath: context.zipPath,
    members: listContainerMembers(context),
  }));
}

runCli(main);
