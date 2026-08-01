"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { assertStringFlagValues, booleanArg } = require("./helper-common");
const { defaultUserRoot, ensureCounterInitialized, readCounterSentinel } = require("./project-identity");

const SHIM_BEGIN = "<!-- BEGIN M-PACT SHIM -->";
const SHIM_END = "<!-- END M-PACT SHIM -->";

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

function existsDir(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function atomicWriteFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  const tempPath = path.join(path.dirname(filePath), `.m-pact-${process.pid}-${Date.now()}-${path.basename(filePath)}.tmp`);
  fs.writeFileSync(tempPath, content, "utf8");
  fs.renameSync(tempPath, filePath);
}

function dominantLineEnding(text) {
  const crlfCount = (String(text).match(/\r\n/g) || []).length;
  const lfCount = (String(text).match(/\n/g) || []).length - crlfCount;
  return crlfCount > lfCount ? "\r\n" : "\n";
}

function trimTrailingLineEndings(text) {
  return String(text).replace(/(?:\r\n|\r|\n)+$/, "");
}

function ensureFinalNewline(text) {
  return `${trimTrailingLineEndings(text)}${dominantLineEnding(text)}`;
}

function appendWithBlankSeparator(current, template) {
  if (!current) {
    return template;
  }
  const eol = dominantLineEnding(current);
  if (current.endsWith("\r\n") || current.endsWith("\n")) {
    return `${current}${eol}${template}`;
  }
  return `${current}${eol}${eol}${template}`;
}

function splitList(value) {
  if (!value) {
    return [];
  }
  return String(value).split(/[|,]/).map((item) => item.trim()).filter(Boolean);
}

function markerBounds(content) {
  const begin = content.indexOf(SHIM_BEGIN);
  const end = content.indexOf(SHIM_END);
  const duplicateBegin = begin !== -1 && content.indexOf(SHIM_BEGIN, begin + SHIM_BEGIN.length) !== -1;
  const duplicateEnd = end !== -1 && content.indexOf(SHIM_END, end + SHIM_END.length) !== -1;
  if (duplicateBegin || duplicateEnd || (begin === -1) !== (end === -1) || (begin !== -1 && end < begin)) {
    throw new Error("malformed M-PACT shim markers");
  }
  if (begin === -1) {
    return null;
  }
  return { begin, end: end + SHIM_END.length };
}

function installGlobalShim(skillRoot, targetPath, sourceName) {
  try {
    const sourcePath = path.join(skillRoot, "shims", sourceName);
    if (!fs.existsSync(sourcePath)) {
      return `blocked:global-shim:${sourceName}:missing-template`;
    }
    const rawTemplate = fs.readFileSync(sourcePath, "utf8");
    try {
      if (!markerBounds(rawTemplate)) {
        return `blocked:global-shim:${sourceName}:malformed-template`;
      }
    } catch {
      return `blocked:global-shim:${sourceName}:malformed-template`;
    }
    const template = ensureFinalNewline(rawTemplate);
    const replacementBlock = trimTrailingLineEndings(rawTemplate);
    if (!fs.existsSync(targetPath)) {
      atomicWriteFile(targetPath, template);
      return `created:global-shim:${targetPath}`;
    }
    const current = fs.readFileSync(targetPath, "utf8");
    const bounds = markerBounds(current);
    if (!bounds) {
      atomicWriteFile(targetPath, appendWithBlankSeparator(current, template));
      return `appended:global-shim:${targetPath}`;
    }
    atomicWriteFile(targetPath, `${current.slice(0, bounds.begin)}${replacementBlock}${current.slice(bounds.end)}`);
    return `updated:global-shim:${targetPath}`;
  } catch (error) {
    return `blocked:global-shim:${targetPath}:${error.message}`;
  }
}

function removeGlobalShim(targetPath) {
  try {
    if (!fs.existsSync(targetPath)) {
      return `skipped:global-shim:${targetPath}:missing`;
    }
    const current = fs.readFileSync(targetPath, "utf8");
    const bounds = markerBounds(current);
    if (!bounds) {
      return `skipped:global-shim:${targetPath}:no-mpact-block`;
    }
    atomicWriteFile(targetPath, `${current.slice(0, bounds.begin)}${current.slice(bounds.end)}`);
    return `removed:global-shim:${targetPath}`;
  } catch (error) {
    return `blocked:global-shim:${targetPath}:${error.message}`;
  }
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
  try {
    ensureDir(targetDir);
  } catch (error) {
    return [`blocked:starter-rules:${error.message}`];
  }
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
    try {
      fs.copyFileSync(sourcePath, targetPath);
      results.push(`created:${entry.name}`);
    } catch (error) {
      results.push(`blocked:${entry.name}:${error.message}`);
    }
  }
  return results;
}

function isUserRootComplete(userRoot) {
  if (!existsDir(userRoot)) {
    return false;
  }
  const counter = readCounterSentinel(userRoot);
  if (counter.state !== "valid") {
    return false;
  }
  const rulesDir = path.join(userRoot, "rules");
  if (!existsDir(rulesDir)) {
    return false;
  }
  return fs.readdirSync(rulesDir, { withFileTypes: true }).some((entry) => entry.isFile());
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
  assertStringFlagValues(args, ["user-root"]);
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
  const resolvedUserRoot = path.resolve(userRoot || args["user-root"] || defaultUserRoot());
  const results = [];
  const externalActions = [];

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
    const result = `${providerName}:${installGlobalShim(resolvedSkillRoot, shimTarget, provider.shimSource)}`;
    results.push(result);
    externalActions.push(result);
  }

  return { results, providers, home: resolvedHome, skillRoot: resolvedSkillRoot, userRoot: resolvedUserRoot, externalActions };
}

function removeMpactShims({
  args = {},
  skillRoot = path.dirname(path.dirname(__dirname)),
  home = null,
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
  const results = [];
  results.push(`home:${resolvedHome}`);
  results.push(`provider:${providers.length > 0 ? providers.join(",") : "(none detected; use --provider codex|claude|gemini to remove one shim)"}`);
  for (const providerName of providers) {
    const provider = PROVIDERS[providerName];
    const shimTarget = path.join(resolvedHome, ...provider.shimTarget);
    results.push(`${providerName}:${removeGlobalShim(shimTarget)}`);
  }
  return { results, providers, home: resolvedHome };
}

module.exports = {
  PROVIDERS,
  detectInstalledProvider,
  installGlobalShim,
  installMpactRuntime,
  isUserRootComplete,
  markerBounds,
  removeGlobalShim,
  removeMpactShims,
};
