#!/usr/bin/env node
"use strict";

const KNOWN_RETIRED_TASK_FIELDS = [
  // This list only ever grows. Entries are never pruned because legacy task.md
  // files normalize lazily, so unrevised files may carry retired fields forever.
  "Status",
  "Owner",
  "Roles",
];
const KNOWN_FIELDS = new Set(["Timestamp", "Source", "Priority"]);
const KNOWN_RETIRED_SET = new Set(KNOWN_RETIRED_TASK_FIELDS);

function normalizeEol(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function dominantLineEnding(text) {
  const crlf = (String(text).match(/\r\n/g) || []).length;
  const lf = (String(text).match(/(?<!\r)\n/g) || []).length;
  return crlf > lf ? "\r\n" : "\n";
}

function parseSection(lines, startIndex) {
  const heading = lines[startIndex];
  const bodyStart = startIndex + 1;
  let next = lines.length;
  for (let i = bodyStart; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      next = i;
      break;
    }
  }
  let bodyEnd = next;
  if (bodyEnd > bodyStart && lines[bodyEnd - 1] === "") {
    bodyEnd -= 1;
  }
  return {
    heading,
    body: lines.slice(bodyStart, bodyEnd).join("\n"),
    next,
  };
}

function parseTaskMarkdown(text) {
  const normalized = normalizeEol(text).replace(/\n?$/, "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  if (lines[0] !== "# Task Entry" || lines[1] !== "") {
    throw new Error("task.md has an unrecognized header");
  }
  const metadata = {};
  const removedRetiredFields = [];
  let index = 2;
  for (; index < lines.length; index++) {
    const line = lines[index];
    if (line === "") {
      index += 1;
      break;
    }
    const match = /^([A-Za-z][A-Za-z0-9_-]*): (.*)$/.exec(line);
    if (!match) {
      throw new Error(`task.md has an unrecognized metadata line: ${line}`);
    }
    const key = match[1];
    if (KNOWN_RETIRED_SET.has(key)) {
      removedRetiredFields.push(key);
      continue;
    }
    if (!KNOWN_FIELDS.has(key)) {
      throw new Error(`task.md has an unknown field: ${key}`);
    }
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      throw new Error(`task.md has duplicate field: ${key}`);
    }
    metadata[key] = match[2];
  }
  if (lines[index] !== "## Task") {
    throw new Error("task.md is missing ## Task");
  }
  const task = parseSection(lines, index);
  const titleMatch = /^- (.*)$/.exec(task.body);
  if (!titleMatch || task.body.includes("\n")) {
    throw new Error("task.md task section must contain exactly one bullet title");
  }
  index = task.next;
  const sections = {};
  while (index < lines.length) {
    const section = parseSection(lines, index);
    if (section.heading === "## Context") {
      sections.context = section.body;
    } else if (section.heading === "## Acceptance") {
      sections.acceptance = section.body;
    } else {
      throw new Error(`task.md has unknown section: ${section.heading}`);
    }
    index = section.next;
  }
  return {
    model: {
      timestamp: metadata.Timestamp,
      source: metadata.Source,
      priority: metadata.Priority,
      title: titleMatch[1],
      context: sections.context || "",
      acceptance: sections.acceptance || "",
    },
    normalized: {
      removedRetiredFields,
    },
  };
}

function buildTaskMarkdown(model, lineEnding = "\n") {
  const lines = [
    "# Task Entry",
    "",
    `Timestamp: ${model.timestamp}`,
    `Source: ${model.source}`,
    `Priority: ${model.priority}`,
    "",
    "## Task",
    `- ${String(model.title || "").trim()}`,
  ];
  if (model.context !== undefined && String(model.context).length > 0) {
    lines.push("", "## Context", String(model.context));
  }
  if (model.acceptance !== undefined && String(model.acceptance).length > 0) {
    lines.push("", "## Acceptance", String(model.acceptance));
  }
  lines.push("");
  return lines.join(lineEnding);
}

function normalizeForRoundTrip(text) {
  return normalizeEol(text).replace(/\n?$/, "\n");
}

function normalizeRetiredTaskFieldsForComparison(text) {
  const lines = normalizeForRoundTrip(text).split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  const next = [];
  let inMetadata = false;
  let metadataDone = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 || i === 1) {
      next.push(line);
      inMetadata = i === 1 && line === "";
      continue;
    }
    if (inMetadata && !metadataDone) {
      if (line === "") {
        next.push(line);
        metadataDone = true;
        continue;
      }
      const match = /^([A-Za-z][A-Za-z0-9_-]*): (.*)$/.exec(line);
      if (match && KNOWN_RETIRED_SET.has(match[1])) {
        continue;
      }
      next.push(line);
      continue;
    }
    next.push(line);
  }
  next.push("");
  return next.join("\n");
}

function summarizeNormalization(normalized) {
  const parts = [];
  if (normalized.removedRetiredFields.length > 0) {
    parts.push(`removed retired fields ${normalized.removedRetiredFields.join(", ")}`);
  }
  return parts.join("; ");
}

module.exports = {
  KNOWN_RETIRED_TASK_FIELDS,
  buildTaskMarkdown,
  dominantLineEnding,
  normalizeForRoundTrip,
  normalizeRetiredTaskFieldsForComparison,
  parseTaskMarkdown,
  summarizeNormalization,
};
