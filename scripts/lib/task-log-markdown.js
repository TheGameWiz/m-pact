#!/usr/bin/env node
"use strict";

const {
  yamlBlockList,
  yamlList,
  yamlScalar,
} = require("./helper-common");

function buildTaskLogMarkdown({ input, record, timestamp }) {
  const agent = input.agent || "agent";
  const title = input.title || input.slugHint || "Task Log Entry";
  const body = input.body || input.contribution || "";
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

  lines.push(...yamlBlockList("files_involved", input.filesInvolved || input.files_involved || []));
  lines.push(...yamlBlockList("decisions", input.decisions || []));
  lines.push(...yamlBlockList("tool_evidence", input.toolEvidence || input.tool_evidence || []));
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
