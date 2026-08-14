#!/usr/bin/env node
"use strict";

const path = require("path");
const { booleanArg } = require("./lib/helper-common");
const { installMpactRuntime, removeMpactShims } = require("./lib/install-runtime");
const { runSetupCli } = require("./lib/setup-cli");

const ACCEPTED_FLAGS = [
  "home",
  "provider",
  "providers",
  "user-root",
  "skip-starter-rules",
  "disable",
  "enable",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

function printReceipt(operation, results) {
  process.stdout.write(`OK: install-mpact:${operation}\n`);
  for (const line of results) {
    process.stdout.write(`- ${line}\n`);
  }
  process.stdout.write("Activation: configured provider shims apply to future sessions; this installing session should treat M-PACT runtime setup as complete now.\n");
  process.stdout.write("Activation: already-open provider sessions may need a new session or reload before they see shim changes.\n");
}

function main(args) {
  const skillRoot = path.dirname(__dirname);
  const disable = booleanArg(args, "disable");
  const enable = booleanArg(args, "enable");
  if (disable && enable) {
    throw new Error("--disable and --enable cannot be used together");
  }
  if (disable) {
    const { results } = removeMpactShims({ args, skillRoot });
    printReceipt("disable", results);
    return;
  }
  if (enable) {
    const { results } = installMpactRuntime({ args, skillRoot });
    printReceipt("enable", results);
    return;
  }
  const { results } = installMpactRuntime({ args, skillRoot });
  printReceipt("install", results);
}

runSetupCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["home", "provider", "providers", "user-root"],
});
