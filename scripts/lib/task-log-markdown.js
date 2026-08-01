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
  const agent = input.agent || "agent";
  const title = input.title || input.slugHint || "Task Log Entry";
  const body = stripDuplicateGeneratedHeading(input.body || input.contribution || "", `## Agent Response: ${agent}`);
  if (!body.trim()) {
    throw new Error("body is required");
  }

  const lines = [
    "---",
    `record: ${String(record).padStart(4, "0")}`,
    `timestamp: ${timestamp.body}`,
    `agents: ${yamlList([agent])}`,
    `director_intent: ${yamlScalar(input.directorIntent || input.director_intent || "(none)")}`,
  ];

  if (input.sourceInput || input.source_input) {
    lines.push(`source_input: ${yamlScalar(input.sourceInput || input.source_input)}`);
  }

  if (input.specMember || input.spec_member) {
    lines.push(`spec_member: ${yamlScalar(input.specMember || input.spec_member)}`);
  }
  if (input.noSpecUpdateNeededBecause || input.no_spec_update_needed_because) {
    lines.push(`no_spec_update_needed_because: ${yamlScalar(input.noSpecUpdateNeededBecause || input.no_spec_update_needed_because)}`);
  }
  lines.push("---", "", `# ${title}`, "", `## Agent Response: ${agent}`, "", body.trim(), "");

  return lines.join("\n");
}

module.exports = {
  buildTaskLogMarkdown,
};
