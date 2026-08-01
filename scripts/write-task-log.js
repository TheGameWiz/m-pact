#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  appendMember,
  hasMembers,
} = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  booleanArg,
  localTimestamp,
  memberName,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "task",
  "task-path",
  "agent",
  "title",
  "slug-hint",
  "design-change",
  "spec-member",
  "no-spec-update-needed-because",
  "director-intent",
  "source-input",
];

function hasCurrentSpecification(taskPath) {
  const specZip = path.join(taskPath, "specification.zip");
  return hasMembers(specZip);
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const agent = args.agent || "agent";
  const title = args.title || args["slug-hint"] || "task-log-entry";
  const designChange = booleanArg(args, "design-change");
  const specMember = args["spec-member"];
  const noSpecUpdateReason = args["no-spec-update-needed-because"];
  return withDirectoryLock(taskPath, () => {
    if (designChange && hasCurrentSpecification(taskPath) && !specMember && !noSpecUpdateReason) {
      throw new Error("design-changing log entry requires specMember or noSpecUpdateNeededBecause because this task has a current specification");
    }

    const now = new Date();
    const timestamp = localTimestamp(now);
    const zipPath = path.join(taskPath, "log.zip");
    const appended = appendMember(zipPath, ({ record }) => {
      const member = memberName({
        number: record,
        source: agent,
        title,
        extension: ".md",
        includeSource: true,
      });
      const content = buildTaskLogMarkdown({
        record,
        timestamp,
        input: {
          agent,
          title,
          body: input.body,
          directorIntent: args["director-intent"],
          sourceInput: args["source-input"],
          specMember,
          noSpecUpdateNeededBecause: noSpecUpdateReason,
        },
      });
      return { member, content };
    }, now);

    return {
      ok: true,
      operation: "write-task-log",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      taskPath,
      zipPath,
      record: appended.record,
      member: appended.member,
      timestamp: timestamp.body,
    };
  });
}

runCli(main, { acceptedFlags: ACCEPTED_FLAGS, stringFlags: ["root", "project-id", "user-root", "input", "task", "task-path", "agent", "title", "slug-hint", "spec-member", "no-spec-update-needed-because", "director-intent", "source-input"] });
