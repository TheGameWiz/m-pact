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
const { validateProjectWrite } = require("./lib/project-identity");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "title",
  "slug-hint",
  "project",
  "phase",
  "key-insight",
];

function cappedSlug(title, prefix, suffix) {
  const max = 128 - prefix.length - suffix.length;
  return (sanitizeSlug(title) || "journal-entry").slice(0, max).replace(/-+$/g, "") || "journal-entry";
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const identity = validateProjectWrite({ rootPath, input, args });
  const title = args.title || args["slug-hint"] || "journal entry";
  const body = input.body;
  if (!body || !String(body).trim()) {
    throw new Error("body is required");
  }
  const project = args.project || path.basename(path.resolve(rootPath, ".."));
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
      args.phase ? `Phase: ${args.phase}` : null,
      `Date: ${timestamp.date}`,
      "Author: director",
      "",
      String(body).trim(),
      "",
      args["key-insight"] ? `Key Insight: ${args["key-insight"]}` : null,
      "",
    ].filter((line) => line !== null).join("\n");
    const zipPath = path.join(rootPath, "journal.zip");
    appendGeneratedMember(zipPath, member, content, now);
    return { ok: true, operation: "write-journal-entry", rootPath, projectId: identity.projectId, projectPath: identity.projectPath, crossProject: identity.crossProject || undefined, zipPath, member, timestamp: timestamp.body };
  });
}

runCli(main, { acceptedFlags: ACCEPTED_FLAGS, stringFlags: ["root", "project-id", "user-root", "input", "title", "slug-hint", "project", "phase", "key-insight"] });
