#!/usr/bin/env node
"use strict";

const {
  listContainerMembers,
  readSelectedMember,
  resolveContainer,
  selectMember,
  withContainerOperationLock,
} = require("./lib/container-state");
const { runCli } = require("./lib/helper-common");

function main({ args, input }) {
  const context = resolveContainer(input, args, { allowedStates: ["A", "C"] });
  return withContainerOperationLock(context, () => {
    const members = listContainerMembers(context);
    const selected = selectMember(members, context.container, args);
    return {
      ok: true,
      operation: "read-member",
      rootPath: context.rootPath,
      taskPath: context.taskPath,
      zipPath: context.zipPath,
      record: selected.record,
      member: selected.name,
      content: readSelectedMember(context, selected),
    };
  });
}

runCli(main);
