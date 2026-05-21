#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const {
  appendMember,
  listMembers,
} = require("./lib/zip-record-store");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  localTimestamp,
  memberName,
  nextRecordNumber,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");

function readContent(input, args) {
  const contentFile = input.contentFile || input.content_file || args["content-file"];
  const content = contentFile ? fs.readFileSync(path.resolve(contentFile), "utf8") : input.content || input.body;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("specification content is required");
  }
  return content;
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const content = readContent(input, args);
  const title = input.title || input.slugHint || args.title || args["slug-hint"] || "specification";
  const agent = input.agent || args.agent || "agent";
  const logTitle = input.logTitle || input.log_title || args["log-title"] || "Specification Update";
  const logBody = input.logBody || input.log_body || args["log-body"] || `Updated task specification snapshot: ${title}`;

  return withDirectoryLock(taskPath, () => {
    const now = new Date();
    const timestamp = localTimestamp(now);
    const specZipPath = path.join(taskPath, "specification.zip");
    const specRecord = nextRecordNumber(listMembers(specZipPath));
    const specMember = memberName({
      number: specRecord,
      title,
      extension: ".md",
      includeSource: false,
    });
    appendMember(specZipPath, specMember, content, now);

    const logZipPath = path.join(taskPath, "log.zip");
    const logRecord = nextRecordNumber(listMembers(logZipPath));
    const logMember = memberName({
      number: logRecord,
      source: agent,
      title: logTitle,
      extension: ".md",
      includeSource: true,
    });
    const logContent = buildTaskLogMarkdown({
      record: logRecord,
      timestamp,
      input: {
        ...input,
        agent,
        title: logTitle,
        body: logBody,
        directorIntent: input.directorIntent || input.director_intent || args["director-intent"] || "Update task specification and append paired task log.",
        sourceInput: input.sourceInput || input.source_input || args["source-input"],
        specMember,
      },
    });
    appendMember(logZipPath, logMember, logContent, now);

    return {
      ok: true,
      operation: "update-task-spec",
      taskPath,
      record: specRecord,
      member: specMember,
      specMember,
      logMember,
      timestamp: timestamp.body,
    };
  });
}

runCli(main);
