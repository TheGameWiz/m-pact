#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  adoptProjectIdentity,
  defaultUserRoot,
} = require("./lib/project-identity");
const { projectMemoryRootFromArgs, runSetupCli } = require("./lib/setup-cli");

const ACCEPTED_FLAGS = ["root", "project", "user-root"];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [];

function main(args) {
  const userRoot = path.resolve(args["user-root"] || defaultUserRoot());
  const rootPath = projectMemoryRootFromArgs(args);
  const adopted = adoptProjectIdentity(rootPath, userRoot);
  process.stdout.write("OK: adopt-project-identity\n");
  process.stdout.write(`rootPath: ${adopted.rootPath}\n`);
  process.stdout.write(`projectId: ${adopted.projectId}\n`);
  process.stdout.write(`sentinel: ${adopted.sentinel}\n`);
  process.stdout.write(`status: ${adopted.adopted ? "adopted" : "already-valid"}\n`);
}

runSetupCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project", "user-root"],
});
