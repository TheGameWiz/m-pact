#!/usr/bin/env node
"use strict";

const path = require("path");
const { validateProjectWrite } = require("./lib/project-identity");
const { appendMember, readMember } = require("./lib/zip-record-store");
const {
  activeItemReceipt,
  enforceActiveItemHandoff,
} = require("./lib/active-items");
const {
  buildRepairLogBody,
  firstOrphanedSpecMember,
  formatOrphanedSpecMembers,
} = require("./lib/orphaned-companions");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  localTimestamp,
  memberName,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { withTaskOperationLock } = require("./lib/task-state");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "task",
  "task-path",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];
const REPAIR_AGENT = "repair";

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });

  return withTaskOperationLock(taskPath, () => {
    const detected = firstOrphanedSpecMember(taskPath);
    if (!detected.orphanedMember) {
      return {
        ok: true,
        operation: "repair-task-spec-log",
        projectId: identity.projectId,
        projectPath: identity.projectPath,
        crossProject: identity.crossProject || undefined,
        taskPath,
        orphanedSpecMembers: "(none)",
        announcement: "No orphaned specification companion record was detected; no repair record was created.",
      };
    }

    const logZipPath = path.join(taskPath, "log.zip");
    const body = buildRepairLogBody({
      taskPath,
      orphanedMember: detected.orphanedMember,
      specMembers: detected.specMembers,
      latestLogMember: detected.latestLogMember,
    });
    const latestBody = detected.latestLogMember
      ? readMember(logZipPath, detected.latestLogMember.name, { requireExistingParent: true }).toString("utf8")
      : "";
    const activeSummary = enforceActiveItemHandoff({
      body,
      latestRecord: detected.latestLogMember ? detected.latestLogMember.record : null,
      latestBody,
    });
    const recordBody = activeSummary && activeSummary.body ? activeSummary.body : body;

    const now = new Date();
    const timestamp = localTimestamp(now);
    const appended = appendMember(logZipPath, ({ record }) => {
      const member = memberName({
        number: record,
        source: REPAIR_AGENT,
        title: `repair ${detected.orphanedMember.name}`,
        extension: ".md",
        includeSource: true,
      });
      const content = buildTaskLogMarkdown({
        record,
        timestamp,
        input: {
          agent: REPAIR_AGENT,
          title: "Specification Companion Repair",
          body: recordBody,
          directorIntent: `Repair missing paired log record for ${detected.orphanedMember.name}.`,
        },
      });
      return { member, content };
    }, now, { requireExistingParent: true });

    return {
      ok: true,
      operation: "repair-task-spec-log",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      taskPath,
      zipPath: logZipPath,
      record: appended.record,
      member: appended.member,
      timestamp: timestamp.body,
      orphanedSpecMembers: formatOrphanedSpecMembers(detected.orphaned.slice(1)),
      repairedSpecMember: detected.orphanedMember.name,
      repairRecord: appended.member,
      activeItems: activeItemReceipt(activeSummary),
      announcement: `Missing paired specification log record detected for ${detected.orphanedMember.name}; created derived repair record ${appended.member}.`,
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "task", "task-path"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
});
