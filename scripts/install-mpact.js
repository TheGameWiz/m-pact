#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { booleanArg, parseArgs } = require("./lib/helper-common");

const PROVIDERS = {
  codex: {
    installRoot: [".codex", "skills", "m-pact"],
    shimTarget: [".codex", "AGENTS.md"],
    shimSource: "AGENTS.md",
  },
  claude: {
    installRoot: [".claude", "skills", "m-pact"],
    shimTarget: [".claude", "CLAUDE.md"],
    shimSource: "CLAUDE.md",
  },
  gemini: {
    installRoot: [".gemini", "extensions", "m-pact"],
    shimTarget: [".gemini", "GEMINI.md"],
    shimSource: "GEMINI.md",
  },
};

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function splitList(value) {
  if (!value) {
    return [];
  }
  return String(value).split(/[|,]/).map((item) => item.trim()).filter(Boolean);
}

function hasMpactInstruction(content) {
  return /\bM-PACT\b|\bm-pact\b|\bImpact\b/.test(content);
}

function installGlobalShim(skillRoot, targetPath, sourceName, force) {
  const sourcePath = path.join(skillRoot, "shims", sourceName);
  if (!fs.existsSync(sourcePath)) {
    return `blocked:global-shim:${sourceName}:missing-template`;
  }
  const template = fs.readFileSync(sourcePath, "utf8").replace(/\s*$/, "") + "\n";
  ensureDir(path.dirname(targetPath));
  if (!fs.existsSync(targetPath) || force) {
    fs.writeFileSync(targetPath, template, "utf8");
    return fs.existsSync(targetPath) && force
      ? `updated:global-shim:${targetPath}`
      : `created:global-shim:${targetPath}`;
  }
  const current = fs.readFileSync(targetPath, "utf8");
  if (hasMpactInstruction(current)) {
    return `skipped:global-shim:${targetPath}:already-has-mpact`;
  }
  fs.writeFileSync(targetPath, `${current.replace(/\s*$/, "")}\n\n${template}`, "utf8");
  return `appended:global-shim:${targetPath}`;
}

function installStarterRules(userRoot, skillRoot, skipStarterRules) {
  ensureDir(userRoot);
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

function selectedProviders(value) {
  const names = splitList(value);
  const selected = names.map((name) => name.toLowerCase());
  for (const name of selected) {
    if (!PROVIDERS[name]) {
      throw new Error(`unknown provider: ${name}`);
    }
  }
  return selected;
}

function detectInstalledProvider(skillRoot, home) {
  const resolvedSkillRoot = fs.realpathSync(skillRoot);
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    const installRoot = path.join(home, ...provider.installRoot);
    if (!fs.existsSync(installRoot)) {
      continue;
    }
    if (fs.realpathSync(installRoot) === resolvedSkillRoot) {
      return name;
    }
  }
  return null;
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
  const args = parseArgs(process.argv.slice(2));
  const skillRoot = path.dirname(__dirname);
  const home = path.resolve(args.home || os.homedir());
  const explicitProviders = selectedProviders(args.provider || args.providers);
  const detectedProvider = detectInstalledProvider(skillRoot, home);
  const providers = explicitProviders.length > 0
    ? explicitProviders
    : detectedProvider
      ? [detectedProvider]
      : [];
  const skipStarterRules = booleanArg(args, "skip-starter-rules");
  const forceShims = booleanArg(args, "force-shims");
  const userRoot = path.resolve(args.userRoot || args["user-root"] || path.join(home, ".AgentMemoryRoot"));
  const results = [];

  results.push(`home:${home}`);
  results.push(`skill-root:${skillRoot}`);
  results.push(`provider:${providers.length > 0 ? providers.join(",") : "(none detected; use --provider codex|claude|gemini to install one shim)"}`);
  results.push(`user-root:${userRoot}`);
  for (const result of installStarterRules(userRoot, skillRoot, skipStarterRules)) {
    results.push(`user-root:${result}`);
  }

  for (const providerName of providers) {
    const provider = PROVIDERS[providerName];
    const shimTarget = path.join(home, ...provider.shimTarget);
    results.push(`${providerName}:${installGlobalShim(skillRoot, shimTarget, provider.shimSource, forceShims)}`);
  }

  printReceipt(results);
}

try {
  main();
} catch (error) {
  fail(error.message);
}
