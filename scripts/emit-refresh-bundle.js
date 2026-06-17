#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { assertMpactAllowedInCurrentSession } = require("./lib/helper-common");

assertMpactAllowedInCurrentSession();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function finalLine(text) {
  return String(text || "").trimEnd().split(/\r?\n/).pop() || "";
}

function findManifestValue(stdout, key) {
  const pattern = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = String(stdout || "").match(pattern);
  return match ? match[1].trim() : "";
}

function isProjectSetupRequired(stdout) {
  return stdout.includes("M-PACT PROJECT SETUP REQUIRED") && finalLine(stdout) === "END PROJECT SETUP REQUIRED";
}

const scriptPath = path.join(__dirname, "build-refresh-bundle.js");
if (!fs.existsSync(scriptPath)) {
  fail(`Refresh script missing: ${scriptPath}`);
}

const result = childProcess.spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  encoding: "utf8",
  windowsHide: true
});

if (result.error) {
  fail(`Failed to run refresh script: ${result.error.message}`);
}

const stdout = result.stdout || "";
const stderr = result.stderr || "";

if (isProjectSetupRequired(stdout)) {
  process.stdout.write(stdout);
  if (!stdout.endsWith("\n")) {
    process.stdout.write("\n");
  }
  process.exit(result.status === null ? 2 : result.status);
}

if (result.status !== 0) {
  fail(`Refresh script exited with code ${result.status}.\n${stderr || stdout}`.trim());
}

if (!stdout.includes("AUDIT: PASS")) {
  fail(`Refresh audit did not pass.\n${stdout}${stderr}`.trim());
}

if (!stdout.includes("M-PACT REFRESH BUNDLE MANIFEST")) {
  fail(`Refresh manifest missing.\n${stdout}${stderr}`.trim());
}

if (finalLine(stdout) !== "END REFRESH BUNDLE") {
  fail(`Refresh manifest incomplete; final line was ${JSON.stringify(finalLine(stdout))}.`);
}

const bundlePath = findManifestValue(stdout, "BundlePath");
if (!bundlePath) {
  fail(`Refresh manifest did not include BundlePath.\n${stdout}`.trim());
}

let bundle = "";
try {
  bundle = fs.readFileSync(bundlePath, "utf8");
} catch (err) {
  fail(`Unable to read refresh bundle at ${bundlePath}: ${err.message}`);
}

if (finalLine(bundle) !== "END REFRESH BUNDLE") {
  fail(`Refresh bundle incomplete; final line was ${JSON.stringify(finalLine(bundle))}.`);
}

process.stdout.write(bundle);
if (!bundle.endsWith("\n")) {
  process.stdout.write("\n");
}
