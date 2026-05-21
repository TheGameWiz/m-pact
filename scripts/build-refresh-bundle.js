#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { listMembers, readMember } = require("./lib/zip-record-store");

const MIN_NODE_MAJOR = 18;
const EOL = os.EOL;
const RECENT_SESSION_BUDGET_BYTES = 25 * 1024;
const RECENT_SESSION_SUMMARY_LIMIT = 4;
const TRUNCATION_NOTICE = "\n\n[Truncated to fit the 25KB recent-session refresh budget.]";

function parseArgs(argv) {
  const options = {
    startPath: process.cwd(),
    allowUserRootOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--StartPath" || arg === "-StartPath" || arg === "--start-path") && next) {
      options.startPath = next;
      i++;
    } else if (arg === "--AllowUserRootOnly" || arg === "-AllowUserRootOnly" || arg === "--allow-user-root-only") {
      options.allowUserRootOnly = true;
    }
  }

  return options;
}

function addLine(lines, line = "") {
  lines.push(line);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function existsDir(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveExisting(filePath) {
  return fs.realpathSync(filePath);
}

function convertInputPath(inputPath) {
  const match = inputPath.match(/^\/([a-zA-Z])\/(.*)$/);
  if (match && process.platform === "win32") {
    return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, "\\")}`;
  }
  return inputPath;
}

function formatList(items) {
  if (!items || items.length === 0) {
    return "[]";
  }
  return `[${items.join(", ")}]`;
}

function formatDisplayPath(filePath) {
  if (!filePath || filePath.startsWith("(")) {
    return filePath;
  }
  return process.platform === "win32" ? filePath.replace(/\\/g, "/") : filePath;
}

function formatDisplayPathList(items) {
  return formatList((items || []).map(formatDisplayPath));
}

function splitLines(text) {
  return text.split(/\r?\n/);
}

function getSummarySlice(filePath) {
  const text = readText(filePath);
  return getSummarySliceFromText(text);
}

function getSummarySliceFromText(text) {
  const lines = splitLines(text);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const summaryLine = lines.findIndex((line) => line === "## Summary");
  if (summaryLine === -1) {
    return { text, fallbackFull: true };
  }

  let endExclusive = lines.length;
  for (let i = summaryLine + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      endExclusive = i;
      break;
    }
  }

  return {
    text: lines.slice(0, endExclusive).join(EOL),
    fallbackFull: false,
  };
}

function listSessionArtifacts(root) {
  const artifacts = [];
  const sessionsZip = path.join(root, "sessions.zip");
  if (existsFile(sessionsZip)) {
    for (const member of listMembers(sessionsZip)) {
      artifacts.push({
        name: member.name,
        label: `${sessionsZip}#${member.name}`,
        readFull: () => readMember(sessionsZip, member.name).toString("utf8"),
        readSummary: () => getSummarySliceFromText(readMember(sessionsZip, member.name).toString("utf8")),
      });
    }
  }

  return artifacts.sort((a, b) => b.name.localeCompare(a.name));
}

function addArtifact(lines, title, artifactPath, body) {
  addLine(lines, `### ${title}`);
  addLine(lines);
  addLine(lines, `Path: ${formatDisplayPath(artifactPath)}`);
  addLine(lines);
  addLine(lines, "```text");
  addLine(lines, String(body || "").trimEnd());
  addLine(lines, "```");
  addLine(lines);
}

function getArtifactByteCount(title, artifactPath, body) {
  const lines = [
    `### ${title}`,
    "",
    `Path: ${formatDisplayPath(artifactPath)}`,
    "",
    "```text",
    String(body || "").trimEnd(),
    "```",
    "",
  ];
  return utf8ByteCount(lines.join(EOL) + EOL);
}

function truncateTextToByteBudget(text, maxBytes, notice = TRUNCATION_NOTICE) {
  if (maxBytes <= 0) {
    return "";
  }

  const source = String(text || "").trimEnd();
  if (utf8ByteCount(source) <= maxBytes) {
    return source;
  }

  const noticeBytes = utf8ByteCount(notice);
  const bodyBudget = Math.max(0, maxBytes - noticeBytes);
  let clipped = Buffer.from(source, "utf8").subarray(0, bodyBudget).toString("utf8").trimEnd();
  while (utf8ByteCount(clipped) + noticeBytes > maxBytes && clipped.length > 0) {
    clipped = clipped.slice(0, -1).trimEnd();
  }

  if (utf8ByteCount(notice) > maxBytes) {
    return clipped;
  }

  return `${clipped}${notice}`;
}

function writeFailureAndExit(resolvedStart, failures) {
  console.log("AUDIT: FAIL");
  console.log("M-PACT REFRESH FAILURE");
  console.log(`StartPath: ${formatDisplayPath(resolvedStart)}`);
  console.log(`Failure count: ${failures.length}`);
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
  console.log("END REFRESH FAILURE");
  process.exit(1);
}

function writeProjectSetupRequiredAndExit(details) {
  console.log("M-PACT PROJECT SETUP REQUIRED");
  console.log(`StartPath: ${formatDisplayPath(details.resolvedStart)}`);
  console.log(`Active: (none found)`);
  console.log(`Project: (none found)`);
  console.log(`User: ${formatDisplayPath(details.userDisplay)}`);
  console.log(`Chain: ${formatDisplayPathList(details.chain)}`);
  console.log("No project .AgentMemory/ root was found for this workspace.");
  console.log("Ask the Director whether to create project M-PACT scaffolding here before emitting any refresh receipt.");
  console.log("Question: No project M-PACT root was found for this workspace. Create project M-PACT scaffolding here? This will add .AgentMemory/. Artifact folders and ZIP containers are created lazily when first used. Project startup shims are not part of project bootstrap. Answer yes or no.");
  console.log("If yes: follow references/bootstrap-project.md, then run refresh again.");
  console.log("If no: run refresh again with --AllowUserRootOnly and emit the resulting receipt.");
  console.log("END PROJECT SETUP REQUIRED");
  process.exit(0);
}

function utf8ByteCount(text) {
  if (text == null) {
    return 0;
  }
  return Buffer.byteLength(String(text), "utf8");
}

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

function getStartupContractCoverage(skillDir, startupContractText) {
  const skillPath = path.join(skillDir, "SKILL.md");
  const hash = sha256(startupContractText);
  if (!existsFile(skillPath)) {
    return {
      covered: false,
      hash,
      skillPath,
      reason: "SKILL.md not found",
    };
  }

  let skillText = "";
  try {
    skillText = readText(skillPath);
  } catch (error) {
    return {
      covered: false,
      hash,
      skillPath,
      reason: `SKILL.md could not be read (${error.message})`,
    };
  }

  const marker = `startup-contract-sha256: ${hash}`;
  return {
    covered: skillText.includes(marker),
    hash,
    skillPath,
    reason: skillText.includes(marker) ? "" : `SKILL.md is missing ${marker}`,
  };
}

function addStartupContractReference(lines, startupContractPath, coverage) {
  addLine(lines, "### startup-contract.md");
  addLine(lines);
  addLine(lines, `Path: ${formatDisplayPath(startupContractPath)}`);
  addLine(lines, `SHA-256: ${coverage.hash}`);
  addLine(lines, `Covered by invoked skill: ${formatDisplayPath(coverage.skillPath)}`);
  addLine(lines, "Status: not inlined because SKILL.md carries the matching startup-contract-sha256 marker already loaded during skill invocation.");
  addLine(lines);
}

function formatKB(bytes) {
  return String(Math.round((bytes / 1024) * 10) / 10);
}

function listMarkdownFiles(dirPath) {
  if (!existsDir(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => ({
      name: entry.name,
      fullName: path.join(dirPath, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listDirectories(dirPath, prefix) {
  if (!existsDir(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function generatedTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offsetHour = pad(Math.floor(abs / 60));
  const offsetMinute = pad(abs % 60);
  return `${year}-${month}-${day} ${hour}:${minute}:${second} ${sign}${offsetHour}:${offsetMinute}`;
}

function assertSupportedNode() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
    writeFailureAndExit(process.cwd(), [
      `Node.js ${MIN_NODE_MAJOR}+ is required; current version is ${process.versions.node}`,
    ]);
  }
}

function main() {
  assertSupportedNode();

  const options = parseArgs(process.argv.slice(2));
  const failures = [];
  const sessionReads = [];
  const bundle = [];
  const coreRuleNames = [];
  const ruleIndexParts = [];
  const scriptDir = __dirname;
  const skillDir = path.dirname(scriptDir);
  const startupContractPath = path.join(skillDir, "references", "startup-contract.md");
  let startupContractText = null;
  let activeTaskNames = [];
  let startupTaskRead = "(none)";
  let startupTaskText = "";
  let currentTaskPointer = "(none)";
  const missingOrAmbiguous = [];

  if (existsFile(startupContractPath)) {
    try {
      startupContractText = readText(startupContractPath);
    } catch (error) {
      failures.push(`Failed to read startup contract reference: ${startupContractPath} (${error.message})`);
    }
  } else {
    failures.push(`Missing startup contract reference: ${startupContractPath}`);
  }

  const inputStartPath = convertInputPath(options.startPath);
  let resolvedStart = options.startPath;
  let startDir = null;
  try {
    const stat = fs.statSync(inputStartPath);
    startDir = stat.isDirectory() ? inputStartPath : path.dirname(inputStartPath);
    resolvedStart = resolveExisting(startDir);
  } catch (error) {
    failures.push(`StartPath could not be resolved: ${options.startPath} (${error.message})`);
    writeFailureAndExit(options.startPath, failures);
  }

  const homePath = process.env.USERPROFILE && process.env.USERPROFILE.trim()
    ? process.env.USERPROFILE
    : os.homedir();
  const userRoot = path.join(homePath, ".AgentMemoryRoot");
  if (!existsDir(userRoot)) {
    failures.push(`Required user root is missing: ${userRoot}`);
  }

  const nearestFirstProjectRoots = [];
  let cursor = resolvedStart;
  while (cursor) {
    const candidate = path.join(cursor, ".AgentMemory");
    if (existsDir(candidate)) {
      nearestFirstProjectRoots.push(resolveExisting(candidate));
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  const projectRoots = nearestFirstProjectRoots.slice().reverse();
  const activeRoot = projectRoots.length > 0 ? projectRoots[projectRoots.length - 1] : null;
  const chain = [];
  if (existsDir(userRoot)) {
    chain.push(resolveExisting(userRoot));
  }
  for (const root of projectRoots) {
    chain.push(root);
  }

  if (!activeRoot && !options.allowUserRootOnly) {
    if (failures.length > 0) {
      writeFailureAndExit(resolvedStart, failures);
    }
    writeProjectSetupRequiredAndExit({
      resolvedStart,
      userDisplay: resolveExisting(userRoot),
      chain,
    });
  }

  for (const root of chain) {
    const rulesDir = path.join(root, "rules");
    const rules = listMarkdownFiles(rulesDir);
    const nonCoreCount = rules.filter((rule) => !rule.name.startsWith("core-")).length;
    ruleIndexParts.push(`${formatDisplayPath(root)}: ${rules.length} rules, ${nonCoreCount} unread non-core`);

    for (const rule of rules.filter((item) => item.name.startsWith("core-"))) {
      coreRuleNames.push(rule.name);
    }
  }

  let sessionBudgetUsed = 0;
  let sessionBudgetTruncated = false;
  let sessionBudgetOmitted = 0;

  if (activeRoot) {
    const activeSessions = listSessionArtifacts(activeRoot).slice(0, RECENT_SESSION_SUMMARY_LIMIT + 1);

    for (let i = 0; i < activeSessions.length; i++) {
      const file = activeSessions[i];
      try {
        let text;
        let mode;
        if (i === 0) {
          text = file.readFull();
          mode = "full";
          let artifactBytes = getArtifactByteCount(mode, file.label, text);
          if (artifactBytes > RECENT_SESSION_BUDGET_BYTES) {
            mode = "full-truncated";
            const overheadBytes = getArtifactByteCount(mode, file.label, "");
            text = truncateTextToByteBudget(text, RECENT_SESSION_BUDGET_BYTES - overheadBytes);
            artifactBytes = getArtifactByteCount(mode, file.label, text);
            sessionBudgetTruncated = true;
          }

          sessionReads.push({ root: activeRoot, path: file.label, mode, text });
          sessionBudgetUsed += artifactBytes;
        } else {
          const slice = file.readSummary();
          text = slice.text;
          if (slice.fallbackFull) {
            mode = "full-fallback";
          } else {
            mode = "summary";
          }

          const artifactBytes = getArtifactByteCount(mode, file.label, text);
          if (sessionBudgetUsed + artifactBytes > RECENT_SESSION_BUDGET_BYTES) {
            sessionBudgetOmitted = activeSessions.length - i;
            break;
          }

          sessionReads.push({ root: activeRoot, path: file.label, mode, text });
          sessionBudgetUsed += artifactBytes;
        }
      } catch (error) {
        failures.push(`Failed to read selected active-root session: ${file.label} (${error.message})`);
      }
    }
  }

  if (activeRoot) {
    const tasksDir = path.join(activeRoot, "tasks");
    if (existsDir(tasksDir)) {
      activeTaskNames = listDirectories(tasksDir, "A__");
      let selectedTask = null;
      const taskEntries = fs.readdirSync(tasksDir, { withFileTypes: true });
      const currentPointers = taskEntries
        .filter((entry) => entry.isFile() && entry.name.startsWith("current__"))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      if (currentPointers.length === 1) {
        const pointerName = currentPointers[0];
        const pointerPath = path.join(tasksDir, pointerName);
        const pointerStat = fs.statSync(pointerPath);
        currentTaskPointer = pointerName.slice("current__".length);
        const candidateTaskPath = path.join(tasksDir, currentTaskPointer);
        if (pointerStat.size !== 0) {
          missingOrAmbiguous.push(`current task pointer ${pointerName} must be a zero-byte sentinel`);
        }
        if (/^A__/.test(currentTaskPointer) && existsDir(candidateTaskPath)) {
          selectedTask = currentTaskPointer;
        } else {
          missingOrAmbiguous.push(`stale current task pointer ${pointerName}; remove it or explicitly choose an active task`);
        }
      } else if (currentPointers.length > 1) {
        currentTaskPointer = "(none; multiple current task sentinels)";
        missingOrAmbiguous.push(`multiple current task sentinels found: ${currentPointers.join(", ")}; no current task selected`);
      }

      if (selectedTask) {
        const taskMd = path.join(tasksDir, selectedTask, "task.md");
        if (existsFile(taskMd)) {
          try {
            startupTaskText = readText(taskMd);
            startupTaskRead = `${selectedTask}/task.md`;
          } catch (error) {
            failures.push(`Failed to read startup task file: ${taskMd} (${error.message})`);
          }
        } else {
          failures.push(`Selected startup task is missing task.md: ${taskMd}`);
        }
      }
    }
  }

  if (failures.length > 0) {
    writeFailureAndExit(resolvedStart, failures);
  }

  const chainDisplay = formatDisplayPathList(chain);
  const projectDisplay = activeRoot ? formatDisplayPath(activeRoot) : "(none found)";
  const activeDisplay = projectDisplay;
  const userDisplay = formatDisplayPath(resolveExisting(userRoot));
  const ruleIndexDisplay = ruleIndexParts.length > 0 ? ruleIndexParts.join("; ") : "(none)";
  const missingOrAmbiguousDisplay = missingOrAmbiguous.length > 0 ? formatList(missingOrAmbiguous) : "[(none)]";
  const projectRootsDisplay = formatDisplayPathList(projectRoots);
  const receiptLines = [
    "M-PACT MEMORY REFRESH",
    "audit=PASS; bundle=loaded; output-complete=END REFRESH BUNDLE",
  ];
  const startupContractCoverage = getStartupContractCoverage(skillDir, startupContractText);

  addLine(bundle, "AUDIT: PASS");
  addLine(bundle, "M-PACT REFRESH BUNDLE");
  addLine(bundle, `Generated: ${generatedTimestamp()}`);
  addLine(bundle, `StartPath: ${formatDisplayPath(resolvedStart)}`);
  addLine(bundle);
  addLine(bundle, "BEGIN REFRESH RECEIPT");
  for (const line of receiptLines) {
    addLine(bundle, line);
  }
  addLine(bundle, "END REFRESH RECEIPT");
  addLine(bundle);
  addLine(bundle, "## Root And Startup Manifest");
  addLine(bundle);
  addLine(bundle, `- Start path: ${formatDisplayPath(resolvedStart)}`);
  addLine(bundle, `- Required user root: ${userDisplay}`);
  addLine(bundle, `- Project roots, broad-to-specific: ${projectRootsDisplay}`);
  addLine(bundle, `- Active project root: ${activeDisplay}`);
  addLine(bundle, `- Memory chain, broad-to-specific: ${chainDisplay}`);
  addLine(bundle, `- Missing or ambiguous: ${missingOrAmbiguousDisplay}`);
  addLine(bundle, "- Startup session selection: active root only by filename descending; newest session full or truncated, then up to four summaries, with rendered session artifacts capped at 25KB total.");
  addLine(bundle, "- Startup task selection: active root only, read task.md only when exactly one zero-byte tasks/current__<task-folder> sentinel points to an active task; never infer a replacement current task.");
  addLine(bundle, "- Startup exclusions: rule bodies, task specification snapshots, task logs, task summaries, journals, and case studies.");
  addLine(bundle);
  addLine(bundle, "## Protocol References Loaded Or Verified");
  addLine(bundle);
  if (startupContractCoverage.covered) {
    addStartupContractReference(bundle, startupContractPath, startupContractCoverage);
  } else {
    addArtifact(bundle, "startup-contract.md", startupContractPath, startupContractText);
  }
  addLine(bundle, "## Core Rule Names Noted");
  addLine(bundle);
  addLine(bundle, `Rule index: ${ruleIndexDisplay}.`);
  addLine(bundle, "Only core rule filenames are included at startup. Use targeted lookup to read any rule body that may be relevant to the current work.");
  addLine(bundle);
  if (coreRuleNames.length === 0) {
    addLine(bundle, "(none)");
    addLine(bundle);
  } else {
    for (const ruleName of coreRuleNames) {
      addLine(bundle, `- ${ruleName}`);
    }
    addLine(bundle);
  }

  addLine(bundle, "## Recent Sessions Loaded");
  addLine(bundle);
  addLine(bundle, `Budget: ${formatKB(RECENT_SESSION_BUDGET_BYTES)}KB rendered session artifacts; used ${formatKB(sessionBudgetUsed)}KB.`);
  if (sessionBudgetTruncated) {
    addLine(bundle, "Newest session was truncated to fit the recent-session budget.");
  }
  if (sessionBudgetOmitted > 0) {
    addLine(bundle, `${sessionBudgetOmitted} selected session summary candidate(s) omitted because they did not fit the recent-session budget.`);
  }
  addLine(bundle);
  if (sessionReads.length === 0) {
    addLine(bundle, "(none)");
    addLine(bundle);
  } else {
    for (const session of sessionReads) {
      addArtifact(bundle, `${session.mode}: ${path.basename(session.path)}`, session.path, session.text);
    }
  }

  addLine(bundle, "## Active Tasks Noted");
  addLine(bundle);
  if (activeTaskNames.length === 0) {
    addLine(bundle, "(none)");
    addLine(bundle);
  } else {
    for (const taskName of activeTaskNames) {
      addLine(bundle, `- ${taskName}`);
    }
    addLine(bundle);
  }

  if (startupTaskRead !== "(none)") {
    const taskFolder = startupTaskRead.replace(/\/task\.md$/, "");
    const taskPath = path.join(activeRoot, "tasks", taskFolder, "task.md");
    addArtifact(bundle, `Startup task: ${startupTaskRead}`, taskPath, startupTaskText);
  }

  addLine(bundle, "END REFRESH BUNDLE");

  const bundleText = bundle.join(EOL) + EOL;
  const bundleBytes = utf8ByteCount(bundleText);
  const bundleLineCount = bundleText.split(/\r?\n/).length - 1;

  const tempName = `m-pact-refresh-${Date.now()}-${crypto.randomUUID().replace(/-/g, "")}.md`;
  const bundlePath = path.join(os.tmpdir(), tempName);
  fs.writeFileSync(bundlePath, bundleText, { encoding: "utf8" });

  console.log("AUDIT: PASS");
  console.log("M-PACT REFRESH BUNDLE MANIFEST");
  console.log(`BundlePath: ${bundlePath}`);
  console.log(`BundleBytes: ${bundleBytes}`);
  console.log(`LineCount: ${bundleLineCount}`);
  console.log(`RecentSessionBudgetKB: ${formatKB(RECENT_SESSION_BUDGET_BYTES)}`);
  console.log("BEGIN REFRESH RECEIPT");
  for (const line of receiptLines) {
    console.log(line);
  }
  console.log("END REFRESH RECEIPT");
  console.log("END REFRESH BUNDLE");
}

main();
