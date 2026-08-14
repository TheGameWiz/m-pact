#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  collisionGroups,
  latestMember,
  listContainerMembers,
  readSelectedMember,
  resolveContainer,
  withContainerOperationLock,
} = require("./lib/container-state");
const {
  agentTokenValidator,
  resolveAgentToken,
  resolveTaskPath,
  runCli,
} = require("./lib/helper-common");
const {
  agentTaskLogPosition,
  newestTaskLogMember,
  parseActiveItems,
} = require("./lib/active-items");
const {
  currentBlobMember,
  clearedUnresolvedItems,
  currentItemMembers,
  listDesignSpecMembers,
  newestActiveNumericItems,
  readItemDetails,
  unabsorbedItemNumbers,
} = require("./lib/design-spec");
const {
  formatOrphanedSpecMembers,
  orphanedSpecificationMembers,
} = require("./lib/orphaned-companions");

const ACCEPTED_FLAGS = ["root", "task", "task-path", "agent"];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];
const FLAG_VALUE_VALIDATORS = {
  agent: agentTokenValidator,
};

function taskSource(args) {
  if (args["task-path"]) {
    return "explicit --task-path flag";
  }
  if (args.task) {
    return "explicit --task flag";
  }
  return "current-task sentinel";
}

function taskState(taskPath) {
  const folder = path.basename(taskPath);
  if (folder.startsWith("A__")) {
    return "open";
  }
  if (folder.startsWith("C__")) {
    return "closed";
  }
  return "unknown";
}

function formatCollisionGroups(groups) {
  if (groups.length === 0) {
    return "(none)";
  }
  return groups
    .map(([record, group]) => `${record}: ${group.map((member) => member.name).join(", ")}`)
    .join("; ");
}

function newestActiveList(logContext, logMembers) {
  const newest = newestTaskLogMember(logMembers);
  if (!newest) {
    return {
      activeRecord: "(none)",
      activeTagged: "(none)",
      activeItemList: "(none)",
    };
  }
  const body = readSelectedMember(logContext, newest);
  const active = parseActiveItems(body, { strict: false });
  if (!active) {
    return {
      activeRecord: newest.record === null ? "(none)" : String(newest.record).padStart(4, "0"),
      activeTagged: "(none)",
      activeItemList: "(none)",
    };
  }
  const grandfathered = !active.tagged || active.untagged > 0;
  return {
    activeRecord: String(newest.record).padStart(4, "0"),
    activeTagged: grandfathered ? "grandfathered" : "tagged",
    activeItemList: active.raw,
  };
}

function formatClearedUnresolved(items) {
  if (!items || items.length === 0) {
    return "(none)";
  }
  return items
    .map((item) => `${String(item.number).padStart(4, "0")}@${String(item.version).padStart(4, "0")}`)
    .join(", ");
}

function recordsSinceBlob(specState, logMembers) {
  const blob = currentBlobMember(specState.members);
  if (!blob || !Number.isFinite(blob.logRecord)) {
    return "(none)";
  }
  return logMembers.filter((member) => Number.isFinite(member.record) && member.record > blob.logRecord).length;
}

function formatOpenDependencies(specZipPath, taskPath, designItems, logMembers) {
  const open = new Set(newestActiveNumericItems(path.join(taskPath, "log.zip"), logMembers).map((item) => item.number));
  const lines = [];
  for (const member of designItems) {
    const details = readItemDetails(specZipPath, member);
    const openDeps = (details.dependsOn || []).filter((number) => open.has(number));
    if (openDeps.length > 0) {
      lines.push(`${String(member.itemNumber).padStart(4, "0")} depends on open ${openDeps.map((number) => String(number).padStart(4, "0")).join(",")}`);
    }
  }
  return lines.length > 0 ? lines.join("; ") : "(none)";
}

function hasClearedDesignItem(logZipPath, logMembers) {
  for (const member of logMembers) {
    let body = "";
    try {
      body = readSelectedMember({ zipPath: logZipPath }, member);
    } catch {
      continue;
    }
    const parsed = parseActiveItems(body, { strict: false });
    if (parsed && parsed.cleared.length > 0) {
      return true;
    }
  }
  return false;
}

function implementationReviewState(specState, designItems, logContext, logMembers) {
  if (specState.format !== "new") {
    return undefined;
  }
  if (designItems.length === 0) {
    return undefined;
  }
  return hasClearedDesignItem(logContext.zipPath, logMembers)
    ? undefined
    : "unavailable; no implementation has been reported";
}

function designSpecNotice(specState) {
  return specState.format === "empty" ? "no design specification is present" : undefined;
}

function main({ args }) {
  const taskPath = resolveTaskPath({}, args, { allowedStates: ["A", "C"] });
  const specContext = resolveContainer({}, { "task-path": taskPath, container: "specification" });
  const logContext = resolveContainer({}, { "task-path": taskPath, container: "task-log" });
  const agent = resolveAgentToken(args);

  return withContainerOperationLock(logContext, () => {
    const specMembers = listContainerMembers(specContext);
    const logMembers = listContainerMembers(logContext);
    const specState = listDesignSpecMembers(specContext.zipPath);
    const latestSpec = specState.format === "new" ? null : latestMember(specMembers, specContext.container);
    const designItems = specState.format === "new" ? currentItemMembers(specState.members) : [];
    const unabsorbed = specState.format === "new"
      ? unabsorbedItemNumbers(logContext.zipPath, logMembers, new Set(designItems.map((member) => member.itemNumber)))
      : [];
    const unresolved = specState.format === "new"
      ? clearedUnresolvedItems(logContext.zipPath, logMembers)
      : [];
    const orphaned = orphanedSpecificationMembers(taskPath, { specMembers, logMembers });
    const position = agentTaskLogPosition(logMembers, agent);
    const newest = newestTaskLogMember(logMembers);
    const active = newestActiveList(logContext, logMembers);

    return {
      ok: true,
      operation: "prepare-handoff",
      task: path.basename(taskPath),
      taskPath,
      taskSource: taskSource(args),
      taskState: taskState(taskPath),
      readCursor: position.readCursor,
      unreadCount: position.unread.length,
      unreadByAuthor: position.unreadByAuthor,
      warning: position.unread.length === 0 && newest && newest.author === agent
        ? "newest task log record is authored by this agent; taking this handoff may mean reviewing your own last output"
        : undefined,
      specMember: latestSpec ? latestSpec.name : undefined,
      designSpecFormat: specState.format,
      designSpecNotice: designSpecNotice(specState),
      implementationReview: implementationReviewState(specState, designItems, logContext, logMembers),
      currentBlob: specState.format === "new" ? currentBlobMember(specState.members)?.name || "(none)" : undefined,
      itemCount: specState.format === "new" ? designItems.length : undefined,
      unabsorbedCount: specState.format === "new" ? unabsorbed.length : undefined,
      clearedUnresolved: specState.format === "new" ? formatClearedUnresolved(unresolved) : undefined,
      recordsSinceBlob: specState.format === "new" ? recordsSinceBlob(specState, logMembers) : undefined,
      openDependencies: specState.format === "new" ? formatOpenDependencies(specContext.zipPath, taskPath, designItems, logMembers) : undefined,
      orphanedSpecMembers: formatOrphanedSpecMembers(orphaned),
      collisionGroups: formatCollisionGroups(collisionGroups(logMembers)),
      activeRecord: active.activeRecord,
      activeTagged: active.activeTagged,
      memberCount: logMembers.length,
      members: logMembers,
      activeItemList: active.activeItemList,
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "task", "task-path", "agent"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  flagValueValidators: FLAG_VALUE_VALIDATORS,
});
