#!/usr/bin/env node
"use strict";

const {
  listContainerMembers,
  readSelectedMember,
  resolveContainer,
  selectMember,
  withContainerOperationLock,
} = require("./lib/container-state");
const {
  currentItemMembers,
  itemMembers,
  listDesignSpecMembers,
} = require("./lib/design-spec");
const { DEFAULT_UNSUPPORTED_OPERATION_FLAGS, runCli } = require("./lib/helper-common");

const ACCEPTED_FLAGS = [
  "root",
  "task",
  "task-path",
  "container",
  "member",
  "name",
  "record",
  "latest",
  "item",
];
const REQUIRED_FLAGS = ["container"];
const REQUIRED_ONE_OF = [["member", "name", "record", "latest", "item"]];

function selectDesignSpecItem(members, itemNumber) {
  const number = Number.parseInt(String(itemNumber), 10);
  if (!Number.isFinite(number) || number < 1) {
    throw new Error("--item must be a positive item number");
  }
  const matches = currentItemMembers(members).filter((member) => member.itemNumber === number);
  if (matches.length === 0) {
    throw new Error(`design specification item not found: ${String(number).padStart(4, "0")}`);
  }
  if (matches.length > 1) {
    throw new Error(`design specification item ${String(number).padStart(4, "0")} is ambiguous: ${matches.map((member) => member.name).join(", ")}`);
  }
  return matches[0];
}

function main({ args }) {
  const context = resolveContainer({}, args, { allowedStates: ["A", "C"] });
  return withContainerOperationLock(context, () => {
    if (context.container.name === "specification") {
      const specState = listDesignSpecMembers(context.zipPath);
      if (specState.format === "new") {
        if (args.latest) {
          throw new Error("latest-member read is not meaningful for a new-format design specification; use --item <number> or read-design-spec");
        }
        const selected = args.item
          ? selectDesignSpecItem(specState.members, args.item)
          : selectMember(specState.members, context.container, args);
        return {
          ok: true,
          operation: "read-member",
          rootPath: context.rootPath,
          taskPath: context.taskPath,
          zipPath: context.zipPath,
          record: selected.record,
          member: selected.name,
          designSpecFormat: specState.format,
          content: readSelectedMember(context, selected),
        };
      }
      if (args.item) {
        throw new Error("--item is only valid for new-format design specification containers");
      }
    }
    const members = listContainerMembers(context);
    const selected = selectMember(members, context.container, args);
    return {
      ok: true,
      operation: "read-member",
      rootPath: context.rootPath,
      taskPath: context.taskPath,
      zipPath: context.zipPath,
      record: selected.record,
      member: selected.name,
      content: readSelectedMember(context, selected),
    };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "task", "task-path", "container", "member", "name", "record", "item"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  unsupportedFlags: DEFAULT_UNSUPPORTED_OPERATION_FLAGS,
});
