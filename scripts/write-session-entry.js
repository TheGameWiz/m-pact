#!/usr/bin/env node
"use strict";

const path = require("path");
const { appendGeneratedMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { localTimestamp, resolveRootPath, runCli, sanitizeSlug } = require("./lib/helper-common");

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const agent = input.agent || args.agent || "agent";
  const type = input.type || args.type || "session";
  const summary = input.summary || input.body;
  if (!summary || !String(summary).trim()) {
    throw new Error("summary is required");
  }
  return withDirectoryLock(rootPath, () => {
    const now = new Date();
    const timestamp = localTimestamp(now);
    const slug = (sanitizeSlug(input.title || args.title || type) || "session").slice(0, 60).replace(/-+$/g, "");
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
      input.context ? "## Context" : null,
      input.context ? String(input.context).trim() : null,
      "",
    ].filter((line) => line !== null).join("\n");
    const zipPath = path.join(rootPath, "sessions.zip");
    appendGeneratedMember(zipPath, member, content, now);
    return { ok: true, operation: "write-session-entry", rootPath, zipPath, member, timestamp: timestamp.body };
  });
}

runCli(main);
