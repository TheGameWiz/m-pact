#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  appendMember,
  listMembers,
  readMember,
} = require("./lib/zip-record-store");
const { withRecordMetadata } = require("./lib/container-state");
const { validateProjectWrite } = require("./lib/project-identity");
const {
  activeItemReceipt,
  enforceActiveItemHandoff,
  newNonNumericActiveTags,
  newestTaskLogMember,
  parseActiveItems,
} = require("./lib/active-items");
const {
  activeNumericItems,
  listDesignSpecMembers,
  validateClearedResolvedVersions,
  versionValidationContext,
} = require("./lib/design-spec");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  agentTokenValidator,
  DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  localTimestamp,
  memberName,
  resolveAgentToken,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { withTaskOperationLock } = require("./lib/task-state");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "from-stdin",
  "task",
  "task-path",
  "agent",
  "title",
  "slug-hint",
  "no-spec-update-needed-because",
  "director-intent",
  "source-input",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];
const FLAG_VALUE_VALIDATORS = {
  agent: agentTokenValidator,
};

function designSpecFormat(taskPath) {
  return listDesignSpecMembers(path.join(taskPath, "specification.zip")).format;
}

function validateVersionDeclarations({ body, taskPath, logMembers }) {
  const specState = listDesignSpecMembers(path.join(taskPath, "specification.zip"));
  if (specState.format !== "new") {
    return;
  }
  const parsed = activeNumericItems(body);
  const { currentVersions, existingVersions } = versionValidationContext({
    specMembers: specState.members,
    logZipPath: path.join(taskPath, "log.zip"),
    logMembers,
  });
  validateClearedResolvedVersions({ currentActive: parsed, currentVersions, existingVersions });
}

function assertNoRevisionDeclarations(body) {
  const parsed = parseActiveItems(body, { strict: false });
  if (!parsed) {
    return;
  }
  const revisionItems = parsed.items
    .filter((item) => item.declaration && item.declaration.keyword === "REVISION")
    .map((item) => item.tag);
  if (revisionItems.length > 0) {
    throw new Error(`REVISION declarations can only be applied by write-design-spec, because task-log-only writes do not write item members; use write-design-spec to revise item(s): ${revisionItems.join(", ")}`);
  }
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const agent = resolveAgentToken(args);
  const title = args.title || args["slug-hint"] || "task-log-entry";
  const noSpecUpdateReason = args["no-spec-update-needed-because"];
  return withTaskOperationLock(taskPath, () => {
    const zipPath = path.join(taskPath, "log.zip");
    const zipOptions = { requireExistingParent: true };
    const logMembers = listMembers(zipPath, zipOptions).map((member) => withRecordMetadata(member, { recordsExpected: true }));
    const latest = newestTaskLogMember(logMembers);
    const latestBody = latest ? readMember(zipPath, latest.name, zipOptions).toString("utf8") : "";
    const activeSummary = enforceActiveItemHandoff({
      body: input.body,
      latestRecord: latest ? latest.record : null,
      latestBody,
    });
    const recordBody = activeSummary && activeSummary.body ? activeSummary.body : input.body;
    assertNoRevisionDeclarations(recordBody);
    if (designSpecFormat(taskPath) === "new") {
      const nonNumeric = newNonNumericActiveTags({ body: recordBody, latestBody });
      if (nonNumeric.length > 0) {
        throw new Error(`new-format design specification tasks require numeric active-item tags; new non-numeric tag(s): ${nonNumeric.join(", ")}`);
      }
      validateVersionDeclarations({ body: recordBody, taskPath, logMembers });
    }
    const now = new Date();
    const timestamp = localTimestamp(now);
    const appended = appendMember(zipPath, ({ record }) => {
      const member = memberName({
        number: record,
        source: agent,
        title,
        extension: ".md",
        includeSource: true,
      });
      const content = buildTaskLogMarkdown({
        record,
        timestamp,
        input: {
          agent,
          title,
          body: recordBody,
          directorIntent: args["director-intent"],
          sourceInput: args["source-input"],
          noSpecUpdateNeededBecause: noSpecUpdateReason,
        },
      });
      return { member, content };
    }, now, zipOptions);

    return {
      ok: true,
      operation: "write-task-log",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      taskPath,
      zipPath,
      record: appended.record,
      member: appended.member,
      timestamp: timestamp.body,
      activeItems: activeItemReceipt(activeSummary),
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "input", "task", "task-path", "agent", "title", "slug-hint", "no-spec-update-needed-because", "director-intent", "source-input"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: FLAG_VALUE_VALIDATORS,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  stdinFlags: ["from-stdin"],
});
