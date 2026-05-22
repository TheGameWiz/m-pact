#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const {
  appendMember,
} = require("./lib/zip-record-store");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  localTimestamp,
  memberName,
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
    const specAppend = appendMember(specZipPath, ({ record }) => ({
      member: memberName({
        number: record,
        title,
        extension: ".md",
        includeSource: false,
      }),
      content,
    }), now);

    const logZipPath = path.join(taskPath, "log.zip");
    const logAppend = appendMember(logZipPath, ({ record }) => {
      const member = memberName({
        number: record,
        source: agent,
        title: logTitle,
        extension: ".md",
        includeSource: true,
      });
      const logContent = buildTaskLogMarkdown({
        record,
        timestamp,
        input: {
          ...input,
          agent,
          title: logTitle,
          body: logBody,
          directorIntent: input.directorIntent || input.director_intent || args["director-intent"] || "Update task specification and append paired task log.",
          sourceInput: input.sourceInput || input.source_input || args["source-input"],
          specMember: specAppend.member,
        },
      });
      return { member, content: logContent };
    }, now);

    return {
      ok: true,
      operation: "update-task-spec",
      taskPath,
      record: specAppend.record,
      member: specAppend.member,
      specMember: specAppend.member,
      logMember: logAppend.member,
      timestamp: timestamp.body,
    };
  });
}

runCli(main);
