#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  resolveRootPath: resolveMemoryRootPath,
  resolveTaskPath: resolveMemoryTaskPath,
} = require("./task-state");

const MIN_NODE_MAJOR = 18;
const MEMBER_NAME_MAX = 128;

function assertNodeVersion() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
    throw new Error(`Node.js ${MIN_NODE_MAJOR} or newer is required.`);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function booleanArg(args, name) {
  if (!Object.prototype.hasOwnProperty.call(args, name)) {
    return false;
  }
  const value = args[name];
  if (value === true) {
    return true;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`--${name} accepts only true or false when a value is provided`);
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function normalizeForContainment(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function realpathForContainment(filePath) {
  const realpath = fs.realpathSync.native || fs.realpathSync;
  return realpath(path.resolve(filePath));
}

function isInsideDirectory(filePath, directoryPath) {
  const file = normalizeForContainment(filePath);
  const directory = normalizeForContainment(directoryPath);
  const relative = path.relative(directory, file);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function readInputFile(inputPath) {
  const realInputPath = realpathForContainment(inputPath);
  const realTempPath = realpathForContainment(os.tmpdir());
  const text = fs.readFileSync(realInputPath, "utf8");
  if (isInsideDirectory(realInputPath, realTempPath)) {
    try {
      fs.unlinkSync(realInputPath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new Error(`failed to delete OS-temp input file after reading: ${realInputPath}: ${error.message}`);
      }
    }
  }
  return text;
}

function readInput(args) {
  const text = args.input ? readInputFile(args.input) : readStdin();
  return text.length > 0 ? { body: text } : {};
}

function assertNoHelpProbe(argv) {
  if (!argv.includes("--help") && !argv.includes("-h")) {
    return;
  }
  throw new Error("M-PACT helpers do not support --help or -h. Read the relevant M-PACT reference procedure and use its example helper call.");
}

function writeReceipt(value) {
  const lines = [
    `OK: ${value.operation || "helper"}`,
  ];
  for (const key of ["record", "member", "timestamp", "task", "status", "taskPath", "rootPath", "zipPath", "oldPath", "newPath", "sentinel", "rulePath", "memberCount", "query", "readFrom", "readThrough", "nextCursor", "truncated", "membersRead", "specMember", "logMember", "warning"]) {
    if (value[key] !== undefined && value[key] !== null) {
      lines.push(`${key}: ${value[key]}`);
    }
  }
  if (Array.isArray(value.members)) {
    lines.push("members:");
    for (const member of value.members) {
      const record = member.record === undefined || member.record === null ? "" : ` record=${member.record}`;
      const score = member.score === undefined ? "" : ` score=${member.score}`;
      lines.push(`- ${member.name} size=${member.size}${record}${score} modified=${member.modified}`);
    }
  }
  if (Array.isArray(value.matches)) {
    lines.push("matches:");
    for (const match of value.matches) {
      const record = match.record === undefined || match.record === null ? "" : ` record=${match.record}`;
      const score = match.score === undefined ? "" : ` score=${match.score}`;
      lines.push(`- ${match.name || match.member} size=${match.size}${record}${score} modified=${match.modified}`);
    }
  }
  if (value.content !== undefined) {
    lines.push("content:");
    lines.push(String(value.content).replace(/\s*$/, ""));
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function localZoneLabel(date) {
  const override = process.env.MPACT_ZONE_LABEL;
  if (override && override.trim()) {
    return override.trim();
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "shortGeneric",
    }).formatToParts(date);
    const zone = parts.find((part) => part.type === "timeZoneName");
    if (zone && zone.value) {
      return zone.value;
    }
  } catch {
    // Fall through to numeric offset.
  }
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function localTimestamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const datePart = `${yyyy}-${mm}-${dd}`;
  const zone = localZoneLabel(date);
  const filenameZone = sanitizeSlug(zone) || "local";
  return {
    body: `${datePart} ${hh}:${min}:${ss} ${zone}`,
    filename: `${datePart}-${hh}${min}${ss}-${filenameZone}`,
    date: datePart,
    zone,
    filenameZone,
  };
}

function sanitizeSlug(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function memberName({ number, source, title, extension = ".md", includeSource = true }) {
  const prefix = includeSource
    ? `${String(number).padStart(4, "0")}-${sanitizeSlug(source) || "agent"}-`
    : `${String(number).padStart(4, "0")}-`;
  const suffix = extension.startsWith(".") ? extension : `.${extension}`;
  const available = MEMBER_NAME_MAX - prefix.length - suffix.length;
  if (available < 8) {
    throw new Error("member prefix leaves too little room for a descriptive slug");
  }
  let slug = sanitizeSlug(title) || "entry";
  if (slug.length > available) {
    slug = slug.slice(0, available).replace(/-+$/g, "");
  }
  if (!slug) {
    slug = "entry";
  }
  return `${prefix}${slug}${suffix}`;
}

function resolveTaskPath(input, args, options = {}) {
  return resolveMemoryTaskPath(input, args, options);
}

function resolveRootPath(input, args) {
  return resolveMemoryRootPath(input, args);
}

function yamlScalar(value) {
  if (value === undefined || value === null || value === "") {
    return "\"\"";
  }
  const text = String(value);
  if (/^[A-Za-z0-9_.\/+-]+$/.test(text)) {
    return text;
  }
  return JSON.stringify(text);
}

function yamlList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "[]";
  }
  return `[${values.map((value) => yamlScalar(value)).join(", ")}]`;
}

function yamlBlockList(name, values) {
  if (!Array.isArray(values) || values.length === 0) {
    return [`${name}: []`];
  }
  return [
    `${name}:`,
    ...values.map((value) => `  - ${yamlScalar(value)}`),
  ];
}

function runCli(main) {
  try {
    assertNodeVersion();
    const argv = process.argv.slice(2);
    assertNoHelpProbe(argv);
    const args = parseArgs(argv);
    const input = readInput(args);
    const result = main({ args, input });
    writeReceipt(result);
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  MEMBER_NAME_MAX,
  assertNoHelpProbe,
  booleanArg,
  localTimestamp,
  memberName,
  parseArgs,
  readInputFile,
  resolveRootPath,
  resolveTaskPath,
  runCli,
  sanitizeSlug,
  yamlBlockList,
  yamlList,
  yamlScalar,
};
