#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const { resolveActiveMemoryRoot } = require("./lib/scratch");
const {
  agentTokenValidator,
  DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  resolveAgentToken,
  resolveRootPath,
  runCli,
} = require("./lib/helper-common");
const { writeSavedContext } = require("./lib/saved-context");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "from-stdin",
  "agent",
  "source-input",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];
const FLAG_VALUE_VALIDATORS = {
  agent: agentTokenValidator,
};

function resolvedSaveRoot(input, args) {
  if (args.root) {
    return resolveRootPath(input, args);
  }
  return resolveActiveMemoryRoot({
    startPath: process.cwd(),
    userRoot: args["user-root"],
  });
}

function main({ args, input }) {
  const rootPath = resolvedSaveRoot(input, args);
  const identity = validateProjectWrite({ rootPath, input, args });
  const agent = resolveAgentToken(args);
  return withDirectoryLock(rootPath, () => {
    const saved = writeSavedContext(rootPath, agent, input.body || "");
    return {
      ok: true,
      operation: "save-context",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      rootPath,
      member: saved.name,
      timestamp: saved.timestamp,
      taskPath: undefined,
      zipPath: undefined,
      oldPath: undefined,
      newPath: path.dirname(saved.path),
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "input", "agent", "source-input"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: FLAG_VALUE_VALIDATORS,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  stdinFlags: ["from-stdin"],
});
