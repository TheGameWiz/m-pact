#!/usr/bin/env node
"use strict";

const path = require("path");
const { appendMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { localTimestamp, memberName, resolveTaskPath, runCli } = require("./lib/helper-common");
const { validateProjectWrite } = require("./lib/project-identity");

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
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
    return { ok: true, operation: "write-task-summary", projectId: identity.projectId, projectPath: identity.projectPath, crossProject: identity.crossProject || undefined, taskPath, zipPath, record: appended.record, member: appended.member, timestamp: timestamp.body };
  });
}

runCli(main);
