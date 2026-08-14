#!/usr/bin/env node
"use strict";

const path = require("path");
const { appendGeneratedMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { agentTokenValidator, localTimestamp, resolveAgentToken, resolveRootPath, runCli, sanitizeSlug } = require("./lib/helper-common");
const { validateProjectWrite } = require("./lib/project-identity");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "from-stdin",
  "agent",
  "type",
  "title",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

function stripDuplicateGeneratedHeading(body, heading) {
  const text = String(body || "");
  const match = /^(?:[ \t]*(?:\r\n|\n|\r))*([^\r\n]*)(\r\n|\n|\r|$)/.exec(text);
  if (!match) {
    return text;
  }
  const firstLine = match[1].replace(/[ \t]+$/g, "");
  if (firstLine !== heading) {
    return text;
  }
  return text.slice(match[0].length).replace(/^(?:[ \t]*(?:\r\n|\n|\r))+/, "");
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const identity = validateProjectWrite({ rootPath, input, args });
  const agent = resolveAgentToken(args);
  const type = args.type || "session";
  const summary = stripDuplicateGeneratedHeading(input.body, "## Summary");
  if (!summary || !String(summary).trim()) {
    throw new Error("summary is required");
  }
  return withDirectoryLock(rootPath, () => {
    const now = new Date();
    const timestamp = localTimestamp(now);
    const slug = (sanitizeSlug(args.title || type) || "session").slice(0, 60).replace(/-+$/g, "");
    const member = `${timestamp.filename}-${sanitizeSlug(agent) || "agent"}-${slug}.md`;
    const content = [
      "# Session Entry",
      "",
      `Timestamp: ${timestamp.body}`,
      `Agent: ${agent}`,
      `Type: ${type}`,
      "",
      "## Summary",
      String(summary).trim(),
      "",
      "",
    ].filter((line) => line !== null).join("\n");
    const zipPath = path.join(rootPath, "sessions.zip");
    appendGeneratedMember(zipPath, member, content, now);
    return { ok: true, operation: "write-session-entry", rootPath, projectId: identity.projectId, projectPath: identity.projectPath, crossProject: identity.crossProject || undefined, zipPath, member, timestamp: timestamp.body };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "input", "agent", "type", "title"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: {
    agent: agentTokenValidator,
  },
  stdinFlags: ["from-stdin"],
});
