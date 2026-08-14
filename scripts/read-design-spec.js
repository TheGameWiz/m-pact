#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  latestMember,
  listContainerMembers,
  readSelectedMember,
  resolveContainer,
  withContainerOperationLock,
} = require("./lib/container-state");
const {
  currentBlobMember,
  currentItemMembers,
  formatItemHeading,
  listDesignSpecMembers,
  newestActiveNumericItems,
  readItemDetails,
} = require("./lib/design-spec");
const { runCli } = require("./lib/helper-common");

const ACCEPTED_FLAGS = [
  "root",
  "task",
  "task-path",
  "all",
  "items",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

function booleanFlag(args, name) {
  return Object.prototype.hasOwnProperty.call(args, name);
}

function itemNumberSet(value) {
  if (!value) {
    return null;
  }
  const numbers = [];
  for (const part of String(value).split(/[, ]+/).map((candidate) => candidate.trim()).filter(Boolean)) {
    const number = Number.parseInt(part, 10);
    if (!Number.isFinite(number) || number < 1 || String(number) !== part.replace(/^0+/, "") && !/^0+$/.test(part)) {
      throw new Error(`--items contains an invalid item number: ${part}`);
    }
    numbers.push(number);
  }
  return new Set(numbers);
}

function main({ args }) {
  const context = resolveContainer({}, { ...args, container: "specification" }, { allowedStates: ["A", "C"] });
  return withContainerOperationLock(context, () => {
    const specState = listDesignSpecMembers(context.zipPath);
    if (specState.format === "empty") {
      return {
        ok: true,
        operation: "read-design-spec",
        taskPath: context.taskPath,
        zipPath: context.zipPath,
        designSpecFormat: "empty",
        currentBlob: "(none)",
        itemCount: 0,
        itemsRead: 0,
        content: "",
      };
    }
    if (specState.format === "legacy") {
      const members = listContainerMembers(context);
      const latest = latestMember(members, context.container);
      return {
        ok: true,
        operation: "read-design-spec",
        taskPath: context.taskPath,
        zipPath: context.zipPath,
        designSpecFormat: "legacy",
        currentBlob: latest ? latest.name : "(none)",
        itemCount: "(legacy)",
        itemsRead: "(legacy)",
        warning: "legacy-format specification returned as its latest snapshot",
        content: latest ? readSelectedMember(context, latest) : "",
      };
    }
    if (specState.format === "mixed") {
      throw new Error("mixed legacy/new-format specification container is ambiguous and cannot be assembled");
    }

    const logContext = resolveContainer({}, { ...args, container: "task-log" }, { allowedStates: ["A", "C"] });
    const logMembers = listContainerMembers(logContext);
    const blob = currentBlobMember(specState.members);
    const allItems = currentItemMembers(specState.members).map((member) => readItemDetails(context.zipPath, member));
    const requestedItems = itemNumberSet(args.items);
    let selectedItems;
    if (requestedItems) {
      selectedItems = allItems.filter((item) => requestedItems.has(item.itemNumber));
      const found = new Set(selectedItems.map((item) => item.itemNumber));
      const missing = [...requestedItems].filter((number) => !found.has(number)).sort((a, b) => a - b);
      if (missing.length > 0) {
        throw new Error(`design specification item not found: ${missing.map((number) => String(number).padStart(4, "0")).join(", ")}`);
      }
    } else if (booleanFlag(args, "all")) {
      selectedItems = allItems;
    } else {
      const open = new Set(newestActiveNumericItems(path.join(context.taskPath, "log.zip"), logMembers).map((item) => item.number));
      selectedItems = logMembers.length === 0
        ? allItems
        : allItems.filter((item) => open.has(item.itemNumber));
    }
    const sections = [];
    if (blob) {
      sections.push(readSelectedMember(context, blob).replace(/\s*$/, ""));
    }
    for (const item of selectedItems) {
      sections.push([formatItemHeading(item), "", item.body].join("\n").replace(/\s*$/, ""));
    }
    return {
      ok: true,
      operation: "read-design-spec",
      taskPath: context.taskPath,
      zipPath: context.zipPath,
      designSpecFormat: "new",
      currentBlob: blob ? blob.name : "(none)",
      itemCount: allItems.length,
      itemsRead: selectedItems.length,
      content: sections.join("\n\n"),
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "task", "task-path", "items"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
});
