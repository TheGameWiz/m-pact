#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  assertMpactAllowedInCurrentSession,
  parseArgs,
} = require("./lib/helper-common");
const {
  defaultUserRoot,
  repairProjectIdentity,
} = require("./lib/project-identity");

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function activeProjectRoot(startPath = process.cwd()) {
  let cursor = path.resolve(startPath);
  if (!fs.existsSync(cursor) || !fs.statSync(cursor).isDirectory()) {
    cursor = path.dirname(cursor);
  }
  while (true) {
    const candidate = path.join(cursor, ".AgentMemory");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return fs.realpathSync(candidate);
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return null;
    }
    cursor = parent;
  }
}

function main() {
  assertMpactAllowedInCurrentSession();
  const args = parseArgs(process.argv.slice(2));
  const userRoot = path.resolve(args["user-root"] || args.userRoot || defaultUserRoot());
  const rootArg = args.root || args.project;
  const rootPath = rootArg
    ? (path.basename(path.resolve(rootArg)) === ".AgentMemory" ? path.resolve(rootArg) : path.join(path.resolve(rootArg), ".AgentMemory"))
    : activeProjectRoot();
  if (!rootPath) {
    throw new Error("no active .AgentMemory root found from current working directory");
  }
  const repaired = repairProjectIdentity(rootPath, userRoot);
  process.stdout.write("OK: repair-project-identity\n");
  process.stdout.write(`rootPath: ${repaired.rootPath}\n`);
  process.stdout.write(`projectId: ${repaired.projectId}\n`);
  if (repaired.oldSentinel) {
    process.stdout.write(`oldPath: ${repaired.oldSentinel}\n`);
  }
  process.stdout.write(`sentinel: ${repaired.sentinel}\n`);
  process.stdout.write(`status: ${repaired.repaired ? "repaired" : "already-valid"}\n`);
}

try {
  main();
} catch (error) {
  fail(error.message);
}
