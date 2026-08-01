"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { booleanArg } = require("./helper-common");
const { ensureCounterInitialized } = require("./project-identity");

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
  return /\bM-PACT\b|\bm-pact\b/.test(content);
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

function installMpactRuntime({
  args = {},
  skillRoot = path.dirname(path.dirname(__dirname)),
  home = null,
  userRoot = null,
} = {}) {
  const resolvedHome = path.resolve(home || args.home || os.homedir());
  const resolvedSkillRoot = path.resolve(skillRoot);
  const explicitProviders = selectedProviders(args.provider || args.providers);
  const detectedProvider = detectInstalledProvider(resolvedSkillRoot, resolvedHome);
  const providers = explicitProviders.length > 0
    ? explicitProviders
    : detectedProvider
      ? [detectedProvider]
      : [];
  const skipStarterRules = booleanArg(args, "skip-starter-rules");
  const forceShims = booleanArg(args, "force-shims");
  const resolvedUserRoot = path.resolve(userRoot || args.userRoot || args["user-root"] || path.join(resolvedHome, ".AgentMemoryRoot"));
  const results = [];

  results.push(`home:${resolvedHome}`);
  results.push(`skill-root:${resolvedSkillRoot}`);
  results.push(`provider:${providers.length > 0 ? providers.join(",") : "(none detected; use --provider codex|claude|gemini to install one shim)"}`);
  results.push(`user-root:${resolvedUserRoot}`);
  const counter = ensureCounterInitialized(resolvedUserRoot);
  results.push(`user-root:${counter.created ? "created" : "preserved"}:project-count__${counter.value}`);
  for (const result of installStarterRules(resolvedUserRoot, resolvedSkillRoot, skipStarterRules)) {
    results.push(`user-root:${result}`);
  }

  for (const providerName of providers) {
    const provider = PROVIDERS[providerName];
    const shimTarget = path.join(resolvedHome, ...provider.shimTarget);
    results.push(`${providerName}:${installGlobalShim(resolvedSkillRoot, shimTarget, provider.shimSource, forceShims)}`);
  }

  return { results, providers, home: resolvedHome, skillRoot: resolvedSkillRoot, userRoot: resolvedUserRoot };
}

module.exports = {
  PROVIDERS,
  detectInstalledProvider,
  installMpactRuntime,
};
