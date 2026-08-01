#!/usr/bin/env node
"use strict";

const path = require("path");
const { assertMpactAllowedInCurrentSession, parseArgs } = require("./lib/helper-common");
const { installMpactRuntime } = require("./lib/install-runtime");

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
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
  const args = parseArgs(process.argv.slice(2));
  const skillRoot = path.dirname(__dirname);
  const { results } = installMpactRuntime({ args, skillRoot });
  printReceipt(results);
}

try {
  main();
} catch (error) {
  fail(error.message);
}
