#!/usr/bin/env node
"use strict";

const {
  assertKnownFlags,
  assertStringFlagValues,
  parseArgs,
} = require("./lib/helper-common");
const { uninstallMpactRuntime } = require("./lib/install-runtime");
const { failError } = require("./lib/setup-cli");

const ACCEPTED_FLAGS = [
  "home",
  "provider",
  "providers",
  "user-root",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

function printReceipt(results) {
  process.stdout.write("OK: uninstall-mpact\n");
  for (const line of results) {
    process.stdout.write(`- ${line}\n`);
  }
  process.stdout.write("Memory: .AgentMemoryRoot and project .AgentMemory folders were not touched.\n");
}

function main() {
  const argv = process.argv.slice(2);
  assertKnownFlags(argv, ACCEPTED_FLAGS);
  const args = parseArgs(argv);
  assertStringFlagValues(args, ["home", "provider", "providers", "user-root"]);
  const { results } = uninstallMpactRuntime({ args });
  printReceipt(results);
}

try {
  main();
} catch (error) {
  failError(error);
}
