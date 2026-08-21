#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { validateProjectWrite } = require("./lib/project-identity");
const {
  appendGeneratedMembers,
  appendMember,
  listMembers,
  readMember,
} = require("./lib/zip-record-store");
const {
  withRecordMetadata,
} = require("./lib/container-state");
const {
  activeNumericItems,
  currentItemMembers,
  currentBlobMember,
  designSpecMemberName,
  itemContent,
  itemMembers,
  listDesignSpecMembers,
  readItemDetails,
  unabsorbedItemNumbers,
  validateClearedResolvedVersions,
  versionValidationContext,
} = require("./lib/design-spec");
const {
  activeItemReceipt,
  enforceActiveItemHandoff,
  newestTaskLogMember,
  parseActiveItems,
  stripActiveItemRevisionDeclarations,
  tagIdentity,
} = require("./lib/active-items");
const { buildTaskLogMarkdown } = require("./lib/task-log-markdown");
const {
  agentTokenValidator,
  DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  localTimestamp,
  memberName,
  normalizeLineEndings,
  readInputFile,
  resolveAgentToken,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const { withTaskOperationLock } = require("./lib/task-state");
const { recordCurrentAgentSession } = require("./lib/agents-store");

const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "task",
  "task-path",
  "from-stdin",
  "content-file",
  "from-spec-file",
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
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [["from-stdin", "content-file", "from-spec-file"]];
const FLAG_VALUE_VALIDATORS = {
  agent: agentTokenValidator,
};

function sourceFlagCount(args) {
  return ["from-stdin", "content-file", "from-spec-file"].filter((flag) => Object.prototype.hasOwnProperty.call(args, flag)).length;
}

function readContent(input, args, taskPath) {
  if (sourceFlagCount(args) !== 1) {
    throw new Error("exactly one design specification narrative source is required: --from-stdin, --content-file, or --from-spec-file");
  }
  let content;
  if (args["content-file"]) {
    content = readInputFile(path.resolve(args["content-file"]));
  } else if (args["from-spec-file"]) {
    content = normalizeLineEndings(fs.readFileSync(path.join(taskPath, "specification.md"), "utf8"));
  } else {
    content = input.body;
  }
  if (typeof content !== "string") {
    throw new Error("design specification narrative is required");
  }
  return content.replace(/\s*$/, "\n");
}

function defaultLogBody(title) {
  return [
    `Recorded a design specification change for projection: ${title}.`,
    "",
    "The caller did not provide a detailed paired log body. Future design specification writes should include the reason for the update, the decisions or requirements that changed, evidence reviewed, risks or open questions, and the next useful handoff notes in this paired log rather than writing a separate task log entry. The helper receipt reports whether projection into specification.zip completed.",
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

function numberList(numbers) {
  return numbers.map((number) => String(number).padStart(4, "0")).join(", ");
}

function assertUniqueItemVersions(items) {
  const seen = new Set();
  for (const item of items) {
    const key = `${item.itemNumber}.${item.logRecord}`;
    if (seen.has(key)) {
      throw new Error(`design specification item version is duplicated: ${String(item.itemNumber).padStart(4, "0")}.${String(item.logRecord).padStart(4, "0")}`);
    }
    seen.add(key);
  }
}

function assertContiguousLogRecords(logMembers) {
  const records = logMembers.map((member) => member.record);
  const invalid = logMembers.filter((member) => !Number.isFinite(member.record));
  if (invalid.length > 0) {
    throw new Error(`cannot append paired design specification log with unnumbered log member(s): ${invalid.map((member) => member.name).join(", ")}`);
  }
  const seen = new Set();
  const duplicates = [];
  for (const record of records) {
    if (seen.has(record) && !duplicates.includes(record)) {
      duplicates.push(record);
    }
    seen.add(record);
  }
  if (duplicates.length > 0) {
    throw new Error(`cannot append paired design specification log while log record collision(s) exist: ${duplicates.map((record) => String(record).padStart(4, "0")).join(", ")}`);
  }
  const sorted = [...records].sort((a, b) => a - b);
  for (let index = 0; index < sorted.length; index++) {
    const expected = index + 1;
    if (sorted[index] !== expected) {
      throw new Error(`cannot append paired design specification log with non-contiguous log records; expected ${String(expected).padStart(4, "0")} but found ${String(sorted[index]).padStart(4, "0")}`);
    }
  }
}

function setDifference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort((a, b) => a - b);
}

function isRetryableProjectionError(error) {
  if (!error) {
    return false;
  }
  if (error.code && new Set([
    "EAGAIN",
    "EBUSY",
    "EACCES",
    "EMFILE",
    "ENFILE",
    "ENOENT",
    "ENOSPC",
    "EPERM",
    "ETIMEDOUT",
  ]).has(error.code)) {
    return true;
  }
  return /^ZIP lock is busy:/.test(error.message || "");
}

function projectionWarning({ phase, error }) {
  if (phase === "before-members") {
    return [
      "design specification projection failed after paired log append before specification members were written:",
      `${error.message};`,
      "rerun write-design-spec with the intended narrative and paired log body to project a new log record",
    ].join(" ");
  }
  if (phase === "after-members") {
    return [
      "design specification mirror write failed after specification members were written:",
      `${error.message};`,
      "do not rerun this design change as recovery because the specification members are already durable",
    ].join(" ");
  }
  return [
    "design specification mirror write failed after paired log append with no specification members written:",
    `${error.message};`,
    "do not rerun solely to repair the editable mirror",
  ].join(" ");
}

function nonNumericActiveTags(body) {
  const parsed = parseActiveItems(body, { strict: false });
  if (!parsed) {
    return [];
  }
  return parsed.items
    .map((item) => item.tag)
    .filter((tag) => !tagIdentity(tag).numeric);
}

function dependencyDeclarations(currentActive) {
  const declarations = new Map();
  const parsedDependencies = currentActive.parsed ? currentActive.parsed.dependencies : [];
  for (const item of parsedDependencies) {
    const identity = tagIdentity(item.tag);
    if (!identity.numeric) {
      throw new Error(`Dependencies item must use a numeric tag: ${item.tag}`);
    }
    if (item.dependsOn.includes(identity.number)) {
      throw new Error(`Dependencies item ${String(identity.number).padStart(4, "0")} cannot depend on itself`);
    }
    declarations.set(identity.number, item.dependsOn);
  }
  return declarations;
}

function validateDependencyDeclarations({ declarations, numbersToWrite }) {
  for (const number of declarations.keys()) {
    if (!numbersToWrite.has(number)) {
      throw new Error(`Dependencies item ${String(number).padStart(4, "0")} is not being written; declare REVISION for existing items before changing dependencies`);
    }
  }
}

function main({ args, input }) {
  const taskPath = resolveTaskPath(input, args, { allowedStates: ["A"] });
  const rootPath = path.dirname(path.dirname(taskPath));
  const identity = validateProjectWrite({ rootPath, input, args });
  const narrative = readContent(input, args, taskPath);
  const title = args.title || args["slug-hint"] || "design-specification";
  const agent = resolveAgentToken(args);
  const logTitle = args["log-title"] || "Design Specification Update";
  const logBody = readLogBody(args, title);

  return withTaskOperationLock(taskPath, () => {
    const logZipPath = path.join(taskPath, "log.zip");
    const zipOptions = { requireExistingParent: true };
    const logMembers = listMembers(logZipPath, zipOptions).map((member) => withRecordMetadata(member, { recordsExpected: true }));
    const latest = newestTaskLogMember(logMembers);
    const latestBody = latest ? readMember(logZipPath, latest.name, zipOptions).toString("utf8") : "";
    const activeSummary = enforceActiveItemHandoff({
      body: logBody.body,
      latestRecord: latest ? latest.record : null,
      latestBody,
      requireVersionDeclarations: true,
    });
    const recordLogBody = activeSummary && activeSummary.body ? activeSummary.body : logBody.body;
    const nonNumericTags = nonNumericActiveTags(recordLogBody);
    if (nonNumericTags.length > 0) {
      throw new Error(`design specification write requires numeric active-item tags; non-numeric active tag(s): ${nonNumericTags.join(", ")}`);
    }
    assertContiguousLogRecords(logMembers);
    const specZipPath = path.join(taskPath, "specification.zip");
    const specState = listDesignSpecMembers(specZipPath);
    if (specState.format === "legacy") {
      throw new Error("legacy-format specification containers are readable but permanently unwritable; create a new task to use write-design-spec");
    }
    if (specState.format === "mixed") {
      throw new Error("mixed legacy/new-format specification container is ambiguous and cannot be written");
    }

    const allItemMembers = itemMembers(specState.members);
    const existingItems = allItemMembers.map((member) => readItemDetails(specZipPath, member));
    assertUniqueItemVersions(existingItems);
    const currentItems = currentItemMembers(specState.members).map((member) => readItemDetails(specZipPath, member));
    const knownNumbers = new Set(currentItems.map((item) => item.itemNumber));
    const currentDetailsByNumber = new Map(currentItems.map((item) => [item.itemNumber, item]));
    const currentActive = activeNumericItems(recordLogBody);
    const { currentVersions, existingVersions, historyItems } = versionValidationContext({
      specMembers: specState.members,
      logZipPath,
      logMembers,
    });
    validateClearedResolvedVersions({
      currentActive,
      currentVersions,
      existingVersions,
      allowActiveRevision: true,
      allowDependencies: true,
      checkActiveClearedConflict: true,
    });
    const itemDetailsByNumber = new Map(historyItems.map((item) => [item.number, item]));
    const statusByNumber = new Map(historyItems.map((item) => [item.number, item.lastState]));
    for (const item of currentActive.active) {
      itemDetailsByNumber.set(item.number, item);
      statusByNumber.set(item.number, "active");
    }
    for (const item of currentActive.cleared) {
      itemDetailsByNumber.set(item.number, item);
      statusByNumber.set(item.number, "cleared");
    }
    const currentByNumber = new Map([...currentActive.active, ...currentActive.cleared].map((item) => [item.number, item]));
    const unabsorbed = new Set([
      ...historyItems.map((item) => item.number),
      ...currentByNumber.keys(),
    ]);
    for (const known of knownNumbers) {
      unabsorbed.delete(known);
    }

    const activeNumbers = new Set(currentActive.active.map((item) => item.number));

    const liveNumbers = new Set();
    for (const item of existingItems) {
      if (statusByNumber.get(item.itemNumber) !== "cleared") {
        liveNumbers.add(item.itemNumber);
      }
    }
    for (const number of unabsorbed) {
      if (statusByNumber.get(number) !== "cleared") {
        liveNumbers.add(number);
      }
    }
    const missingOpen = setDifference(liveNumbers, activeNumbers);
    const extraOpen = setDifference(activeNumbers, liveNumbers);
    if (missingOpen.length > 0 || extraOpen.length > 0) {
      const parts = [];
      if (missingOpen.length > 0) {
        parts.push(`missing open item number(s): ${numberList(missingOpen)}`);
      }
      if (extraOpen.length > 0) {
        parts.push(`extra open item number(s): ${numberList(extraOpen)}`);
      }
      throw new Error(`paired log open set does not equal computed live set; ${parts.join("; ")}`);
    }

    const batch = [];
    const blob = currentBlobMember(specState.members);
    const currentNarrative = blob ? readMember(specZipPath, blob.name, zipOptions).toString("utf8") : null;

    const itemMembersWritten = [];
    const revisedItemsByNumber = new Map(currentActive.active
      .filter((item) => item.revision)
      .map((item) => [item.number, item]));
    const revisedNumbers = [...revisedItemsByNumber.keys()];
    const numbersToWrite = new Set([...unabsorbed, ...revisedNumbers]);
    const declaredDependencies = dependencyDeclarations(currentActive);
    validateDependencyDeclarations({ declarations: declaredDependencies, numbersToWrite });
    const storedRecordLogBody = stripActiveItemRevisionDeclarations(recordLogBody);

    const now = new Date();
    const timestamp = localTimestamp(now);
    const logAppend = appendMember(logZipPath, ({ record }) => {
      const member = memberName({
        number: record,
        source: agent,
        title: logTitle,
        extension: ".md",
        includeSource: true,
      });
      const content = buildTaskLogMarkdown({
        record,
        timestamp,
        input: {
          agent,
          title: logTitle,
          body: storedRecordLogBody,
          directorIntent: args["director-intent"] || "Write design specification and paired task log.",
          sourceInput: args["source-input"],
        },
      });
      return { member, content };
    }, now, zipOptions);

    const logRecord = logAppend.record;
    let blobMember = null;
    if (currentNarrative !== narrative) {
      blobMember = designSpecMemberName({
        itemNumber: 0,
        logRecord,
        slug: title,
      });
      batch.push({
        member: blobMember,
        content: narrative,
      });
    }
    for (const number of [...numbersToWrite].sort((a, b) => a - b)) {
      const item = revisedItemsByNumber.get(number) || itemDetailsByNumber.get(number) || currentByNumber.get(number);
      const member = designSpecMemberName({
        itemNumber: number,
        logRecord,
        slug: item.slug,
      });
      batch.push({
        member,
        content: itemContent({
          itemNumber: number,
          logRecord,
          slug: item.slug,
          text: item.text,
          dependsOn: declaredDependencies.has(number)
            ? declaredDependencies.get(number)
            : currentDetailsByNumber.get(number)?.dependsOn || [],
        }),
      });
      itemMembersWritten.push(member);
    }

    let specAppend = null;
    let projectionStatus = "projected";
    let projectionError = null;
    let projectionFailurePhase = null;
    if (batch.length > 0) {
      try {
        specAppend = appendGeneratedMembers(specZipPath, batch, new Date(), zipOptions);
      } catch (error) {
        if (!isRetryableProjectionError(error)) {
          throw error;
        }
        projectionStatus = "projection-failed-before-members";
        projectionError = error;
        projectionFailurePhase = "before-members";
      }
    } else {
      projectionStatus = "no-spec-members-written";
    }
    if (!projectionError) {
      try {
        fs.writeFileSync(path.join(taskPath, "specification.md"), narrative, "utf8");
      } catch (error) {
        projectionStatus = specAppend
          ? "mirror-failed-after-members"
          : "mirror-failed-no-members";
        projectionError = error;
        projectionFailurePhase = specAppend ? "after-members" : "mirror-only";
      }
    }

    const finalState = projectionStatus === "projection-failed-before-members"
      ? specState
      : listDesignSpecMembers(specZipPath);
    const finalItems = currentItemMembers(finalState.members);
    const updatedLogMembers = [
      ...logMembers,
      withRecordMetadata({ name: logAppend.member }, { recordsExpected: true }),
    ];
    recordCurrentAgentSession(taskPath, agent);
    return {
      ok: projectionError ? false : true,
      exitCode: projectionError ? 1 : undefined,
      operation: "write-design-spec",
      projectId: identity.projectId,
      projectPath: identity.projectPath,
      crossProject: identity.crossProject || undefined,
      taskPath,
      record: logAppend.record,
      member: logAppend.member,
      logMember: logAppend.member,
      timestamp: timestamp.body,
      status: projectionStatus,
      designSpecFormat: finalState.format,
      currentBlob: currentBlobMember(finalState.members)?.name || "(none)",
      itemCount: finalItems.length,
      unabsorbedCount: unabsorbedItemNumbers(logZipPath, updatedLogMembers, new Set(finalItems.map((item) => item.itemNumber))).length,
      blobMember: projectionStatus === "projection-failed-before-members" ? "(projection failed before members)" : blobMember || "(unchanged)",
      itemsWritten: projectionStatus === "projection-failed-before-members" ? "(projection failed before members)" : itemMembersWritten.length === 0 ? "(none)" : itemMembersWritten.join(", "),
      projectionStatus,
      activeItems: activeItemReceipt(activeSummary),
      warning: projectionError
        ? projectionWarning({ phase: projectionFailurePhase, error: projectionError })
        : logBody.supplied ? undefined : "paired log body was not provided; include --log-body or --log-input with detailed context on the next design specification write",
      batchStrategy: specAppend ? specAppend.strategy : projectionStatus,
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "input", "task", "task-path", "content-file", "log-input", "log-body-file", "log-body", "title", "slug-hint", "agent", "log-title", "director-intent", "source-input"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: FLAG_VALUE_VALIDATORS,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
  stdinFlags: ["from-stdin"],
});
