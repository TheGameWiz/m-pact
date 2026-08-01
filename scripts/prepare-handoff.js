#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  collisionGroups,
  listContainerMembers,
  latestMember,
  resolveContainer,
  withContainerOperationLock,
} = require("./lib/container-state");
const { assertKnownFlags, assertMpactAllowedInCurrentSession, parseArgs, resolveTaskPath } = require("./lib/helper-common");

const DEFAULT_BUDGET_BYTES = 50 * 1024;
const ACCEPTED_FLAGS = ["root", "task", "task-path", "cursor", "read-cursor"];

function recommendedSpan(logMembers, cursor) {
  if (Number.isFinite(cursor)) {
    return logMembers.filter((member) => (member.record || 0) > cursor);
  }

  const totalBytes = logMembers.reduce((sum, member) => sum + member.size, 0);
  if (totalBytes <= DEFAULT_BUDGET_BYTES) {
    return logMembers;
  }

  const selected = [];
  let bytes = 0;
  for (const member of [...logMembers].reverse()) {
    selected.unshift(member);
    bytes += member.size;
    if (bytes >= DEFAULT_BUDGET_BYTES) {
      break;
    }
  }
  return selected;
}

function memberTable(members) {
  if (members.length === 0) {
    return "- (none)";
  }
  return [
    "| member | record | size | identity |",
    "| --- | ---: | ---: | --- |",
    ...members.map((member) => `| ${member.name} | ${member.record === null ? "" : member.record} | ${member.size} | ${member.identity || ""} |`),
  ].join("\n");
}

function main() {
  assertMpactAllowedInCurrentSession();
  const argv = process.argv.slice(2);
  assertKnownFlags(argv, ACCEPTED_FLAGS);
  const args = parseArgs(argv);
  const taskPath = resolveTaskPath({}, args, { allowedStates: ["A", "C"] });
  const cursorValue = args.cursor || args["read-cursor"];
  const cursor = cursorValue === undefined ? NaN : Number.parseInt(cursorValue, 10);

  const specContext = resolveContainer({}, { "task-path": taskPath, container: "specification" });
  const logContext = resolveContainer({}, { "task-path": taskPath, container: "task-log" });

  const plan = withContainerOperationLock(logContext, () => {
    const specMembers = listContainerMembers(specContext);
    const logMembers = listContainerMembers(logContext);
    return { specMembers, logMembers };
  });

  const { specMembers, logMembers } = plan;
  const latestSpec = latestMember(specMembers, specContext.container);
  const span = recommendedSpan(logMembers, cursor);
  const collisions = collisionGroups(logMembers);
  const totalLogBytes = logMembers.reduce((sum, member) => sum + member.size, 0);
  const spanBytes = span.reduce((sum, member) => sum + member.size, 0);

  const lines = [
    "# M-PACT Handoff Read Plan",
    "",
    `Task: ${path.basename(taskPath)}`,
    `TaskPath: ${taskPath}`,
    `CurrentSpecification: ${latestSpec ? `${latestSpec.name} (${latestSpec.size} bytes)` : "(none)"}`,
    `Cursor: ${Number.isFinite(cursor) ? cursor : "(none supplied)"}`,
    `TotalLogBytes: ${totalLogBytes}`,
    `RecommendedSpanBytes: ${spanBytes}`,
    "",
    "## Log Members",
    "",
    memberTable(logMembers),
    "",
    "## Recommended Span",
    "",
    span.length === 0 ? "- (none)" : span.map((member) => `- ${member.name} (${member.size} bytes)`).join("\n"),
    "",
    "## Collision Groups",
    "",
    collisions.length === 0
      ? "- (none)"
      : collisions.map(([record, group]) => `- ${record}: ${group.map((member) => member.name).join(", ")}`).join("\n"),
    "",
    "## Next Reads",
    "",
    "- Read `task.md`.",
    latestSpec ? `- Read current specification \`${latestSpec.name}\`.` : "- No specification snapshot is present.",
    span.length > 0 ? "- Read recommended log span in listed order, or use `scripts/read-member-span.js --container task-log --after <cursor>` for direct catch-up." : "- No log records are recommended by the supplied cursor.",
    "",
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`ERROR: ${error.message}\n`);
  process.exit(error.exitCode || 1);
}
