#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const MIN_NODE_MAJOR = 18;
const EOL = os.EOL;

function parseArgs(argv) {
  const options = {
    startPath: process.cwd(),
    activeSessionLimit: 10,
    sizeLimitKB: 100,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--StartPath" || arg === "-StartPath" || arg === "--start-path") && next) {
      options.startPath = next;
      i++;
    } else if ((arg === "--ActiveSessionLimit" || arg === "-ActiveSessionLimit" || arg === "--active-session-limit") && next) {
      options.activeSessionLimit = Number.parseInt(next, 10);
      i++;
    } else if ((arg === "--SizeLimitKB" || arg === "-SizeLimitKB" || arg === "--size-limit-kb") && next) {
      options.sizeLimitKB = Number.parseInt(next, 10);
      i++;
    }
  }

  if (!Number.isFinite(options.activeSessionLimit) || options.activeSessionLimit < 1) {
    options.activeSessionLimit = 10;
  }
  if (!Number.isFinite(options.sizeLimitKB) || options.sizeLimitKB < 1) {
    options.sizeLimitKB = 100;
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

function splitLines(text) {
  return text.split(/\r?\n/);
}

function getSummarySlice(filePath) {
  const text = readText(filePath);
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

function addArtifact(lines, title, artifactPath, body) {
  addLine(lines, `### ${title}`);
  addLine(lines);
  addLine(lines, `Path: ${artifactPath}`);
  addLine(lines);
  addLine(lines, "```text");
  addLine(lines, String(body || "").trimEnd());
  addLine(lines, "```");
  addLine(lines);
}

function writeFailureAndExit(resolvedStart, failures) {
  console.log("AUDIT: FAIL");
  console.log("M-PACT REFRESH FAILURE");
  console.log(`StartPath: ${resolvedStart}`);
  console.log(`Failure count: ${failures.length}`);
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
  console.log("END REFRESH FAILURE");
  process.exit(1);
}

function utf8ByteCount(text) {
  if (text == null) {
    return 0;
  }
  return Buffer.byteLength(String(text), "utf8");
}

function formatKB(bytes) {
  return String(Math.round((bytes / 1024) * 10) / 10);
}

function getSizeSectionLines(sections) {
  return sections.map((section) => {
    if (!section.detail || !String(section.detail).trim()) {
      return `- ${section.name}: ${formatKB(section.bytes)}KB`;
    }
    return `- ${section.name}: ${formatKB(section.bytes)}KB (${section.detail})`;
  });
}

function newLimitedBundleText(lines, sizeLimitBytes, sizeLimitKB, originalBytes, sections) {
  const limited = [];
  const suffix = [];

  addLine(suffix);
  addLine(suffix, "## Refresh Bundle Limit Notice");
  addLine(suffix);
  addLine(suffix, `- Size limit hit: original bundle was ${formatKB(originalBytes)}KB; limit is ${sizeLimitKB}KB.`);
  addLine(suffix, "- This is a partial refresh bundle. Startup content after the truncation point was omitted.");
  addLine(suffix, "- Use targeted memory lookup after refresh for omitted sessions, task details, rules, case studies, journals, or other artifacts.");
  addLine(suffix, "- Section sizes before truncation:");
  for (const line of getSizeSectionLines(sections)) {
    addLine(suffix, `  ${line}`);
  }
  addLine(suffix);
  addLine(suffix, "END REFRESH BUNDLE");

  const suffixText = suffix.join(EOL) + EOL;
  const suffixBytes = utf8ByteCount(suffixText);
  let fenceOpen = false;

  for (const line of lines) {
    if (line === "END REFRESH BUNDLE") {
      continue;
    }

    const candidate = limited.concat([line]);
    let candidateFenceOpen = fenceOpen;
    if (line === "```") {
      candidateFenceOpen = !candidateFenceOpen;
    }

    const candidateExtra = candidateFenceOpen ? utf8ByteCount("```" + EOL) : 0;
    const candidateText = candidate.join(EOL) + EOL;
    const candidateBytes = utf8ByteCount(candidateText) + candidateExtra + suffixBytes;
    if (candidateBytes > sizeLimitBytes) {
      break;
    }

    limited.push(line);
    if (line === "```") {
      fenceOpen = !fenceOpen;
    }
  }

  if (fenceOpen) {
    addLine(limited, "```");
  }
  for (const line of suffix) {
    addLine(limited, line);
  }

  return limited.join(EOL) + EOL;
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

function findNewestActiveTaskLog(tasksDir) {
  let newest = null;

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const parent = path.basename(path.dirname(fullPath));
        const taskFolder = path.basename(path.dirname(path.dirname(fullPath)));
        if (parent === "log" && taskFolder.startsWith("A__")) {
          const stat = fs.statSync(fullPath);
          if (!newest || stat.mtimeMs > newest.mtimeMs) {
            newest = { fullPath, taskFolder, mtimeMs: stat.mtimeMs };
          }
        }
      }
    }
  }

  walk(tasksDir);
  return newest;
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
  const coreRuleArtifacts = [];
  const ruleIndexParts = [];
  const scriptDir = __dirname;
  const skillDir = path.dirname(scriptDir);
  const memoryContractPath = path.join(skillDir, "references", "memory-contract.md");
  let memoryContractText = null;
  let activeTaskNames = [];
  let startupTaskRead = "(none)";
  let startupTaskText = "";
  let currentTaskPointer = "(none)";
  const missingOrAmbiguous = [];

  if (existsFile(memoryContractPath)) {
    try {
      memoryContractText = readText(memoryContractPath);
    } catch (error) {
      failures.push(`Failed to read memory contract reference: ${memoryContractPath} (${error.message})`);
    }
  } else {
    failures.push(`Missing memory contract reference: ${memoryContractPath}`);
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

  for (const root of chain) {
    for (const folder of ["rules", "sessions", "tasks", "case-studies", "journal"]) {
      const folderPath = path.join(root, folder);
      if (!existsDir(folderPath)) {
        failures.push(`Memory root missing required folder: ${folderPath}`);
      }
    }
  }

  for (const root of chain) {
    const rulesDir = path.join(root, "rules");
    const rules = listMarkdownFiles(rulesDir);
    const nonCoreCount = rules.filter((rule) => !rule.name.startsWith("core-")).length;
    ruleIndexParts.push(`${root}: ${rules.length} rules, ${nonCoreCount} unread non-core`);

    for (const rule of rules.filter((item) => item.name.startsWith("core-"))) {
      try {
        const body = readText(rule.fullName);
        coreRuleNames.push(rule.name);
        coreRuleArtifacts.push({
          name: rule.name,
          path: rule.fullName,
          text: body,
        });
      } catch (error) {
        failures.push(`Failed to read core rule: ${rule.fullName} (${error.message})`);
      }
    }
  }

  let activeSelectedCount = 0;
  let ancestorSentinelCount = 0;
  let sessionFullCount = 0;
  let sessionSummaryCount = 0;
  let sessionFallbackCount = 0;
  const sessionCountByRoot = new Map();

  function incrementSessionRoot(root) {
    sessionCountByRoot.set(root, (sessionCountByRoot.get(root) || 0) + 1);
  }

  if (activeRoot) {
    const activeSessionsDir = path.join(activeRoot, "sessions");
    if (existsDir(activeSessionsDir)) {
      const activeSessions = listMarkdownFiles(activeSessionsDir)
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, options.activeSessionLimit);
      activeSelectedCount = activeSessions.length;

      for (let i = 0; i < activeSessions.length; i++) {
        const file = activeSessions[i];
        try {
          let text;
          let mode;
          if (i === 0) {
            text = readText(file.fullName);
            mode = "full";
            sessionFullCount++;
          } else {
            const slice = getSummarySlice(file.fullName);
            text = slice.text;
            if (slice.fallbackFull) {
              mode = "full-fallback";
              sessionFullCount++;
              sessionFallbackCount++;
            } else {
              mode = "summary";
              sessionSummaryCount++;
            }
          }

          sessionReads.push({ root: activeRoot, path: file.fullName, mode, text });
          incrementSessionRoot(activeRoot);
        } catch (error) {
          failures.push(`Failed to read selected active-root session: ${file.fullName} (${error.message})`);
        }
      }
    }
  }

  const ancestorRoots = [];
  if (activeRoot) {
    for (let i = projectRoots.length - 2; i >= 0; i--) {
      ancestorRoots.push(projectRoots[i]);
    }
    if (existsDir(userRoot)) {
      ancestorRoots.push(resolveExisting(userRoot));
    }
  } else if (existsDir(userRoot)) {
    ancestorRoots.push(resolveExisting(userRoot));
  }

  for (const root of ancestorRoots) {
    const sessionsDir = path.join(root, "sessions");
    if (!existsDir(sessionsDir)) {
      continue;
    }

    const files = listMarkdownFiles(sessionsDir).sort((a, b) => b.name.localeCompare(a.name));
    if (files.length === 0) {
      continue;
    }

    const file = files[0];
    try {
      const slice = getSummarySlice(file.fullName);
      let mode;
      if (slice.fallbackFull) {
        mode = "full-fallback";
        sessionFullCount++;
        sessionFallbackCount++;
      } else {
        mode = "summary";
        sessionSummaryCount++;
      }

      ancestorSentinelCount++;
      sessionReads.push({ root, path: file.fullName, mode, text: slice.text });
      incrementSessionRoot(root);
    } catch (error) {
      failures.push(`Failed to read ancestor sentinel session: ${file.fullName} (${error.message})`);
    }
  }

  if (activeRoot) {
    const tasksDir = path.join(activeRoot, "tasks");
    if (existsDir(tasksDir)) {
      activeTaskNames = listDirectories(tasksDir, "A__");
      const currentTaskPath = path.join(tasksDir, "current-task.md");
      let selectedTask = null;

      if (existsFile(currentTaskPath)) {
        try {
          const pointerText = readText(currentTaskPath);
          const taskLine = splitLines(pointerText).find((line) => /^task:\s*/.test(line));
          if (taskLine) {
            currentTaskPointer = taskLine.replace(/^task:\s*/, "").trim();
            const candidateTaskPath = path.join(tasksDir, currentTaskPointer);
            if (/^A__/.test(currentTaskPointer) && existsDir(candidateTaskPath)) {
              selectedTask = currentTaskPointer;
            } else {
              missingOrAmbiguous.push(`stale current-task pointer ${currentTaskPointer}; remove current-task.md or explicitly choose an active task`);
            }
          } else {
            currentTaskPointer = "(invalid: missing task line)";
            missingOrAmbiguous.push("current-task.md is missing a task line");
          }
        } catch (error) {
          failures.push(`Failed to read current task pointer: ${currentTaskPath} (${error.message})`);
        }
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

  const chainDisplay = formatList(chain);
  const projectDisplay = activeRoot || "(none found)";
  const activeDisplay = projectDisplay;
  const userDisplay = resolveExisting(userRoot);
  const coreRuleDisplay = formatList(coreRuleNames);
  const ruleIndexDisplay = ruleIndexParts.length > 0 ? ruleIndexParts.join("; ") : "(none)";
  const sessionByRootParts = [];
  for (const root of chain) {
    if (sessionCountByRoot.has(root)) {
      sessionByRootParts.push(`${root}=${sessionCountByRoot.get(root)}`);
    }
  }
  const sessionByRootDisplay = sessionByRootParts.length > 0 ? sessionByRootParts.join("; ") : "(none)";
  const activeTasksDisplay = `${activeTaskNames.length} from active root; current-task pointer ${currentTaskPointer}`;
  const missingOrAmbiguousDisplay = missingOrAmbiguous.length > 0 ? formatList(missingOrAmbiguous) : "[(none)]";
  const projectRootsDisplay = formatList(projectRoots);

  addLine(bundle, "AUDIT: PASS");
  addLine(bundle, "M-PACT REFRESH BUNDLE");
  addLine(bundle, `Generated: ${generatedTimestamp()}`);
  addLine(bundle, `StartPath: ${resolvedStart}`);
  addLine(bundle);
  addLine(bundle, "BEGIN REFRESH RECEIPT");
  addLine(bundle, "M-PACT MEMORY REFRESH");
  addLine(bundle, "Refresh bundle script: build-refresh-bundle.js; audit=PASS; output-complete=END REFRESH BUNDLE");
  addLine(bundle, "Roots resolved:");
  addLine(bundle, `  active: ${activeDisplay}`);
  addLine(bundle, `  chain: ${chainDisplay}`);
  addLine(bundle, `  project: ${projectDisplay}`);
  addLine(bundle, `  user: ${userDisplay}`);
  addLine(bundle, "Protocol references loaded (full): [memory-contract.md]");
  addLine(bundle, `Core rules loaded (full): ${coreRuleDisplay}`);
  addLine(bundle, `Rule index noted: ${ruleIndexDisplay}`);
  addLine(bundle, `Recent sessions read: full=${sessionFullCount}, summary=${sessionSummaryCount}, full-fallback=${sessionFallbackCount}; by root=${sessionByRootDisplay}; active-selected=${activeSelectedCount}; ancestor-sentinels=${ancestorSentinelCount}; selection=filename-desc`);
  addLine(bundle, `Active tasks noted: ${activeTasksDisplay}`);
  addLine(bundle, `Startup task read: ${startupTaskRead}`);
  addLine(bundle, `Missing or ambiguous: ${missingOrAmbiguousDisplay}`);
  addLine(bundle, "END REFRESH RECEIPT");
  addLine(bundle);
  addLine(bundle, "## Root And Startup Manifest");
  addLine(bundle);
  addLine(bundle, `- Start path: ${resolvedStart}`);
  addLine(bundle, `- Required user root: ${userDisplay}`);
  addLine(bundle, `- Project roots, broad-to-specific: ${projectRootsDisplay}`);
  addLine(bundle, `- Active project root: ${activeDisplay}`);
  addLine(bundle, `- Memory chain, broad-to-specific: ${chainDisplay}`);
  addLine(bundle, "- Startup session selection: active root first by filename descending, newest full, remaining selected active sessions summary-only, then one summary-only ancestor sentinel per remaining root from nearest parent to user root.");
  addLine(bundle, "- Startup task selection: active root only, read task.md only when current-task.md points to an active task; never infer a replacement current task.");
  addLine(bundle, "- Startup exclusions: non-core rule bodies, task specification.md, task logs, task summaries, journals, and case studies.");
  addLine(bundle);
  addLine(bundle, "## Protocol References Loaded In Full");
  addLine(bundle);
  addArtifact(bundle, "memory-contract.md", memoryContractPath, memoryContractText);
  addLine(bundle, "## Core Rules Loaded In Full");
  addLine(bundle);
  for (const artifact of coreRuleArtifacts) {
    addArtifact(bundle, artifact.name, artifact.path, artifact.text);
  }

  addLine(bundle, "## Recent Sessions Loaded");
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

  let bundleText = bundle.join(EOL) + EOL;
  let bundleBytes = utf8ByteCount(bundleText);
  let bundleLineCount = bundleText.split(/\r?\n/).length - 1;
  const sizeLimitBytes = options.sizeLimitKB * 1024;

  const memoryContractBytes = utf8ByteCount(memoryContractText);
  const coreRuleBytes = coreRuleArtifacts.reduce((sum, artifact) => sum + utf8ByteCount(artifact.text), 0);
  let newestSessionBytes = 0;
  let newestSessionDetail = "";
  let otherSessionBytes = 0;
  if (sessionReads.length > 0) {
    newestSessionBytes = utf8ByteCount(sessionReads[0].text);
    newestSessionDetail = path.basename(sessionReads[0].path);
    for (let i = 1; i < sessionReads.length; i++) {
      otherSessionBytes += utf8ByteCount(sessionReads[i].text);
    }
  }

  const startupTaskBytes = startupTaskRead !== "(none)" ? utf8ByteCount(startupTaskText) : 0;
  const knownSectionBytes = memoryContractBytes + coreRuleBytes + newestSessionBytes + otherSessionBytes + startupTaskBytes;
  const otherBytes = Math.max(0, bundleBytes - knownSectionBytes);
  const sections = [
    { name: "newest-session", bytes: newestSessionBytes, detail: newestSessionDetail },
    { name: "other-sessions", bytes: otherSessionBytes, detail: "" },
    { name: "core-rules", bytes: coreRuleBytes, detail: "" },
    { name: "memory-contract", bytes: memoryContractBytes, detail: "memory-contract.md" },
    { name: "startup-task", bytes: startupTaskBytes, detail: startupTaskRead },
    { name: "manifest+receipt+other", bytes: otherBytes, detail: "" },
  ];

  let limitHit = false;
  const originalBundleBytes = bundleBytes;
  if (bundleBytes > sizeLimitBytes) {
    limitHit = true;
    const missingIndex = bundle.findIndex((line) => line.startsWith("Missing or ambiguous: "));
    if (missingIndex !== -1) {
      bundle[missingIndex] = "Missing or ambiguous: [bundle size limit hit: partial refresh bundle emitted; use targeted retrieval for omitted startup content]";
    }

    bundleText = newLimitedBundleText(bundle, sizeLimitBytes, options.sizeLimitKB, originalBundleBytes, sections);
    bundleBytes = utf8ByteCount(bundleText);
    bundleLineCount = bundleText.split(/\r?\n/).length - 1;
  }

  const tempName = `m-pact-refresh-${Date.now()}-${crypto.randomUUID().replace(/-/g, "")}.md`;
  const bundlePath = path.join(os.tmpdir(), tempName);
  fs.writeFileSync(bundlePath, bundleText, { encoding: "utf8" });

  console.log("AUDIT: PASS");
  console.log("M-PACT REFRESH BUNDLE MANIFEST");
  console.log(`BundlePath: ${bundlePath}`);
  console.log(`BundleBytes: ${bundleBytes}`);
  console.log(`LineCount: ${bundleLineCount}`);
  console.log(`SizeLimitKB: ${options.sizeLimitKB}`);
  console.log(`LimitHit: ${String(limitHit).toLowerCase()}`);
  if (limitHit) {
    console.log(`OriginalBundleBytes: ${originalBundleBytes}`);
    console.log("LimitNotice: partial refresh bundle emitted; use targeted retrieval for omitted startup content");
  }
  console.log("END REFRESH BUNDLE");
}

main();
