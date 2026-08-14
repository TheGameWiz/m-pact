#!/usr/bin/env node
"use strict";

const ACTIVE_HEADER = /^## Active Items(?: \(derives from (\d{4})\))?$/;
const CLEARED_HEADER = /^## Cleared$/;
const RESOLVED_HEADER = /^## Resolved$/;
const DEPENDENCIES_HEADER = /^## Dependencies$/;
const NEXT_SECTION = /^## /;
const TAGGED_ITEM = /^- \[([a-z0-9][a-z0-9._-]*)\] .+/;
const TAGGED_DEPENDENCY = /^- \[([a-z0-9][a-z0-9._-]*)\](?:\s+(.*))?$/;
const BULLET = /^- /;
const DECLARATION_TOKEN = /^([A-Z][A-Z0-9_]*)(?:\s+([A-Za-z0-9_, -]+))?:\s*(.*)$/;

function normalizeEol(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function lineStartsFence(line) {
  return /^```/.test(line);
}

function sectionEnd(lines, start) {
  let fenced = false;
  for (let index = start; index < lines.length; index++) {
    if (lineStartsFence(lines[index])) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && NEXT_SECTION.test(lines[index])) {
      return index;
    }
  }
  return lines.length;
}

function findSections(text) {
  const source = normalizeEol(text).replace(/\n?$/, "");
  const lines = source.length > 0 ? source.split("\n") : [];
  let fenced = false;
  const sections = {
    lines,
    active: null,
    cleared: null,
    resolved: null,
    dependencies: null,
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (lineStartsFence(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      continue;
    }
    const active = ACTIVE_HEADER.exec(line);
    if (active && sections.active === null) {
      const end = sectionEnd(lines, index + 1);
      sections.active = {
        start: index,
        end,
        derivesFrom: active[1] ? Number.parseInt(active[1], 10) : null,
        raw: lines.slice(index, end).join("\n"),
      };
      index = end - 1;
      continue;
    }
    if (CLEARED_HEADER.test(line) && sections.cleared === null) {
      const end = sectionEnd(lines, index + 1);
      sections.cleared = {
        start: index,
        end,
        raw: lines.slice(index, end).join("\n"),
      };
      index = end - 1;
      continue;
    }
    if (RESOLVED_HEADER.test(line) && sections.resolved === null) {
      const end = sectionEnd(lines, index + 1);
      sections.resolved = {
        start: index,
        end,
        raw: lines.slice(index, end).join("\n"),
      };
      index = end - 1;
      continue;
    }
    if (DEPENDENCIES_HEADER.test(line) && sections.dependencies === null) {
      const end = sectionEnd(lines, index + 1);
      sections.dependencies = {
        start: index,
        end,
        raw: lines.slice(index, end).join("\n"),
      };
      index = end - 1;
    }
  }
  return sections;
}

function parseDeclarationToken(text) {
  const match = DECLARATION_TOKEN.exec(String(text || "").trim());
  if (!match) {
    return null;
  }
  return {
    keyword: match[1],
    argument: (match[2] || "").trim() || null,
    text: (match[3] || "").trim(),
  };
}

function parseVersionArgument(value, sectionName, line) {
  const text = String(value || "").trim();
  if (!/^\d{4}$/.test(text)) {
    throw new Error(`${sectionName} item VERSION token requires a four-digit item version: ${line}`);
  }
  return Number.parseInt(text, 10);
}

function parseItems(lines, { strict, sectionName, requireVersionDeclarations = false }) {
  const items = [];
  let explicitNone = false;
  let untagged = 0;
  for (const line of lines) {
    if (line === "" || /^[ \t]/.test(line)) {
      continue;
    }
    if (line === "- (none)") {
      explicitNone = true;
      continue;
    }
    const item = TAGGED_ITEM.exec(line);
    if (item) {
      const text = line.replace(/^- \[[^\]]+\]\s*/, "").trim();
      const declaration = parseDeclarationToken(text);
      if (strict && sectionName === "Active Items" && declaration && declaration.keyword !== "REVISION") {
        throw new Error(`Active Items declaration token is not supported: ${declaration.keyword}`);
      }
      if (strict && requireVersionDeclarations && (sectionName === "Cleared" || sectionName === "Resolved")) {
        if (!declaration || declaration.keyword !== "VERSION") {
          throw new Error(`${sectionName} item must declare VERSION NNNN: ${line}`);
        }
        parseVersionArgument(declaration.argument, sectionName, line);
      }
      items.push({
        tag: item[1],
        line,
        text,
        declaration,
        bodyText: declaration && declaration.keyword === "REVISION" ? declaration.text : text,
        version: declaration && declaration.keyword === "VERSION"
          ? parseVersionArgument(declaration.argument, sectionName, line)
          : null,
        note: declaration && declaration.keyword === "VERSION" ? declaration.text : text,
      });
      continue;
    }
    if (BULLET.test(line)) {
      untagged += 1;
      if (strict) {
        throw new Error(`${sectionName} item must use - [tag] text form: ${line}`);
      }
    }
  }
  if (strict && items.length === 0 && !explicitNone) {
    throw new Error(`${sectionName} must contain tagged items or - (none)`);
  }
  if (strict && explicitNone && items.length > 0) {
    throw new Error(`${sectionName} cannot combine - (none) with tagged items`);
  }
  return {
    items,
    explicitNone,
    untagged,
    tagged: untagged === 0,
  };
}

function parseDependencyNumbers(text, line, { strict = false } = {}) {
  const value = String(text || "").trim();
  if (!value) {
    return [];
  }
  const parts = value.split(",");
  if (parts.some((part) => !/^\s*\d+\s*$/.test(part))) {
    if (!strict) {
      return [];
    }
    throw new Error(`Dependencies item must declare comma-separated item numbers: ${line}`);
  }
  const numbers = parts.map((part) => Number.parseInt(part.trim(), 10));
  if (numbers.some((number) => !Number.isFinite(number) || number <= 0)) {
    if (!strict) {
      return [];
    }
    throw new Error(`Dependencies item must declare positive item numbers: ${line}`);
  }
  const duplicate = numbers.find((number, index) => numbers.indexOf(number) !== index);
  if (duplicate) {
    if (!strict) {
      return [];
    }
    throw new Error(`Dependencies item contains duplicate dependency: ${String(duplicate).padStart(4, "0")}`);
  }
  return numbers;
}

function parseDependencyItems(lines, { strict }) {
  const items = [];
  let explicitNone = false;
  let untagged = 0;
  for (const line of lines) {
    if (line === "" || /^[ \t]/.test(line)) {
      continue;
    }
    if (line === "- (none)") {
      explicitNone = true;
      continue;
    }
    const item = TAGGED_DEPENDENCY.exec(line);
    if (item) {
      if (strict && !tagIdentity(item[1]).numeric) {
        throw new Error(`Dependencies item must use a numeric tag: ${line}`);
      }
      items.push({
        tag: item[1],
        line,
        text: String(item[2] || "").trim(),
        dependsOn: parseDependencyNumbers(item[2], line, { strict }),
      });
      continue;
    }
    if (BULLET.test(line)) {
      untagged += 1;
      if (strict) {
        throw new Error(`Dependencies item must use - [tag] item-number, item-number form: ${line}`);
      }
    }
  }
  if (strict && explicitNone && items.length > 0) {
    throw new Error("Dependencies cannot combine - (none) with tagged items");
  }
  return {
    items,
    explicitNone,
    untagged,
    tagged: untagged === 0,
  };
}

function tagIdentity(tag) {
  const text = String(tag || "");
  const match = /^(\d+)(?:[-._](.*))?$/.exec(text);
  if (!match) {
    return {
      key: text,
      numeric: false,
      number: null,
      slug: text,
    };
  }
  const number = Number.parseInt(match[1], 10);
  return {
    key: `#${number}`,
    numeric: true,
    number,
    slug: match[2] || "item",
  };
}

function newestTaskLogMember(members) {
  return (members || [])
    .filter((member) => member)
    .sort((a, b) => {
      const ar = Number.isFinite(a.record) ? a.record : -1;
      const br = Number.isFinite(b.record) ? b.record : -1;
      return br - ar || String(b.name || "").localeCompare(String(a.name || ""));
    })[0] || null;
}

function newestAuthoredTaskLogMember(members, agent) {
  return (members || [])
    .filter((member) => member && member.author === agent)
    .sort((a, b) => {
      const ar = Number.isFinite(a.record) ? a.record : -1;
      const br = Number.isFinite(b.record) ? b.record : -1;
      return br - ar || String(b.name || "").localeCompare(String(a.name || ""));
    })[0] || null;
}

function recordNumber(member) {
  return member && Number.isFinite(member.record) ? member.record : 0;
}

function taskLogReadCursorForAgent(members, agent) {
  return recordNumber(newestAuthoredTaskLogMember(members, agent));
}

function unreadTaskLogMembers(members, cursor) {
  return (members || [])
    .filter((member) => member && recordNumber(member) > cursor);
}

function unreadByAuthor(members, cursor) {
  const counts = new Map();
  for (const member of unreadTaskLogMembers(members, cursor)) {
    const author = member.author || "(none)";
    counts.set(author, (counts.get(author) || 0) + 1);
  }
  if (counts.size === 0) {
    return "(none)";
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([author, count]) => `${author}=${count}`)
    .join(", ");
}

function agentTaskLogPosition(members, agent) {
  const readCursor = taskLogReadCursorForAgent(members, agent);
  return {
    readCursor,
    unread: unreadTaskLogMembers(members, readCursor),
    unreadByAuthor: unreadByAuthor(members, readCursor),
  };
}

function parseActiveItems(text, { strict = false, requireVersionDeclarations = false } = {}) {
  const sections = findSections(text);
  if (!sections.active) {
    return null;
  }
  const activeLines = sections.lines.slice(sections.active.start + 1, sections.active.end);
  const clearedLines = sections.cleared
    ? sections.lines.slice(sections.cleared.start + 1, sections.cleared.end)
    : [];
  const resolvedLines = sections.resolved
    ? sections.lines.slice(sections.resolved.start + 1, sections.resolved.end)
    : [];
  const dependencyLines = sections.dependencies
    ? sections.lines.slice(sections.dependencies.start + 1, sections.dependencies.end)
    : [];
  const active = parseItems(activeLines, { strict, sectionName: "Active Items", requireVersionDeclarations });
  const cleared = parseItems(clearedLines, { strict: false, sectionName: "Cleared", requireVersionDeclarations });
  const resolved = parseItems(resolvedLines, { strict: false, sectionName: "Resolved", requireVersionDeclarations });
  const dependencies = parseDependencyItems(dependencyLines, { strict: false });
  if (strict && sections.cleared) {
    parseItems(clearedLines, { strict: true, sectionName: "Cleared", requireVersionDeclarations });
  }
  if (strict && sections.resolved) {
    parseItems(resolvedLines, { strict: true, sectionName: "Resolved", requireVersionDeclarations });
  }
  if (strict && sections.dependencies) {
    parseDependencyItems(dependencyLines, { strict: true });
  }
  const tags = active.items.map((item) => tagIdentity(item.tag).key);
  const duplicate = tags.find((tag, index) => tags.indexOf(tag) !== index);
  if (duplicate) {
    throw new Error(`Active Items contains duplicate tag: ${duplicate}`);
  }
  const clearedTags = cleared.items.map((item) => tagIdentity(item.tag).key);
  const duplicateCleared = clearedTags.find((tag, index) => clearedTags.indexOf(tag) !== index);
  if (duplicateCleared) {
    throw new Error(`Cleared contains duplicate tag: ${duplicateCleared}`);
  }
  const resolvedTags = resolved.items.map((item) => `${tagIdentity(item.tag).key}@${item.version}`);
  const duplicateResolved = resolvedTags.find((tag, index) => resolvedTags.indexOf(tag) !== index);
  if (duplicateResolved) {
    throw new Error(`Resolved contains duplicate item version: ${duplicateResolved}`);
  }
  const dependencyTags = dependencies.items.map((item) => tagIdentity(item.tag).key);
  const duplicateDependency = dependencyTags.find((tag, index) => dependencyTags.indexOf(tag) !== index);
  if (duplicateDependency) {
    throw new Error(`Dependencies contains duplicate tag: ${duplicateDependency}`);
  }
  return {
    derivesFrom: sections.active.derivesFrom,
    raw: sections.active.raw,
    items: active.items,
    explicitNone: active.explicitNone,
    untagged: active.untagged,
    tagged: active.tagged,
    cleared: cleared.items,
    hasCleared: Boolean(sections.cleared),
    resolved: resolved.items,
    hasResolved: Boolean(sections.resolved),
    dependencies: dependencies.items,
    hasDependencies: Boolean(sections.dependencies),
  };
}

function replaceActiveItemsDerivesFrom(body, latestRecord) {
  const sections = findSections(body);
  if (!sections.active) {
    return body;
  }
  const heading = latestRecord
    ? `## Active Items (derives from ${String(latestRecord).padStart(4, "0")})`
    : "## Active Items";
  const lines = [...sections.lines];
  lines[sections.active.start] = heading;
  return `${lines.join("\n").replace(/\s*$/, "")}\n`;
}

function stripActiveItemRevisionDeclarations(body) {
  const sections = findSections(body);
  if (!sections.active) {
    return body;
  }
  const lines = [...sections.lines];
  for (let index = sections.active.start + 1; index < sections.active.end; index++) {
    const item = TAGGED_ITEM.exec(lines[index]);
    if (!item) {
      continue;
    }
    const text = lines[index].replace(/^- \[[^\]]+\]\s*/, "").trim();
    const declaration = parseDeclarationToken(text);
    if (!declaration || declaration.keyword !== "REVISION") {
      continue;
    }
    lines[index] = `- [${item[1]}] ${declaration.text}`;
  }
  return `${lines.join("\n").replace(/\s*$/, "")}\n`;
}

function enforceActiveItemHandoff({ body, latestRecord, latestBody, requireVersionDeclarations = false }) {
  const previous = latestBody ? parseActiveItems(latestBody, { strict: false }) : null;
  const resolvedBody = replaceActiveItemsDerivesFrom(body, latestRecord);
  const current = parseActiveItems(resolvedBody, { strict: true, requireVersionDeclarations });
  if (previous && !current) {
    throw new Error(`newest task log record ${String(latestRecord).padStart(4, "0")} carries an active-item section; the next task log entry must restate ## Active Items`);
  }
  if (!current) {
    return null;
  }
  if (!previous) {
    return {
      carried: current.items.length,
      cleared: current.cleared.length,
      resolved: current.resolved.length,
      grandfathered: false,
      body: resolvedBody,
    };
  }
  if (!previous.tagged || previous.items.length === 0 && previous.untagged > 0) {
    return {
      carried: current.items.length,
      cleared: current.cleared.length,
      resolved: current.resolved.length,
      grandfathered: true,
      body: resolvedBody,
    };
  }
  const previousTags = new Set(previous.items.map((item) => tagIdentity(item.tag).key));
  const activeTags = new Set(current.items.map((item) => tagIdentity(item.tag).key));
  const clearedTags = new Set(current.cleared.map((item) => tagIdentity(item.tag).key));
  const unaccounted = [...previousTags].filter((tag) => !activeTags.has(tag) && !clearedTags.has(tag));
  if (unaccounted.length > 0) {
    throw new Error(`Active Items omitted predecessor tag(s) without clearing them: ${unaccounted.join(", ")}`);
  }
  const notOpen = [...clearedTags].filter((tag) => !previousTags.has(tag));
  if (notOpen.length > 0) {
    throw new Error(`Cleared tag(s) were not active in predecessor: ${notOpen.join(", ")}`);
  }
  return {
    carried: current.items.length,
    cleared: current.cleared.length,
    resolved: current.resolved.length,
    grandfathered: false,
    body: resolvedBody,
  };
}

function newNonNumericActiveTags({ body, latestBody }) {
  const current = parseActiveItems(body, { strict: false });
  if (!current) {
    return [];
  }
  const previous = latestBody ? parseActiveItems(latestBody, { strict: false }) : null;
  const previousActive = new Set((previous ? previous.items : []).map((item) => tagIdentity(item.tag).key));
  return current.items
    .map((item) => ({
      tag: item.tag,
      identity: tagIdentity(item.tag),
    }))
    .filter((item) => !item.identity.numeric && !previousActive.has(item.identity.key))
    .map((item) => item.tag);
}

function activeItemReceipt(summary) {
  if (!summary) {
    return undefined;
  }
  const suffix = summary.grandfathered ? "; accounting=grandfathered" : "";
  const resolved = Number.isFinite(summary.resolved) ? `; resolved: ${summary.resolved}` : "";
  return `carried: ${summary.carried}; cleared: ${summary.cleared}${resolved}${suffix}`;
}

module.exports = {
  activeItemReceipt,
  agentTaskLogPosition,
  enforceActiveItemHandoff,
  newNonNumericActiveTags,
  newestAuthoredTaskLogMember,
  newestTaskLogMember,
  parseActiveItems,
  parseDeclarationToken,
  replaceActiveItemsDerivesFrom,
  stripActiveItemRevisionDeclarations,
  taskLogReadCursorForAgent,
  tagIdentity,
  unreadByAuthor,
  unreadTaskLogMembers,
};
