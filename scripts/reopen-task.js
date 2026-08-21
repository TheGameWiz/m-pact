#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const {
  listMembers,
  readMember,
} = require("./lib/zip-record-store");
const { withRecordMetadata } = require("./lib/container-state");
const { newestTaskLogMember } = require("./lib/active-items");
const {
  agentTokenValidator,
  resolveAgentToken,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { parseCloseStatus } = require("./lib/close-status");
const { setCurrentTask, transitionTaskState, withTaskOperationLock } = require("./lib/task-state");
const { recordCurrentAgentSession } = require("./lib/agents-store");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "task",
  "task-path",
  "agent",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];
const FLAG_VALUE_VALIDATORS = {
  agent: agentTokenValidator,
};

function latestCloseStatus(taskPath) {
  const logZipPath = path.join(taskPath, "log.zip");
  const members = listMembers(logZipPath, { requireExistingParent: true }).map((member) => withRecordMetadata(member, { recordsExpected: true }));
  const latest = newestTaskLogMember(members);
  if (!latest) {
    return { unfinished: [], clearedUnresolved: [] };
  }
  return parseCloseStatus(readMember(logZipPath, latest.name, { requireExistingParent: true }).toString("utf8"));
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["C"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const agent = resolveAgentToken(args);
  const tasksPath = path.dirname(taskPath);
  return withDirectoryLock(tasksPath, () => withTaskOperationLock(taskPath, () => {
    const closeStatus = latestCloseStatus(taskPath);
    const transition = transitionTaskState({
      taskPath,
      fromPrefix: "C",
      toPrefix: "A",
    });
    const sentinel = setCurrentTask(tasksPath, transition.newPath);
    recordCurrentAgentSession(transition.newPath, agent);
    return {
      ok: true,
      operation: "reopen-task",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      task: transition.task,
      status: transition.status,
      sentinel,
      reopenUnfinished: closeStatus.unfinished.length ? closeStatus.unfinished.join(", ") : "(none)",
      reopenClearedUnresolved: closeStatus.clearedUnresolved.length ? closeStatus.clearedUnresolved.join(", ") : "(none)",
      warning: closeStatus.unfinished.length || closeStatus.clearedUnresolved.length
        ? "reopen does not return close-status items to Active Items automatically; seed the next task log deliberately"
        : undefined,
    };
  }));
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "task", "task-path", "agent"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: FLAG_VALUE_VALIDATORS,
});
