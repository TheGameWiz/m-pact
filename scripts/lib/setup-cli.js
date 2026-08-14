"use strict";

const path = require("path");
const {
  assertKnownFlags,
  assertMpactAllowedInCurrentSession,
  assertStringFlagValues,
  parseArgs,
} = require("./helper-common");
const { findActiveRoot } = require("./task-state");

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exitCode = 1;
}

function failError(error) {
  if (error && error.mpactNotice) {
    process.stdout.write(`${error.mpactNotice}\n`);
    process.exit(error.exitCode || 1);
  }
  fail(error.message);
  process.exit(error.exitCode || process.exitCode || 1);
}

function projectMemoryRootFromArgs(args) {
  const rootArg = args.root || args.project;
  if (rootArg) {
    const resolved = path.resolve(rootArg);
    return path.basename(resolved) === ".AgentMemory"
      ? resolved
      : path.join(resolved, ".AgentMemory");
  }
  const rootPath = findActiveRoot(process.cwd());
  if (!rootPath) {
    throw new Error("no active .AgentMemory root found from current working directory");
  }
  return rootPath;
}

function runSetupCli(main, options = {}) {
  try {
    assertMpactAllowedInCurrentSession();
    const argv = process.argv.slice(2);
    assertKnownFlags(argv, options.acceptedFlags || []);
    const args = parseArgs(argv);
    assertStringFlagValues(args, options.stringFlags || []);
    main(args);
  } catch (error) {
    failError(error);
  }
}

module.exports = {
  failError,
  projectMemoryRootFromArgs,
  runSetupCli,
};
