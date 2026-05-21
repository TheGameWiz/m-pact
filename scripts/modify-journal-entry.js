#!/usr/bin/env node
"use strict";

const path = require("path");
const { listMembers, readMember, replaceMember } = require("./lib/zip-record-store");
const { booleanArg, localTimestamp, resolveRootPath, runCli, sanitizeSlug } = require("./lib/helper-common");

function selectMember(members, input, args) {
  if (input.member || args.member) {
    const member = input.member || args.member;
    const selected = members.find((candidate) => candidate.name === member);
    if (!selected) {
      throw new Error(`journal entry not found: ${member}`);
    }
    return selected;
  }
  if (input.latest || booleanArg(args, "latest")) {
    return [...members].sort((a, b) => b.name.localeCompare(a.name))[0] || null;
  }
  const query = input.query || args.query;
  if (!query) {
    throw new Error("member, latest, or query is required");
  }
  const tokens = sanitizeSlug(query).split("-").filter(Boolean);
  const matches = members.filter((member) => {
    const normalized = sanitizeSlug(member.name);
    return tokens.every((token) => normalized.includes(token));
  });
  if (matches.length !== 1) {
    throw new Error(`journal query matched ${matches.length} entries`);
  }
  return matches[0];
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const zipPath = path.join(rootPath, "journal.zip");
  const members = listMembers(zipPath);
  const selected = selectMember(members, input, args);
  if (!selected) {
    throw new Error("journal entry not found");
  }
  const replace = booleanArg(args, "replace");
  const appendText = input.append || args.append || (!replace ? input.body : null);
  const replacement = input.content || (replace ? input.body : null);
  if (!appendText && !replacement) {
    throw new Error("append or content is required");
  }
  const oldContent = readMember(zipPath, selected.name).toString("utf8");
  const timestamp = localTimestamp(new Date());
  const newContent = replacement
    ? String(replacement)
    : `${oldContent.replace(/\s*$/, "")}\n\n${String(appendText).trim()}\n`;
  replaceMember(zipPath, selected.name, newContent, new Date());
  return { ok: true, operation: "modify-journal-entry", rootPath, zipPath, member: selected.name, timestamp: timestamp.body };
}

runCli(main);
