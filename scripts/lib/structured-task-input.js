#!/usr/bin/env node
"use strict";

const RECOGNIZED_SECTIONS = new Set(["Context", "Acceptance", "Log"]);

function normalizeEol(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isFenceLine(line) {
  return /^```/.test(line);
}

function parseStructuredTaskInput(body) {
  const text = normalizeEol(body);
  if (!text.trim()) {
    return { sections: {}, present: new Set() };
  }

  const lines = text.split("\n");
  const headings = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isFenceLine(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !line.startsWith("## ")) {
      continue;
    }
    const name = line.slice(3).trim();
    if (!RECOGNIZED_SECTIONS.has(name)) {
      throw new Error(`unrecognized structured input section: ${line}`);
    }
    headings.push({ name, line: i });
    if (name === "Log") {
      // ## Log is terminal: everything after it is log body, so section
      // validation deliberately stops here.
      break;
    }
  }

  if (headings.length === 0) {
    throw new Error("structured input must use ## Context, ## Acceptance, or ## Log sections");
  }

  const sections = {};
  const present = new Set();
  for (let i = 0; i < headings.length; i++) {
    const { name, line } = headings[i];
    if (present.has(name)) {
      throw new Error(`duplicate structured input section: ## ${name}`);
    }
    present.add(name);
    const start = line + 1;
    const end = i + 1 < headings.length ? headings[i + 1].line : lines.length;
    let sectionLines = lines.slice(start, end);
    if (sectionLines.length > 0 && sectionLines.at(-1) === "") {
      sectionLines = sectionLines.slice(0, -1);
    }
    sections[name.toLowerCase()] = sectionLines.join("\n");
  }

  return { sections, present };
}

function mergeStructuredFields({ args, input, requireLog = false }) {
  const parsed = input && input.body ? parseStructuredTaskInput(input.body) : { sections: {}, present: new Set() };
  for (const field of ["context", "acceptance"]) {
    const sectionName = field[0].toUpperCase() + field.slice(1);
    if (Object.prototype.hasOwnProperty.call(args, field) && parsed.present.has(sectionName)) {
      throw new Error(`${field} was supplied through both --${field} and structured --input`);
    }
  }
  if (requireLog && !parsed.present.has("Log")) {
    throw new Error("revise-task requires a ## Log section in structured --input");
  }
  return {
    context: parsed.present.has("Context") ? parsed.sections.context : args.context,
    acceptance: parsed.present.has("Acceptance") ? parsed.sections.acceptance : args.acceptance,
    logBody: parsed.present.has("Log") ? parsed.sections.log : "",
    present: parsed.present,
  };
}

module.exports = {
  mergeStructuredFields,
  parseStructuredTaskInput,
};
