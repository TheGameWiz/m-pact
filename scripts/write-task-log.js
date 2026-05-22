#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  appendMember,
  hasMembers,
} = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  booleanArg,
  localTimestamp,
  memberName,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");

function hasCurrentSpecification(taskPath) {
  const specZip = path.join(taskPath, "specification.zip");
  return hasMembers(specZip);
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const agent = input.agent || args.agent || "agent";
  const title = input.title || input.slugHint || args.title || args["slug-hint"] || "task-log-entry";
  const designChange = Boolean(input.designChange || input.design_change || booleanArg(args, "design-change"));
  const specMember = input.specMember || input.spec_member || args["spec-member"];
  const noSpecUpdateReason = input.noSpecUpdateNeededBecause || input.no_spec_update_needed_because || args["no-spec-update-needed-because"];
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
          ...input,
          agent,
          title,
          directorIntent: input.directorIntent || input.director_intent || args["director-intent"],
          sourceInput: input.sourceInput || input.source_input || args["source-input"],
          specMember,
          noSpecUpdateNeededBecause: noSpecUpdateReason,
        },
      });
      return { member, content };
    }, now);

    return {
      ok: true,
      operation: "write-task-log",
      taskPath,
      zipPath,
      record: appended.record,
      member: appended.member,
      timestamp: timestamp.body,
    };
  });
}

runCli(main);
