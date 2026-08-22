#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  booleanArg,
} = require("./lib/helper-common");
const { installMpactRuntime } = require("./lib/install-runtime");
const {
  defaultUserRoot,
  initializeProjectIdentity,
  validateProjectMemorySetupLocation,
} = require("./lib/project-identity");
const { maintainProjectRegistry } = require("./lib/project-registry");
const { ensureScratchDirectory } = require("./lib/scratch");
const { runSetupCli } = require("./lib/setup-cli");

const ACCEPTED_FLAGS = [
  "project",
  "user-root",
  "init-user-root",
  "skip-starter-rules",
  "home",
  "provider",
  "providers",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function printReceipt(operation, rootPath, results) {
  process.stdout.write(`OK: ${operation}\n`);
  process.stdout.write(`rootPath: ${rootPath}\n`);
  for (const result of results) {
    process.stdout.write(`- ${result}\n`);
  }
}

function main(args) {
  const skillRoot = path.dirname(__dirname);
  const userRootMode = booleanArg(args, "init-user-root");
  const skipStarterRules = booleanArg(args, "skip-starter-rules");

  if (userRootMode) {
    const userRoot = path.resolve(args["user-root"] || defaultUserRoot());
    const runtimeArgs = { ...args, "user-root": userRoot };
    if (skipStarterRules) {
      runtimeArgs["skip-starter-rules"] = true;
    }
    const { results } = installMpactRuntime({ args: runtimeArgs, skillRoot, userRoot });
    printReceipt("bootstrap-user-root", userRoot, results);
    return;
  }

  const projectRoot = path.resolve(args.project || process.cwd());
  const userRoot = path.resolve(args["user-root"] || defaultUserRoot());
  const results = [];
  if (!fs.existsSync(userRoot)) {
    results.push("runtime-setup:required:user-root-missing");
    const { results: setupResults } = installMpactRuntime({ args, skillRoot, userRoot });
    for (const line of setupResults) {
      results.push(`runtime-setup:${line}`);
    }
  } else {
    results.push(`runtime-setup:skipped:user-root-present:${userRoot}`);
  }
  validateProjectMemorySetupLocation({ projectPath: projectRoot, userRoot, home: args.home });
  const projectMemory = path.join(projectRoot, ".AgentMemory");
  ensureDir(projectMemory);
  results.push("created-or-present:.AgentMemory");
  ensureScratchDirectory(projectMemory);
  results.push("created-or-present:.AgentMemory/.tmp");
  const identity = initializeProjectIdentity(projectMemory, userRoot);
  maintainProjectRegistry(userRoot, identity);
  results.push(`${identity.adopted ? "created" : "preserved"}:project:${identity.projectId}:${identity.sentinel}`);
  results.push("updated:projects.json");
  results.push("project-shims:not-supported");
  printReceipt("bootstrap-project", path.join(projectRoot, ".AgentMemory"), results);
}

runSetupCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["project", "user-root", "home", "provider", "providers"],
});
