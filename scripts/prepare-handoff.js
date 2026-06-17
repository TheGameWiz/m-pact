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
const { assertMpactAllowedInCurrentSession, parseArgs, resolveTaskPath } = require("./lib/helper-common");

const DEFAULT_BUDGET_BYTES = 50 * 1024;

function summaryBoundary(summaryMembers) {
  return [...summaryMembers].sort((a, b) => b.name.localeCompare(a.name))[0] || null;
}

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
  const args = parseArgs(process.argv.slice(2));
  const taskPath = resolveTaskPath({}, args, { allowedStates: ["A", "C"] });
  const cursorValue = args.cursor || args["read-cursor"];
  const cursor = cursorValue === undefined ? NaN : Number.parseInt(cursorValue, 10);

  const specContext = resolveContainer({ taskPath, container: "specification" }, {});
  const logContext = resolveContainer({ taskPath, container: "task-log" }, {});
  const summaryContext = resolveContainer({ taskPath, container: "task-summary" }, {});

  const plan = withContainerOperationLock(logContext, () => {
    const specMembers = listContainerMembers(specContext);
    const logMembers = listContainerMembers(logContext);
    const summaryMembers = listContainerMembers(summaryContext);
    return { specMembers, logMembers, summaryMembers };
  });

  const { specMembers, logMembers, summaryMembers } = plan;
  const latestSpec = latestMember(specMembers, specContext.container);
  const boundary = summaryBoundary(summaryMembers);
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
    `SummaryBoundary: ${boundary ? `${boundary.name} (${boundary.size} bytes)` : "(none)"}`,
    `Cursor: ${Number.isFinite(cursor) ? cursor : "(none supplied)"}`,
    `TotalLogBytes: ${totalLogBytes}`,
    `RecommendedSpanBytes: ${spanBytes}`,
    "",
    "## Log Members",
    "",
    memberTable(logMembers),
    "",
    "## Summary Members",
    "",
    memberTable(summaryMembers),
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
    boundary ? "- Treat the summary boundary as background context only; later log records still need direct reading." : "- No summary boundary was found.",
    "",
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

main();
