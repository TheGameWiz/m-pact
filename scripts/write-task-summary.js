#!/usr/bin/env node
"use strict";

const path = require("path");
const { appendMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { localTimestamp, memberName, resolveTaskPath, runCli } = require("./lib/helper-common");

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const body = input.body;
  if (!body || !String(body).trim()) {
    throw new Error("body is required");
  }
  const agent = input.agent || args.agent || "agent";
  const scope = input.scope || input.title || args.scope || args.title || "task-summary";
  return withDirectoryLock(taskPath, () => {
    const now = new Date();
    const timestamp = localTimestamp(now);
    const zipPath = path.join(taskPath, "summary.zip");
    const appended = appendMember(zipPath, ({ record }) => {
      const member = memberName({ number: record, source: agent, title: scope, extension: ".md", includeSource: true });
      const content = [
        "# Task Summary",
        "",
        `Timestamp: ${timestamp.body}`,
        `Agent: ${agent}`,
        `Scope: ${scope}`,
        `Task: ${path.basename(taskPath)}`,
        "",
        String(body).trim(),
        "",
      ].join("\n");
      return { member, content };
    }, now);
    return { ok: true, operation: "write-task-summary", taskPath, zipPath, record: appended.record, member: appended.member, timestamp: timestamp.body };
  });
}

runCli(main);
