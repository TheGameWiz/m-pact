#!/usr/bin/env node
"use strict";

const {
  collisionGroups,
  readContainerEntries,
  resolveContainer,
  withContainerOperationLock,
} = require("./lib/container-state");
const { runCli } = require("./lib/helper-common");

function integerArg(args, name, fallback = null) {
  if (args[name] === undefined) {
    return fallback;
  }
  const value = Number.parseInt(String(args[name]), 10);
  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be a number`);
  }
  return value;
}

function main({ args, input }) {
  const context = resolveContainer(input, args, { allowedStates: ["A", "C"] });
  if (!context.container.recordsExpected) {
    throw new Error(`read-member-span requires a numbered container; ${context.container.name} is not numbered`);
  }
  const after = integerArg(args, "after", 0);
  const through = integerArg(args, "through", Number.MAX_SAFE_INTEGER);
  const maxBytes = integerArg(args, "max-bytes", null);
  if (through < after) {
    throw new Error("--through must be greater than or equal to --after");
  }

  return withContainerOperationLock(context, () => {
    const entries = readContainerEntries(context);
    const selected = entries.filter((entry) => entry.record !== null && entry.record > after && entry.record <= through);
    const collisionNames = new Set(collisionGroups(entries).flatMap(([, group]) => group.map((member) => member.name)));
    const output = [];
    const members = [];
    let bytes = 0;
    let truncated = false;
    for (const entry of selected) {
      const text = entry.content.toString("utf8");
      const nextBytes = Buffer.byteLength(text, "utf8");
      if (maxBytes !== null && output.length > 0 && bytes + nextBytes > maxBytes && !collisionNames.has(entry.name)) {
        truncated = true;
        break;
      }
      output.push(`## ${entry.name}\n\n${text.replace(/\s*$/, "")}\n`);
      members.push(entry);
      bytes += nextBytes;
      if (maxBytes !== null && bytes >= maxBytes) {
        const next = selected[selected.indexOf(entry) + 1];
        if (!next || !collisionNames.has(next.name)) {
          truncated = Boolean(next);
          break;
        }
      }
    }
    const nextCursor = members.length > 0
      ? Math.max(...members.map((member) => member.record).filter((record) => record !== null))
      : after;
    return {
      ok: true,
      operation: "read-member-span",
      rootPath: context.rootPath,
      taskPath: context.taskPath,
      zipPath: context.zipPath,
      readFrom: members.length > 0 ? members[0].record : null,
      readThrough: members.length > 0 ? nextCursor : null,
      nextCursor,
      truncated,
      membersRead: members.length,
      members,
      content: output.join("\n"),
    };
  });
}

runCli(main);
