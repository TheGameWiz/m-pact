#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { booleanArg, parseArgs } = require("./lib/helper-common");

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function installStarterRules(userRoot, skillRoot, skipStarterRules) {
  if (skipStarterRules) {
    return ["skipped:starter-rules:requested"];
  }
  const sourceDir = path.join(skillRoot, "starter-rules", "user-root", "rules");
  if (!fs.existsSync(sourceDir)) {
    return ["blocked:starter-rules:missing-template-dir"];
  }
  const targetDir = path.join(userRoot, "rules");
  ensureDir(targetDir);
  const results = [];
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (fs.existsSync(targetPath)) {
      results.push(`skipped:${entry.name}:exists`);
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
    results.push(`created:${entry.name}`);
  }
  return results;
}

function printReceipt(operation, rootPath, results) {
  process.stdout.write(`OK: ${operation}\n`);
  process.stdout.write(`rootPath: ${rootPath}\n`);
  for (const result of results) {
    process.stdout.write(`- ${result}\n`);
  }
}

function runRuntimeSetup(skillRoot, userRoot) {
  const installScript = path.join(skillRoot, "scripts", "install-mpact.js");
  if (!fs.existsSync(installScript)) {
    throw new Error(`runtime setup helper is missing: ${installScript}`);
  }
  const result = spawnSync(process.execPath, [installScript, "--user-root", userRoot], {
    cwd: skillRoot,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `exit status ${result.status}`).trim();
    throw new Error(`runtime setup failed before project bootstrap: ${message}`);
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const skillRoot = path.dirname(__dirname);
  const userRootMode = booleanArg(args, "user-root");
  const skipStarterRules = booleanArg(args, "skip-starter-rules");

  if (userRootMode) {
    const userRoot = path.resolve(args.root || args.project || path.join(os.homedir(), ".AgentMemoryRoot"));
    ensureDir(userRoot);
    const results = installStarterRules(userRoot, skillRoot, skipStarterRules);
    printReceipt("bootstrap-user-root", userRoot, results);
    return;
  }

  const projectRoot = path.resolve(args.project || process.cwd());
  const userRoot = path.resolve(args.root || path.join(os.homedir(), ".AgentMemoryRoot"));
  const results = [];
  if (!fs.existsSync(userRoot)) {
    results.push("runtime-setup:required:user-root-missing");
    for (const line of runRuntimeSetup(skillRoot, userRoot)) {
      results.push(`runtime-setup:${line}`);
    }
  } else {
    results.push(`runtime-setup:skipped:user-root-present:${userRoot}`);
  }
  ensureDir(path.join(projectRoot, ".AgentMemory"));
  results.push("created-or-present:.AgentMemory");
  results.push("project-shims:not-supported");
  printReceipt("bootstrap-project", path.join(projectRoot, ".AgentMemory"), results);
}

try {
  main();
} catch (error) {
  fail(error.message);
}
