#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  assertMpactAllowedInCurrentSession,
  booleanArg,
  parseArgs,
} = require("./lib/helper-common");
const { installMpactRuntime } = require("./lib/install-runtime");
const { initializeProjectIdentity } = require("./lib/project-identity");

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
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
  const args = parseArgs(process.argv.slice(2));
  const skillRoot = path.dirname(__dirname);
  const userRootMode = booleanArg(args, "user-root");
  const skipStarterRules = booleanArg(args, "skip-starter-rules");

  if (userRootMode) {
    const userRoot = path.resolve(args.root || args.project || path.join(os.homedir(), ".AgentMemoryRoot"));
    const runtimeArgs = { ...args, "user-root": userRoot };
    if (skipStarterRules) {
      runtimeArgs["skip-starter-rules"] = true;
    }
    const { results } = installMpactRuntime({ args: runtimeArgs, skillRoot, userRoot });
    printReceipt("bootstrap-user-root", userRoot, results);
    return;
  }

  const projectRoot = path.resolve(args.project || process.cwd());
  const userRoot = path.resolve(args.root || path.join(os.homedir(), ".AgentMemoryRoot"));
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
}
