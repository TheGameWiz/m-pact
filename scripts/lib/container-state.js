#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./directory-lock");
const { getContainer } = require("./container-registry");
const { resolveRootPath, resolveTaskPath, sanitizeSlug } = require("./helper-common");
const {
  listMembers,
  readMember,
  readZipEntries,
} = require("./zip-record-store");

function recordFromName(name) {
  const match = /^(\d{4})-(?!\d{2}-)/.exec(name);
  return match ? Number.parseInt(match[1], 10) : null;
}

function identityFromName(name) {
  const match = /^(\d{4})-(?!\d{2}-)([^-]+)-/.exec(name);
  return match ? `${match[1]}-${match[2]}` : null;
}

function withRecordMetadata(member, container = {}) {
  const recordsExpected = container.recordsExpected !== false;
  return {
    ...member,
    record: recordsExpected ? recordFromName(member.name) : null,
    identity: recordsExpected ? identityFromName(member.name) : null,
  };
}

function sortMembers(members, container) {
  const enriched = members.map((member) => withRecordMetadata(member, container));
  if (container.defaultSort === "record-asc") {
    return enriched.sort((a, b) => {
      const ar = a.record === null ? Number.MAX_SAFE_INTEGER : a.record;
      const br = b.record === null ? Number.MAX_SAFE_INTEGER : b.record;
      return ar - br || a.name.localeCompare(b.name);
    });
  }
  return enriched.sort((a, b) => b.name.localeCompare(a.name));
}

function resolveContainer(input = {}, args = {}, options = {}) {
  const container = getContainer(input.container || args.container);
  if (container.scope === "task") {
    const taskPath = resolveTaskPath(input, args, { allowedStates: options.allowedStates || ["A", "C"] });
    return {
      container,
      taskPath,
      zipPath: path.join(taskPath, container.zipFilename),
      lockTarget: taskPath,
    };
  }
  const rootPath = resolveRootPath(input, args);
  return {
    container,
    rootPath,
    zipPath: path.join(rootPath, container.zipFilename),
    lockTarget: rootPath,
  };
}

function withContainerOperationLock(context, fn) {
  return withDirectoryLock(context.lockTarget, fn);
}

function listContainerMembers(context) {
  return sortMembers(listMembers(context.zipPath), context.container);
}

function readContainerEntries(context) {
  return sortMembers(readZipEntries(context.zipPath).map((entry) => ({
    name: entry.name,
    size: entry.content.length,
    modified: entry.modified.toISOString(),
    content: entry.content,
  })), context.container);
}

function latestMember(members, container) {
  if (members.length === 0) {
    return null;
  }
  if (container.defaultSort === "record-asc") {
    return [...members].sort((a, b) => {
      const ar = a.record === null ? -1 : a.record;
      const br = b.record === null ? -1 : b.record;
      return br - ar || b.name.localeCompare(a.name);
    })[0];
  }
  return [...members].sort((a, b) => b.name.localeCompare(a.name))[0];
}

function selectMember(members, container, args = {}) {
  if (args.member || args.name) {
    const name = String(args.member || args.name);
    const exact = members.find((member) => member.name === name);
    if (!exact) {
      throw new Error(`member not found: ${name}`);
    }
    return exact;
  }
  if (args.record !== undefined) {
    if (!container.recordsExpected) {
      throw new Error(`--record is not valid for ${container.name}`);
    }
    const record = Number.parseInt(String(args.record), 10);
    if (!Number.isFinite(record)) {
      throw new Error("--record must be a number");
    }
    const matches = members.filter((member) => member.record === record);
    if (matches.length === 0) {
      throw new Error(`record not found: ${record}`);
    }
    if (matches.length > 1) {
      throw new Error(`record ${record} is ambiguous: ${matches.map((member) => member.name).join(", ")}`);
    }
    return matches[0];
  }
  if (args.latest) {
    const latest = latestMember(members, container);
    if (!latest) {
      throw new Error(`no members found in ${container.name}`);
    }
    return latest;
  }
  throw new Error("select a member with --member, --record, or --latest");
}

function readSelectedMember(context, selected) {
  return readMember(context.zipPath, selected.name).toString("utf8");
}

function tokenizeQuery(query) {
  return String(query || "")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function scoreText(text, tokens) {
  const haystack = String(text || "").toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 5;
    }
    const slug = sanitizeSlug(token);
    if (slug && sanitizeSlug(haystack).includes(slug)) {
      score += 3;
    }
  }
  return score;
}

function scoreMember(entry, tokens) {
  const filenameScore = scoreText(entry.name, tokens);
  const bodyText = Buffer.isBuffer(entry.content) ? entry.content.toString("utf8") : String(entry.content || "");
  const bodyScore = scoreText(bodyText, tokens);
  return filenameScore * 4 + bodyScore;
}

function collisionGroups(members) {
  const groups = new Map();
  for (const member of members) {
    if (member.record === null) {
      continue;
    }
    const key = String(member.record).padStart(4, "0");
    const group = groups.get(key) || [];
    group.push(member);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

module.exports = {
  collisionGroups,
  identityFromName,
  latestMember,
  listContainerMembers,
  readContainerEntries,
  readSelectedMember,
  recordFromName,
  resolveContainer,
  scoreMember,
  selectMember,
  tokenizeQuery,
  withContainerOperationLock,
  withRecordMetadata,
};
