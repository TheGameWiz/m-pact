#!/usr/bin/env node
"use strict";

const {
  readContainerEntries,
  resolveContainer,
  scoreMember,
  tokenizeQuery,
  withContainerOperationLock,
} = require("./lib/container-state");
const { DEFAULT_UNSUPPORTED_OPERATION_FLAGS, runCli } = require("./lib/helper-common");

const ACCEPTED_FLAGS = ["root", "task", "task-path", "container", "query"];
const REQUIRED_FLAGS = ["container", "query"];
const REQUIRED_ONE_OF = [];

function main({ args }) {
  const query = args.query;
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    throw new Error("query is required");
  }
  const context = resolveContainer({}, args, { allowedStates: ["A", "C"] });
  return withContainerOperationLock(context, () => {
    const matches = readContainerEntries(context)
      .map((entry) => ({
        name: entry.name,
        size: entry.size,
        modified: entry.modified,
        record: entry.record,
        score: scoreMember(entry, tokens),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return {
      ok: true,
      operation: "search-bodies",
      rootPath: context.rootPath,
      taskPath: context.taskPath,
      zipPath: context.zipPath,
      query,
      matches,
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "task", "task-path", "container", "query"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
});
