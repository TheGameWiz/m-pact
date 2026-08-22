#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  defaultUserRoot,
  repairProjectIdentity,
} = require("./lib/project-identity");
const { maintainProjectRegistry } = require("./lib/project-registry");
const { projectMemoryRootFromArgs, runSetupCli } = require("./lib/setup-cli");

const ACCEPTED_FLAGS = ["root", "project", "user-root"];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

function main(args) {
  const userRoot = path.resolve(args["user-root"] || defaultUserRoot());
  const rootPath = projectMemoryRootFromArgs(args);
  const repaired = repairProjectIdentity(rootPath, userRoot);
  maintainProjectRegistry(userRoot, repaired);
  process.stdout.write("OK: repair-project-identity\n");
  process.stdout.write(`rootPath: ${repaired.rootPath}\n`);
  process.stdout.write(`projectId: ${repaired.projectId}\n`);
  if (repaired.removed) {
    process.stdout.write(`removed: ${repaired.removed}\n`);
  }
  process.stdout.write(`sentinel: ${repaired.sentinel}\n`);
  process.stdout.write("registry: updated:projects.json\n");
  process.stdout.write(`status: ${repaired.repaired ? "repaired" : "already-valid"}\n`);
}

runSetupCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project", "user-root"],
});
