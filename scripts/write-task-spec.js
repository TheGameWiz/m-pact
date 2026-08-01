#!/usr/bin/env node
"use strict";

const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const { validateProjectWrite } = require("./lib/project-identity");
const {
  appendMember,
} = require("./lib/zip-record-store");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  localTimestamp,
  memberName,
  readInputFile,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "task",
  "task-path",
  "content-file",
  "log-input",
  "log-body-file",
  "log-body",
  "title",
  "slug-hint",
  "agent",
  "log-title",
  "director-intent",
  "source-input",
];

function readContent(input, args) {
  const contentFile = args["content-file"];
  const content = contentFile ? readInputFile(path.resolve(contentFile)) : input.body;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("specification content is required");
  }
  return content;
}

function defaultLogBody(title) {
  return [
    `Wrote a new task specification snapshot: ${title}.`,
    "",
    "The caller did not provide a detailed paired log body. Future specification writes should include the reason for the update, the decisions or requirements that changed, evidence reviewed, risks or open questions, and the next useful handoff notes in this paired log rather than writing a separate task log entry.",
  ].join("\n");
}

function readLogBody(args, title) {
  const logInput = args["log-input"];
  const logBodyFile = args["log-body-file"];
  const logBody = args["log-body"];
  const body = logInput || logBodyFile
    ? readInputFile(path.resolve(logInput || logBodyFile))
    : logBody;

  if (typeof body === "string" && body.trim()) {
    return {
      body,
      supplied: true,
    };
  }

  return {
    body: defaultLogBody(title),
    supplied: false,
  };
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const content = readContent(input, args);
  const title = args.title || args["slug-hint"] || "specification";
  const agent = args.agent || "agent";
  const logTitle = args["log-title"] || "Specification Update";
  const logBody = readLogBody(args, title);

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
          agent,
          title: logTitle,
          body: logBody.body,
          directorIntent: args["director-intent"] || "Write task specification snapshot and paired task log.",
          sourceInput: args["source-input"],
          specMember: specAppend.member,
        },
      });
      return { member, content: logContent };
    }, now);

    return {
      ok: true,
      operation: "write-task-spec",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      taskPath,
      record: specAppend.record,
      member: specAppend.member,
      specMember: specAppend.member,
      logMember: logAppend.member,
      timestamp: timestamp.body,
      warning: logBody.supplied ? undefined : "paired log body was not provided; include --log-body or --log-input with detailed context on the next specification write",
    };
  });
}

runCli(main, { acceptedFlags: ACCEPTED_FLAGS, stringFlags: ["root", "project-id", "user-root", "input", "task", "task-path", "content-file", "log-input", "log-body-file", "log-body", "title", "slug-hint", "agent", "log-title", "director-intent", "source-input"] });
