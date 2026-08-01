#!/usr/bin/env node
"use strict";

const path = require("path");
const { appendGeneratedMember } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { localTimestamp, resolveRootPath, runCli, sanitizeSlug } = require("./lib/helper-common");
const { validateProjectWrite } = require("./lib/project-identity");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "title",
  "slug-hint",
  "topic",
  "related-rule",
];

function cappedSlug(title, prefix, suffix) {
  const max = 128 - prefix.length - suffix.length;
  return (sanitizeSlug(title) || "case-study").slice(0, max).replace(/-+$/g, "") || "case-study";
}

function memberName(timestamp, title) {
  const suffix = ".md";
  const longPrefix = `${timestamp.filename}-`;
  return `${longPrefix}${cappedSlug(title, longPrefix, suffix)}${suffix}`;
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const identity = validateProjectWrite({ rootPath, input, args });
  const title = args.title || args["slug-hint"] || "Case Study";
  const body = input.body;
  if (!body || !String(body).trim()) {
    throw new Error("body is required");
  }
  const topic = args.topic || "general";
  const relatedRule = args["related-rule"] || null;
  return withDirectoryLock(rootPath, () => {
    const now = new Date();
    const timestamp = localTimestamp(now);
    const zipPath = path.join(rootPath, "case-studies.zip");
    const member = memberName(timestamp, title);
    const content = [
      "---",
      `title: ${title}`,
      `date: ${timestamp.date}`,
      `topic: ${topic}`,
      relatedRule ? `related-rule: ${relatedRule}` : null,
      "---",
      "",
      `# ${title}`,
      "",
      String(body).trim(),
      "",
    ].filter((line) => line !== null).join("\n");

    appendGeneratedMember(zipPath, member, content, now);
    return { ok: true, operation: "write-case-study", rootPath, projectId: identity.projectId, projectPath: identity.projectPath, crossProject: identity.crossProject || undefined, zipPath, member, timestamp: timestamp.body };
  });
}

runCli(main, { acceptedFlags: ACCEPTED_FLAGS, stringFlags: ["root", "project-id", "user-root", "input", "title", "slug-hint", "topic", "related-rule"] });
