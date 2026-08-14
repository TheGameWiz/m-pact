#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  withRecordMetadata,
} = require("./container-state");
const { newestTaskLogMember, parseActiveItems } = require("./active-items");
const {
  itemMembers,
  listDesignSpecMembers,
  parseDesignSpecMemberName,
  readItemDetails,
} = require("./design-spec");
const {
  listMembers,
  readMember,
} = require("./zip-record-store");

function orphanedSpecificationMembers(taskPath, { specMembers = null, logMembers = null } = {}) {
  const specZipPath = path.join(taskPath, "specification.zip");
  const specs = specMembers || listMembers(specZipPath).map((member) => withRecordMetadata(member, { recordsExpected: true }));
  if (specs.length === 0) {
    return [];
  }
  const classified = specs.map((member) => ({
    ...member,
    design: parseDesignSpecMemberName(member.name),
  }));
  const hasNew = classified.some((member) => member.design);
  const hasLegacy = classified.some((member) => !member.design);
  if (hasNew && !hasLegacy) {
    const logs = logMembers || listMembers(path.join(taskPath, "log.zip")).map((member) => withRecordMetadata(member, { recordsExpected: true }));
    const logRecords = new Set(logs.map((member) => member.record).filter((record) => record !== null));
    return classified
      .filter((member) => !logRecords.has(member.design.logRecord))
      .sort((a, b) => a.design.logRecord - b.design.logRecord || a.name.localeCompare(b.name));
  }
  return [];
}

function formatOrphanedSpecMembers(orphaned) {
  if (!orphaned || orphaned.length === 0) {
    return "(none)";
  }
  return orphaned.map((member) => member.name).join(", ");
}

function activeItemLinesForRepair(latestLogRecord, latestLogBody) {
  const active = parseActiveItems(latestLogBody, { strict: false });
  if (!active) {
    return [];
  }
  return active.raw.split(/\r?\n/).slice(1).filter((line) => line.trim());
}

function buildRepairLogBody({ taskPath, orphanedMember, specMembers, latestLogMember }) {
  const logZipPath = path.join(taskPath, "log.zip");
  const specZipPath = path.join(taskPath, "specification.zip");
  const latestLogBody = latestLogMember
    ? readMember(logZipPath, latestLogMember.name).toString("utf8")
    : "";
  const designMember = parseDesignSpecMemberName(orphanedMember.name);
  if (!designMember) {
    throw new Error("legacy-format specification companion repair is no longer written");
  }
  const specState = listDesignSpecMembers(specZipPath);
  const missingRecord = designMember.logRecord;
  const previousLines = activeItemLinesForRepair(latestLogMember ? latestLogMember.record : null, latestLogBody);
  const additions = itemMembers(specState.members)
    .filter((member) => member.logRecord === missingRecord)
    .map((member) => readItemDetails(specZipPath, member))
    .map((member) => `- [${String(member.itemNumber).padStart(4, "0")}-${member.design.slug}] ${member.body}`);
  const activeLines = [
    `## Active Items${latestLogMember ? ` (derives from ${String(latestLogMember.record).padStart(4, "0")})` : ""}`,
    ...(previousLines.length > 0 || additions.length > 0
      ? [...previousLines.filter((line) => line !== "- (none)"), ...additions]
      : ["- (none)"]),
  ];
  const lines = [
    "Repair record for a missing paired design specification log.",
    "",
    `Missing paired log record: ${String(missingRecord).padStart(4, "0")}`,
    `Orphaned design specification member: ${orphanedMember.name}`,
    `Design specification member timestamp: ${orphanedMember.modified}`,
    `Design specification member size: ${orphanedMember.size}`,
    "",
    "This record is helper-composed from existing artifacts. It reconstructs only the open item set: the previous open set plus item members carrying the missing log record number.",
    "",
    "Repair never synthesizes a cleared section. If the lost record cleared work, this repair over-reports open work until a human-authored follow-up log clears it.",
    "",
    activeLines.join("\n"),
  ];
  return lines.join("\n");
}

function firstOrphanedSpecMember(taskPath) {
  const specZipPath = path.join(taskPath, "specification.zip");
  const logZipPath = path.join(taskPath, "log.zip");
  const specMembers = listMembers(specZipPath).map((member) => withRecordMetadata(member, { recordsExpected: true }));
  const logMembers = listMembers(logZipPath).map((member) => withRecordMetadata(member, { recordsExpected: true }));
  const orphaned = orphanedSpecificationMembers(taskPath, { specMembers, logMembers });
  if (orphaned.length === 0) {
    return {
      specMembers,
      logMembers,
      orphaned: [],
      orphanedMember: null,
      latestLogMember: newestTaskLogMember(logMembers),
    };
  }
  return {
    specMembers,
    logMembers,
    orphaned,
    orphanedMember: orphaned[0],
    latestLogMember: newestTaskLogMember(logMembers),
  };
}

module.exports = {
  buildRepairLogBody,
  firstOrphanedSpecMember,
  formatOrphanedSpecMembers,
  orphanedSpecificationMembers,
};
