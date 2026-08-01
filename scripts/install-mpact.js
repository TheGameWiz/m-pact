#!/usr/bin/env node
"use strict";

const path = require("path");
const { assertKnownFlags, assertMpactAllowedInCurrentSession, assertStringFlagValues, booleanArg, parseArgs } = require("./lib/helper-common");
const { installMpactRuntime, removeMpactShims } = require("./lib/install-runtime");

const ACCEPTED_FLAGS = [
  "home",
  "provider",
  "providers",
  "user-root",
  "skip-starter-rules",
  "remove-shims",
];

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exitCode = 1;
}

function printReceipt(results) {
  process.stdout.write("OK: install-mpact\n");
  for (const line of results) {
    process.stdout.write(`- ${line}\n`);
  }
  process.stdout.write("Activation: configured provider shims apply to future sessions; this installing session should treat M-PACT runtime setup as complete now.\n");
  process.stdout.write("Activation: already-open provider sessions may need a new session or reload before they see shim changes.\n");
}

function main() {
  assertMpactAllowedInCurrentSession();
  const argv = process.argv.slice(2);
  assertKnownFlags(argv, ACCEPTED_FLAGS);
  const args = parseArgs(argv);
  assertStringFlagValues(args, ["home", "provider", "providers", "user-root"]);
  const skillRoot = path.dirname(__dirname);
  if (booleanArg(args, "remove-shims")) {
    const { results } = removeMpactShims({ args, skillRoot });
    printReceipt(results);
    return;
  }
  const { results } = installMpactRuntime({ args, skillRoot });
  printReceipt(results);
}

try {
  main();
} catch (error) {
  fail(error.message);
  process.exit(error.exitCode || process.exitCode || 1);
}
