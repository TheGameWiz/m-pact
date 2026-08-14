#!/usr/bin/env node
"use strict";

const {
  yamlList,
  yamlScalar,
} = require("./helper-common");

function stripDuplicateGeneratedHeading(body, heading) {
  const text = String(body || "");
  const match = /^(?:[ \t]*(?:\r\n|\n|\r))*([^\r\n]*)(\r\n|\n|\r|$)/.exec(text);
  if (!match) {
    return text;
  }
  const firstLine = match[1].replace(/[ \t]+$/g, "");
  if (firstLine !== heading) {
    return text;
  }
  return text.slice(match[0].length).replace(/^(?:[ \t]*(?:\r\n|\n|\r))+/, "");
}

function buildTaskLogMarkdown({ input, record, timestamp }) {
  const agent = input.agent;
  if (!agent) {
    throw new Error("agent is required");
  }
  const title = input.title || "Task Log Entry";
  const body = stripDuplicateGeneratedHeading(input.body || "", `## Agent Response: ${agent}`);
  if (!body.trim()) {
    throw new Error("body is required");
  }

  const lines = [
    "---",
    `record: ${String(record).padStart(4, "0")}`,
    `timestamp: ${timestamp.body}`,
    `agents: ${yamlList([agent])}`,
    `director_intent: ${yamlScalar(input.directorIntent || "(none)")}`,
  ];

  if (input.sourceInput) {
    lines.push(`source_input: ${yamlScalar(input.sourceInput)}`);
  }

  if (input.noSpecUpdateNeededBecause) {
    lines.push(`no_spec_update_needed_because: ${yamlScalar(input.noSpecUpdateNeededBecause)}`);
  }
  lines.push("---", "", `# ${title}`, "", `## Agent Response: ${agent}`, "", body.trim(), "");

  return lines.join("\n");
}

module.exports = {
  buildTaskLogMarkdown,
};
