#!/usr/bin/env node
"use strict";

const path = require("path");
const { newestTaskLogMember, parseActiveItems, tagIdentity } = require("./active-items");
const { latestMember, withRecordMetadata } = require("./container-state");
const { MEMBER_NAME_MAX, sanitizeSlug, yamlScalar } = require("./helper-common");
const { listMembers, readMember } = require("./zip-record-store");

const NEW_MEMBER = /^(\d{4})\.(\d{4})-([a-z0-9][a-z0-9-]*)\.md$/;
const BLOB_NUMBER = 0;

function pad4(value) {
  return String(value).padStart(4, "0");
}

function parseDesignSpecMemberName(name) {
  const match = NEW_MEMBER.exec(String(name || ""));
  if (!match) {
    return null;
  }
  const itemNumber = Number.parseInt(match[1], 10);
  const logRecord = Number.parseInt(match[2], 10);
  return {
    itemNumber,
    logRecord,
    slug: match[3],
    kind: itemNumber === BLOB_NUMBER ? "blob" : "item",
  };
}

function designSpecMemberName({ itemNumber, logRecord, slug }) {
  const cleanSlug = sanitizeSlug(slug) || (itemNumber === BLOB_NUMBER ? "narrative" : "item");
  const member = `${pad4(itemNumber)}.${pad4(logRecord)}-${cleanSlug}.md`;
  if (Buffer.byteLength(member, "utf8") > MEMBER_NAME_MAX) {
    throw new Error(`design specification member name exceeds ${MEMBER_NAME_MAX} bytes: ${member}`);
  }
  return member;
}

function classifyDesignSpecMembers(members) {
  const enriched = members.map((member) => {
    const design = parseDesignSpecMemberName(member.name);
    return {
      ...withRecordMetadata(member, { recordsExpected: true }),
      design,
      record: design ? design.logRecord : withRecordMetadata(member, { recordsExpected: true }).record,
      itemNumber: design ? design.itemNumber : undefined,
      logRecord: design ? design.logRecord : undefined,
      kind: design ? design.kind : undefined,
    };
  });
  const hasNew = enriched.some((member) => member.design);
  const hasLegacy = enriched.some((member) => !member.design);
  const format = hasNew && hasLegacy
    ? "mixed"
    : hasNew
      ? "new"
      : hasLegacy
        ? "legacy"
        : "empty";
  return { format, members: enriched };
}

function listDesignSpecMembers(specZipPath) {
  return classifyDesignSpecMembers(listMembers(specZipPath));
}

function currentBlobMember(members) {
  const blobs = members.filter((member) => member.kind === "blob");
  return latestMember(blobs, { defaultSort: "record-asc" });
}

function itemMembers(members) {
  return members
    .filter((member) => member.kind === "item")
    .sort((a, b) => a.itemNumber - b.itemNumber || a.logRecord - b.logRecord || a.name.localeCompare(b.name));
}

function currentItemMembers(members) {
  const byNumber = new Map();
  for (const member of itemMembers(members)) {
    const previous = byNumber.get(member.itemNumber);
    if (!previous || member.logRecord > previous.logRecord || member.logRecord === previous.logRecord && member.name.localeCompare(previous.name) > 0) {
      byNumber.set(member.itemNumber, member);
    }
  }
  return [...byNumber.values()].sort((a, b) => a.itemNumber - b.itemNumber || a.name.localeCompare(b.name));
}

function currentItemVersionMap(members) {
  return new Map(currentItemMembers(members).map((member) => [member.itemNumber, member.logRecord]));
}

function formatKnownVersions(versions) {
  return [...versions].sort((a, b) => a - b).map((version) => pad4(version)).join(", ");
}

function addItemVersion(versionMap, itemNumber, version) {
  if (!Number.isFinite(itemNumber) || itemNumber <= 0 || !Number.isFinite(version) || version <= 0) {
    return;
  }
  const versions = versionMap.get(itemNumber) || new Set();
  versions.add(version);
  versionMap.set(itemNumber, versions);
}

function itemVersionRecordMap(members, logZipPath, logMembers) {
  const versions = new Map();
  for (const member of itemMembers(members || [])) {
    addItemVersion(versions, member.itemNumber, member.logRecord);
  }
  for (const member of logMembers || []) {
    const record = Number.isFinite(member.record) ? member.record : -1;
    if (record <= 0) {
      continue;
    }
    let body = "";
    try {
      body = readMember(logZipPath, member.name).toString("utf8");
    } catch {
      continue;
    }
    const parsed = parseActiveItems(body, { strict: false });
    if (!parsed) {
      continue;
    }
    for (const item of parsed.items.map(parseActiveLine)) {
      if (item.number !== null) {
        addItemVersion(versions, item.number, record);
      }
    }
  }
  return versions;
}

function versionValidationContext({ specMembers, logZipPath, logMembers }) {
  const currentVersions = currentItemVersionMap(specMembers);
  const existingVersions = itemVersionRecordMap(specMembers, logZipPath, logMembers);
  const historyItems = logItemHistory(logZipPath, logMembers);
  for (const item of historyItems) {
    if (!currentVersions.has(item.number) && Number.isFinite(item.lastTextRecord)) {
      currentVersions.set(item.number, item.lastTextRecord);
    }
  }
  return {
    currentVersions,
    existingVersions,
    historyItems,
  };
}

function validateClearedResolvedVersions({
  currentActive,
  currentVersions,
  existingVersions,
  allowActiveRevision = false,
  allowDependencies = false,
  checkActiveClearedConflict = false,
}) {
  const activeNumbers = new Set(currentActive.active.map((item) => item.number));
  if (allowActiveRevision) {
    for (const item of currentActive.active) {
      if (item.revision && !currentVersions.has(item.number)) {
        throw new Error(`Active Items declares REVISION for item without an existing version: ${pad4(item.number)}`);
      }
    }
  }
  for (const item of currentActive.cleared) {
    if (!Number.isFinite(item.version)) {
      throw new Error(`Cleared item ${pad4(item.number)} must declare VERSION NNNN`);
    }
    const currentVersion = currentVersions.get(item.number);
    if (!Number.isFinite(currentVersion)) {
      throw new Error(`Cleared item ${pad4(item.number)} has no design specification version`);
    }
    if (item.version !== currentVersion) {
      throw new Error(`Cleared item ${pad4(item.number)} names stale version ${pad4(item.version)}; current version is ${pad4(currentVersion)}`);
    }
    if (checkActiveClearedConflict && activeNumbers.has(item.number)) {
      throw new Error(`item cannot be both active and cleared in one record: ${pad4(item.number)}`);
    }
  }
  for (const item of currentActive.resolved) {
    if (!Number.isFinite(item.version)) {
      throw new Error(`Resolved item ${pad4(item.number)} must declare VERSION NNNN`);
    }
    const knownVersions = existingVersions.get(item.number);
    if (!knownVersions || knownVersions.size === 0) {
      throw new Error(`Resolved item ${pad4(item.number)} has no design specification version`);
    }
    if (!knownVersions.has(item.version)) {
      throw new Error(`Resolved item ${pad4(item.number)} names unknown version ${pad4(item.version)}; known version(s): ${formatKnownVersions(knownVersions)}`);
    }
  }
  if (!allowDependencies && currentActive.dependencies.length > 0) {
    throw new Error("Dependencies section can only be applied by write-design-spec, because task-log-only writes do not write item frontmatter");
  }
}

function parseFrontmatter(body) {
  const text = String(body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text.startsWith("---\n")) {
    return { data: {}, body: text };
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    return { data: {}, body: text };
  }
  const data = {};
  for (const line of text.slice(4, end).split("\n")) {
    const split = /^([A-Za-z0-9_-]+):(?:\s*)(.*)$/.exec(line);
    if (!split) {
      continue;
    }
    data[split[1]] = split[2].trim().replace(/^"|"$/g, "");
  }
  return {
    data,
    body: text.slice(end + "\n---".length).replace(/^\n/, ""),
  };
}

function parseDependsOn(value) {
  const text = String(value || "").trim();
  if (!text || text === "[]") {
    return [];
  }
  const source = text.startsWith("[") && text.endsWith("]")
    ? text.slice(1, -1)
    : text;
  return source
    .split(/[, ]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10))
    .filter((number) => Number.isFinite(number) && number > 0);
}

function readItemDetails(specZipPath, member) {
  const content = readMember(specZipPath, member.name).toString("utf8");
  const parsed = parseFrontmatter(content);
  return {
    ...member,
    frontmatter: parsed.data,
    dependsOn: parseDependsOn(parsed.data.depends_on),
    body: parsed.body.trim(),
  };
}

function itemContent({ itemNumber, logRecord, slug, text, dependsOn = [] }) {
  const lines = [
    "---",
    `item: ${pad4(itemNumber)}`,
    `source_log_record: ${pad4(logRecord)}`,
    `slug: ${yamlScalar(sanitizeSlug(slug) || "item")}`,
    `depends_on: ${Array.isArray(dependsOn) && dependsOn.length > 0 ? `[${dependsOn.map((number) => pad4(number)).join(", ")}]` : "[]"}`,
  ];
  lines.push("---", "", String(text || "").trim(), "");
  return lines.join("\n");
}

function parseActiveLine(item) {
  const match = /^- \[([^\]]+)\]\s*(.*)$/.exec(item.line);
  const identity = tagIdentity(item.tag);
  const text = item.bodyText !== undefined ? item.bodyText : match ? match[2].trim() : item.line.replace(/^- /, "").trim();
  return {
    tag: item.tag,
    identity,
    number: identity.numeric ? identity.number : null,
    slug: identity.numeric ? identity.slug : item.tag,
    text,
    revision: item.declaration ? item.declaration.keyword === "REVISION" : false,
    declaration: item.declaration || null,
    version: item.version || null,
    note: item.note || "",
    line: item.line,
  };
}

function parseDependencyLine(item) {
  const identity = tagIdentity(item.tag);
  return {
    tag: item.tag,
    identity,
    number: identity.numeric ? identity.number : null,
    slug: identity.numeric ? identity.slug : item.tag,
    dependsOn: item.dependsOn || [],
    line: item.line,
  };
}

function activeNumericItems(logBody) {
  const active = parseActiveItems(logBody, { strict: true });
  if (!active) {
    return {
      parsed: null,
      active: [],
      cleared: [],
      resolved: [],
      dependencies: [],
    };
  }
  return {
    parsed: active,
    active: active.items.map(parseActiveLine).filter((item) => item.number !== null),
    cleared: active.cleared.map(parseActiveLine).filter((item) => item.number !== null),
    resolved: active.resolved.map(parseActiveLine).filter((item) => item.number !== null),
    dependencies: active.dependencies.map(parseDependencyLine).filter((item) => item.number !== null),
  };
}

function newestActiveNumericItems(logZipPath, logMembers) {
  const newest = newestTaskLogMember(logMembers);
  if (!newest) {
    return [];
  }
  const body = readMember(logZipPath, newest.name).toString("utf8");
  const parsed = parseActiveItems(body, { strict: false });
  if (!parsed) {
    return [];
  }
  return parsed.items.map(parseActiveLine).filter((item) => item.number !== null);
}

function unabsorbedItemNumbers(logZipPath, logMembers, itemNumbers) {
  const known = new Set(itemNumbers);
  return logItemHistory(logZipPath, logMembers)
    .filter((item) => !known.has(item.number))
    .map((item) => item.number);
}

function clearedUnresolvedItems(logZipPath, logMembers) {
  const cleared = new Map();
  const resolved = new Set();
  for (const member of logMembers) {
    const record = Number.isFinite(member.record) ? member.record : -1;
    let body = "";
    try {
      body = readMember(logZipPath, member.name).toString("utf8");
    } catch {
      continue;
    }
    const parsed = parseActiveItems(body, { strict: false });
    if (!parsed) {
      continue;
    }
    for (const item of parsed.cleared.map(parseActiveLine)) {
      if (item.number === null || !Number.isFinite(item.version)) {
        continue;
      }
      const previousClear = cleared.get(item.number);
      if (!previousClear || record >= previousClear.clearRecord) {
        cleared.set(item.number, {
          ...item,
          clearRecord: record,
        });
      }
    }
    for (const item of parsed.resolved.map(parseActiveLine)) {
      if (item.number === null || !Number.isFinite(item.version)) {
        continue;
      }
      resolved.add(`${item.number}.${item.version}`);
    }
  }
  const activeNumbers = new Set(newestActiveNumericItems(logZipPath, logMembers).map((item) => item.number));
  return [...cleared.values()]
    .filter((item) => !activeNumbers.has(item.number))
    .filter((item) => !resolved.has(`${item.number}.${item.version}`))
    .sort((a, b) => a.number - b.number || a.version - b.version);
}

function logItemHistory(logZipPath, logMembers) {
  const byNumber = new Map();
  for (const member of logMembers) {
    const record = Number.isFinite(member.record) ? member.record : -1;
    let body = "";
    try {
      body = readMember(logZipPath, member.name).toString("utf8");
    } catch {
      continue;
    }
    const parsed = parseActiveItems(body, { strict: false });
    if (!parsed) {
      continue;
    }
    for (const item of parsed.items.map(parseActiveLine)) {
      if (item.number === null) {
        continue;
      }
      const previous = byNumber.get(item.number) || {};
      const next = { ...previous };
      if (!Number.isFinite(next.lastTextRecord) || record >= next.lastTextRecord) {
        Object.assign(next, item, {
          lastTextRecord: record,
        });
      }
      if (!Number.isFinite(next.lastStateRecord) || record > next.lastStateRecord) {
        next.lastState = "active";
        next.lastStateRecord = record;
      }
      next.lastRecord = Math.max(next.lastRecord || -1, record);
      byNumber.set(item.number, next);
    }
    for (const item of parsed.cleared.map(parseActiveLine)) {
      if (item.number === null) {
        continue;
      }
      const previous = byNumber.get(item.number) || {};
      const next = { ...previous };
      if (!Number.isFinite(next.lastTextRecord)) {
        Object.assign(next, item, {
          lastTextRecord: record,
        });
      }
      if (!Number.isFinite(next.lastStateRecord) || record >= next.lastStateRecord) {
        next.lastState = "cleared";
        next.lastStateRecord = record;
      }
      next.lastRecord = Math.max(next.lastRecord || -1, record);
      byNumber.set(item.number, next);
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

function formatItemHeading(item) {
  return `### [${pad4(item.itemNumber)}-${item.design.slug}]`;
}

module.exports = {
  activeNumericItems,
  clearedUnresolvedItems,
  currentBlobMember,
  currentItemMembers,
  currentItemVersionMap,
  designSpecMemberName,
  formatItemHeading,
  itemContent,
  itemMembers,
  itemVersionRecordMap,
  listDesignSpecMembers,
  newestActiveNumericItems,
  pad4,
  parseDesignSpecMemberName,
  parseFrontmatter,
  readItemDetails,
  logItemHistory,
  unabsorbedItemNumbers,
  validateClearedResolvedVersions,
  versionValidationContext,
};
