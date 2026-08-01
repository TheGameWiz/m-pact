#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  assertKnownFlags,
  assertMpactAllowedInCurrentSession,
  assertStringFlagValues,
  booleanArg,
  parseArgs,
} = require("./lib/helper-common");
const { installMpactRuntime } = require("./lib/install-runtime");
const { defaultUserRoot, initializeProjectIdentity } = require("./lib/project-identity");

const ACCEPTED_FLAGS = [
  "project",
  "user-root",
  "init-user-root",
  "skip-starter-rules",
  "home",
  "provider",
  "providers",
];

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exitCode = 1;
}

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

function main() {
  assertMpactAllowedInCurrentSession();
  const argv = process.argv.slice(2);
  assertKnownFlags(argv, ACCEPTED_FLAGS);
  const args = parseArgs(argv);
  assertStringFlagValues(args, ["project", "user-root", "home", "provider", "providers"]);
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
  ensureDir(path.join(projectRoot, ".AgentMemory"));
  results.push("created-or-present:.AgentMemory");
  const identity = initializeProjectIdentity(path.join(projectRoot, ".AgentMemory"), userRoot);
  results.push(`${identity.adopted ? "created" : "preserved"}:project:${identity.projectId}:${identity.sentinel}`);
  results.push("project-shims:not-supported");
  printReceipt("bootstrap-project", path.join(projectRoot, ".AgentMemory"), results);
}

try {
  main();
} catch (error) {
  fail(error.message);
  process.exit(error.exitCode || process.exitCode || 1);
}
