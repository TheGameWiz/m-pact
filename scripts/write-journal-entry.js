#!/usr/bin/env node
"use strict";

const path = require("path");
const { appendGeneratedMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const {
  localTimestamp,
  resolveRootPath,
  runCli,
  sanitizeSlug,
} = require("./lib/helper-common");

function cappedSlug(title, prefix, suffix) {
  const max = 128 - prefix.length - suffix.length;
  return (sanitizeSlug(title) || "journal-entry").slice(0, max).replace(/-+$/g, "") || "journal-entry";
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const title = input.title || input.slugHint || args.title || args["slug-hint"] || "journal entry";
  const body = input.body;
  if (!body || !String(body).trim()) {
    throw new Error("body is required");
  }
  const project = input.project || args.project || path.basename(path.resolve(rootPath, ".."));
  return withDirectoryLock(rootPath, () => {
    const now = new Date();
    const timestamp = localTimestamp(now);
    const prefix = `${timestamp.filename}-director-`;
    const suffix = ".md";
    const member = `${prefix}${cappedSlug(title, prefix, suffix)}${suffix}`;
    const content = [
      `# ${title}`,
      "",
      `Project: ${project}`,
      input.phase || args.phase ? `Phase: ${input.phase || args.phase}` : null,
      `Date: ${timestamp.date}`,
      "Author: director",
      "",
      String(body).trim(),
      "",
      input.keyInsight || args["key-insight"] ? `Key Insight: ${input.keyInsight || args["key-insight"]}` : null,
      "",
    ].filter((line) => line !== null).join("\n");
    const zipPath = path.join(rootPath, "journal.zip");
    appendGeneratedMember(zipPath, member, content, now);
    return { ok: true, operation: "write-journal-entry", rootPath, zipPath, member, timestamp: timestamp.body };
  });
}

runCli(main);
