#!/usr/bin/env node
"use strict";

const path = require("path");
const { appendMember, listMembers } = require("./lib/zip-record-store");
const { withDirectoryLock } = require("./lib/directory-lock");
const { localTimestamp, resolveRootPath, runCli, sanitizeSlug } = require("./lib/helper-common");

function cappedSlug(title, prefix, suffix) {
  const max = 128 - prefix.length - suffix.length;
  return (sanitizeSlug(title) || "case-study").slice(0, max).replace(/-+$/g, "") || "case-study";
}

function uniqueMemberName(zipPath, timestamp, title) {
  const suffix = ".md";
  const existing = new Set(listMembers(zipPath).map((member) => member.name));
  const shortPrefix = `${timestamp.date}-`;
  const shortName = `${shortPrefix}${cappedSlug(title, shortPrefix, suffix)}${suffix}`;
  if (!existing.has(shortName)) {
    return shortName;
  }
  const longPrefix = `${timestamp.filename}-`;
  return `${longPrefix}${cappedSlug(title, longPrefix, suffix)}${suffix}`;
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const title = input.title || input.slugHint || args.title || args["slug-hint"] || "Case Study";
  const body = input.body;
  if (!body || !String(body).trim()) {
    throw new Error("body is required");
  }
  const topic = input.topic || args.topic || "general";
  const relatedRule = input.relatedRule || input.related_rule || args["related-rule"] || null;
  return withDirectoryLock(rootPath, () => {
    const now = new Date();
    const timestamp = localTimestamp(now);
    const zipPath = path.join(rootPath, "case-studies.zip");
    const member = uniqueMemberName(zipPath, timestamp, title);
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

    appendMember(zipPath, member, content, now);
    return { ok: true, operation: "write-case-study", rootPath, zipPath, member, timestamp: timestamp.body };
  });
}

runCli(main);
