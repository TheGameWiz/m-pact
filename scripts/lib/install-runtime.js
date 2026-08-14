"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { assertStringFlagValues, booleanArg } = require("./helper-common");
const { defaultUserRoot, ensureCounterInitialized, readCounterSentinel } = require("./project-identity");
const { ensureScratchDirectory } = require("./scratch");

const SHIM_BEGIN = "<!-- BEGIN M-PACT SHIM -->";
const SHIM_END = "<!-- END M-PACT SHIM -->";

// SessionStart hooks run refresh deterministically on new
// sessions (startup, clear) and after completed compaction, injecting the helper's
// stdout as startup context. resume and fork are excluded: they restore context that
// already holds the loaded bundle, and the startup contract does not treat restored
// context as a refresh trigger.
const SESSIONSTART_HOOK_MATCHER = "startup|clear|compact";
const REFRESH_HOOK_SCRIPT_MARKER = "build-refresh-bundle.js";
const REFRESH_HOOK_FLAG = "--hook";
const ANTIGRAVITY_HOOK_NAME = "m-pact-refresh";
const ANTIGRAVITY_HOOK_SCRIPT = "antigravity-refresh-hook.js";

const PROVIDERS = {
  codex: {
    configRoot: [".codex"],
    envRoot: "CODEX_HOME",
    installRoot: ["skills", "m-pact"],
    shimTarget: ["AGENTS.md"],
    hookTarget: ["hooks.json"],
    shimSource: "AGENTS.md",
  },
  claude: {
    configRoot: [".claude"],
    envRoot: "CLAUDE_CONFIG_DIR",
    installRoot: ["skills", "m-pact"],
    shimTarget: ["CLAUDE.md"],
    hookTarget: ["settings.json"],
    shimSource: "CLAUDE.md",
  },
  antigravity: {
    configRoot: [".gemini"],
    installRoot: ["config", "skills", "m-pact"],
    shimTarget: ["GEMINI.md"],
    hookTarget: ["config", "hooks.json"],
    settingsTarget: ["antigravity-cli", "settings.json"],
    shimSource: "ANTIGRAVITY.md",
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

function defaultHomeDir(env = process.env) {
  return env.USERPROFILE || env.HOME || os.homedir();
}

function providerRootFromHome(providerName, homePath) {
  const provider = PROVIDERS[providerName];
  return path.resolve(homePath, ...provider.configRoot);
}

function resolveProviderRoot(providerName, {
  args = {},
  home = null,
  env = process.env,
} = {}) {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`unknown provider: ${providerName}`);
  }
  if (home) {
    return {
      root: providerRootFromHome(providerName, home),
      source: "home",
    };
  }
  if (args.home) {
    return {
      root: providerRootFromHome(providerName, args.home),
      source: "--home",
    };
  }
  if (provider.envRoot && env[provider.envRoot]) {
    return {
      root: path.resolve(env[provider.envRoot]),
      source: provider.envRoot,
    };
  }
  return {
    root: providerRootFromHome(providerName, defaultHomeDir(env)),
    source: "default",
  };
}

function resolveProviderRoots(providerNames, options = {}) {
  const roots = {};
  for (const providerName of providerNames) {
    roots[providerName] = resolveProviderRoot(providerName, options);
  }
  return roots;
}

function providerInstallRoot(providerName, providerRoot) {
  return path.join(providerRoot, ...PROVIDERS[providerName].installRoot);
}

function providerShimTarget(providerName, providerRoot) {
  return path.join(providerRoot, ...PROVIDERS[providerName].shimTarget);
}

function providerHookTarget(providerName, providerRoot) {
  return path.join(providerRoot, ...PROVIDERS[providerName].hookTarget);
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

function pathValueEquals(value, targetPath) {
  if (typeof value !== "string") {
    return false;
  }
  const target = path.resolve(targetPath);
  const resolved = path.resolve(value);
  return process.platform === "win32"
    ? resolved.toLowerCase() === target.toLowerCase()
    : resolved === target;
}

function containsPathValue(values, targetPath) {
  return values.some((value) => pathValueEquals(value, targetPath));
}

function pruneEmptyObjectProperty(parent, key) {
  if (parent[key] && typeof parent[key] === "object" && !Array.isArray(parent[key]) && Object.keys(parent[key]).length === 0) {
    delete parent[key];
  }
}

function grantClaudeUserRootAccess(providerRoot, userRoot) {
  const settingsPath = path.join(providerRoot, "settings.json");
  let settings = {};
  const existed = fs.existsSync(settingsPath);
  if (existed) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch (error) {
      return `blocked:claude-additionalDirectories:${settingsPath}:invalid-json:${error.message}`;
    }
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return `blocked:claude-additionalDirectories:${settingsPath}:settings-not-object`;
    }
  }
  if (settings.permissions !== undefined && (!settings.permissions || typeof settings.permissions !== "object" || Array.isArray(settings.permissions))) {
    return `blocked:claude-additionalDirectories:${settingsPath}:permissions-not-object`;
  }
  const permissions = settings.permissions || {};
  if (permissions.additionalDirectories !== undefined && !Array.isArray(permissions.additionalDirectories)) {
    return `blocked:claude-additionalDirectories:${settingsPath}:additionalDirectories-not-array`;
  }
  const additionalDirectories = permissions.additionalDirectories || [];
  if (containsPathValue(additionalDirectories, userRoot)) {
    return `skipped:claude-additionalDirectories:${userRoot}:already-present:new-sessions-only`;
  }
  const next = {
    ...settings,
    permissions: {
      ...permissions,
      additionalDirectories: [...additionalDirectories, userRoot],
    },
  };
  atomicWriteFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  return `${existed ? "updated" : "created"}:claude-additionalDirectories:${userRoot}:new-sessions-only`;
}

function revokeClaudeUserRootAccess(providerRoot, userRoot) {
  const settingsPath = path.join(providerRoot, "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return `skipped:claude-additionalDirectories:${userRoot}:settings-missing`;
  }
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (error) {
    return `blocked:claude-additionalDirectories:${settingsPath}:invalid-json:${error.message}`;
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return `blocked:claude-additionalDirectories:${settingsPath}:settings-not-object`;
  }
  if (settings.permissions === undefined) {
    return `skipped:claude-additionalDirectories:${userRoot}:permissions-missing`;
  }
  if (!settings.permissions || typeof settings.permissions !== "object" || Array.isArray(settings.permissions)) {
    return `blocked:claude-additionalDirectories:${settingsPath}:permissions-not-object`;
  }
  if (settings.permissions.additionalDirectories === undefined) {
    return `skipped:claude-additionalDirectories:${userRoot}:not-present`;
  }
  if (!Array.isArray(settings.permissions.additionalDirectories)) {
    return `blocked:claude-additionalDirectories:${settingsPath}:additionalDirectories-not-array`;
  }
  const kept = settings.permissions.additionalDirectories.filter((value) => !pathValueEquals(value, userRoot));
  const removed = settings.permissions.additionalDirectories.length - kept.length;
  if (removed === 0) {
    return `skipped:claude-additionalDirectories:${userRoot}:not-present`;
  }
  const nextPermissions = { ...settings.permissions };
  if (kept.length > 0) {
    nextPermissions.additionalDirectories = kept;
  } else {
    delete nextPermissions.additionalDirectories;
  }
  const next = { ...settings, permissions: nextPermissions };
  pruneEmptyObjectProperty(next, "permissions");
  atomicWriteFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  return `removed:claude-additionalDirectories:${userRoot}`;
}

function isMpactRefreshHookCommand(command) {
  return typeof command === "string" && command.includes(REFRESH_HOOK_SCRIPT_MARKER);
}

function withoutMpactRefreshHooks(sessionStart) {
  const kept = [];
  let removed = 0;
  for (const entry of sessionStart) {
    const hooks = entry && typeof entry === "object" && !Array.isArray(entry) && Array.isArray(entry.hooks)
      ? entry.hooks
      : null;
    if (!hooks) {
      kept.push(entry);
      continue;
    }
    const keptHooks = hooks.filter((hook) => !(hook && typeof hook === "object" && isMpactRefreshHookCommand(hook.command)));
    removed += hooks.length - keptHooks.length;
    if (keptHooks.length === hooks.length) {
      kept.push(entry);
    } else if (keptHooks.length > 0) {
      kept.push({ ...entry, hooks: keptHooks });
    }
  }
  return { kept, removed };
}

function hasUnprunableMpactRefreshHook(value, insidePrunableHooksArray = false) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (!insidePrunableHooksArray && isMpactRefreshHookCommand(value.command)) {
    return true;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "hooks" && Array.isArray(child)) {
      if (child.some((hook) => hasUnprunableMpactRefreshHook(hook, true))) {
        return true;
      }
      continue;
    }
    if (key === "command" && insidePrunableHooksArray) {
      continue;
    }
    if (Array.isArray(child)) {
      if (child.some((item) => hasUnprunableMpactRefreshHook(item, false))) {
        return true;
      }
    } else if (hasUnprunableMpactRefreshHook(child, false)) {
      return true;
    }
  }
  return false;
}

function hasUnprunableMpactRefreshHooks(sessionStart) {
  return sessionStart.some((entry) => hasUnprunableMpactRefreshHook(entry));
}

function refreshHookCommand(scriptPath) {
  return `node "${scriptPath.replace(/\\/g, "/")}" ${REFRESH_HOOK_FLAG}`;
}

function antigravityHookCommand(scriptPath) {
  return `node "${scriptPath.replace(/\\/g, "/")}"`;
}

function installClaudeSessionStartHook(providerRoot) {
  const settingsPath = path.join(providerRoot, "settings.json");
  const scriptPath = path.join(providerRoot, "skills", "m-pact", "scripts", "build-refresh-bundle.js");
  if (!fs.existsSync(scriptPath)) {
    return `blocked:claude-sessionstart-hook:missing-refresh-script:${scriptPath}`;
  }
  const command = refreshHookCommand(scriptPath);
  let settings = {};
  const existed = fs.existsSync(settingsPath);
  if (existed) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch (error) {
      return `blocked:claude-sessionstart-hook:${settingsPath}:invalid-json:${error.message}`;
    }
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return `blocked:claude-sessionstart-hook:${settingsPath}:settings-not-object`;
    }
  }
  if (settings.hooks !== undefined && (!settings.hooks || typeof settings.hooks !== "object" || Array.isArray(settings.hooks))) {
    return `blocked:claude-sessionstart-hook:${settingsPath}:hooks-not-object`;
  }
  const hooks = settings.hooks || {};
  if (hooks.SessionStart !== undefined && !Array.isArray(hooks.SessionStart)) {
    return `blocked:claude-sessionstart-hook:${settingsPath}:SessionStart-not-array`;
  }
  const sessionStart = hooks.SessionStart || [];
  const alreadyExact = sessionStart.some((entry) => entry && typeof entry === "object" && entry.matcher === SESSIONSTART_HOOK_MATCHER
    && Array.isArray(entry.hooks) && entry.hooks.length === 1
    && entry.hooks[0] && typeof entry.hooks[0] === "object"
    && entry.hooks[0].type === "command" && entry.hooks[0].command === command);
  if (alreadyExact) {
    return "skipped:claude-sessionstart-hook:already-present:new-sessions-only";
  }
  const { kept } = withoutMpactRefreshHooks(sessionStart);
  const next = {
    ...settings,
    hooks: {
      ...hooks,
      SessionStart: [...kept, { matcher: SESSIONSTART_HOOK_MATCHER, hooks: [{ type: "command", command }] }],
    },
  };
  atomicWriteFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  return `${existed ? "updated" : "created"}:claude-sessionstart-hook:SessionStart(${SESSIONSTART_HOOK_MATCHER}):new-sessions-only`;
}

function removeClaudeSessionStartHook(providerRoot) {
  const settingsPath = path.join(providerRoot, "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return `skipped:claude-sessionstart-hook:${settingsPath}:missing`;
  }
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (error) {
    return `blocked:claude-sessionstart-hook:${settingsPath}:invalid-json:${error.message}`;
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return `blocked:claude-sessionstart-hook:${settingsPath}:settings-not-object`;
  }
  if (settings.hooks === undefined) {
    return "skipped:claude-sessionstart-hook:no-hooks";
  }
  if (!settings.hooks || typeof settings.hooks !== "object" || Array.isArray(settings.hooks)) {
    return `blocked:claude-sessionstart-hook:${settingsPath}:hooks-not-object`;
  }
  if (settings.hooks.SessionStart === undefined) {
    return "skipped:claude-sessionstart-hook:no-SessionStart";
  }
  if (!Array.isArray(settings.hooks.SessionStart)) {
    return `blocked:claude-sessionstart-hook:${settingsPath}:SessionStart-not-array`;
  }
  const { kept, removed } = withoutMpactRefreshHooks(settings.hooks.SessionStart);
  if (removed === 0) {
    return "skipped:claude-sessionstart-hook:not-present";
  }
  const nextHooks = { ...settings.hooks };
  if (kept.length > 0) {
    nextHooks.SessionStart = kept;
  } else {
    delete nextHooks.SessionStart;
  }
  const next = { ...settings };
  if (Object.keys(nextHooks).length > 0) {
    next.hooks = nextHooks;
  } else {
    delete next.hooks;
  }
  atomicWriteFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  return `removed:claude-sessionstart-hook:${settingsPath}`;
}

function installCodexSessionStartHook(providerRoot) {
  const hooksPath = path.join(providerRoot, "hooks.json");
  const scriptPath = path.join(providerRoot, "skills", "m-pact", "scripts", "build-refresh-bundle.js");
  if (!fs.existsSync(scriptPath)) {
    return `blocked:codex-sessionstart-hook:missing-refresh-script:${scriptPath}`;
  }
  const command = refreshHookCommand(scriptPath);
  let document = {};
  const existed = fs.existsSync(hooksPath);
  if (existed) {
    try {
      document = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
    } catch (error) {
      return `blocked:codex-sessionstart-hook:${hooksPath}:invalid-json:${error.message}`;
    }
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      return `blocked:codex-sessionstart-hook:${hooksPath}:document-not-object`;
    }
  }
  if (document.hooks !== undefined && (!document.hooks || typeof document.hooks !== "object" || Array.isArray(document.hooks))) {
    return `blocked:codex-sessionstart-hook:${hooksPath}:hooks-not-object`;
  }
  const hooks = document.hooks || {};
  if (hooks.SessionStart !== undefined && !Array.isArray(hooks.SessionStart)) {
    return `blocked:codex-sessionstart-hook:${hooksPath}:SessionStart-not-array`;
  }
  const sessionStart = hooks.SessionStart || [];
  if (hasUnprunableMpactRefreshHooks(sessionStart)) {
    return `blocked:codex-sessionstart-hook:${hooksPath}:malformed-mpact-hook-entry`;
  }
  const alreadyExact = sessionStart.some((entry) => entry && typeof entry === "object" && entry.matcher === SESSIONSTART_HOOK_MATCHER
    && Array.isArray(entry.hooks) && entry.hooks.length === 1
    && entry.hooks[0] && typeof entry.hooks[0] === "object"
    && entry.hooks[0].type === "command" && entry.hooks[0].command === command);
  if (alreadyExact) {
    return "skipped:codex-sessionstart-hook:already-present:new-sessions-only:hooks-trust-review-may-still-be-required";
  }
  const { kept } = withoutMpactRefreshHooks(sessionStart);
  const next = {
    ...document,
    hooks: {
      ...hooks,
      SessionStart: [...kept, { matcher: SESSIONSTART_HOOK_MATCHER, hooks: [{ type: "command", command }] }],
    },
  };
  atomicWriteFile(hooksPath, `${JSON.stringify(next, null, 2)}\n`);
  return `${existed ? "updated" : "created"}:codex-sessionstart-hook:SessionStart(${SESSIONSTART_HOOK_MATCHER}):new-sessions-only:requires-hooks-trust-review`;
}

function removeCodexSessionStartHook(providerRoot) {
  const hooksPath = path.join(providerRoot, "hooks.json");
  if (!fs.existsSync(hooksPath)) {
    return `skipped:codex-sessionstart-hook:${hooksPath}:missing`;
  }
  let document;
  try {
    document = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  } catch (error) {
    return `blocked:codex-sessionstart-hook:${hooksPath}:invalid-json:${error.message}`;
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return `blocked:codex-sessionstart-hook:${hooksPath}:document-not-object`;
  }
  if (document.hooks === undefined) {
    return "skipped:codex-sessionstart-hook:no-hooks";
  }
  if (!document.hooks || typeof document.hooks !== "object" || Array.isArray(document.hooks)) {
    return `blocked:codex-sessionstart-hook:${hooksPath}:hooks-not-object`;
  }
  if (document.hooks.SessionStart === undefined) {
    return "skipped:codex-sessionstart-hook:no-SessionStart";
  }
  if (!Array.isArray(document.hooks.SessionStart)) {
    return `blocked:codex-sessionstart-hook:${hooksPath}:SessionStart-not-array`;
  }
  if (hasUnprunableMpactRefreshHooks(document.hooks.SessionStart)) {
    return `blocked:codex-sessionstart-hook:${hooksPath}:malformed-mpact-hook-entry`;
  }
  const { kept, removed } = withoutMpactRefreshHooks(document.hooks.SessionStart);
  if (removed === 0) {
    return "skipped:codex-sessionstart-hook:not-present";
  }
  const nextHooks = { ...document.hooks };
  if (kept.length > 0) {
    nextHooks.SessionStart = kept;
  } else {
    delete nextHooks.SessionStart;
  }
  const next = { ...document };
  if (Object.keys(nextHooks).length > 0) {
    next.hooks = nextHooks;
  } else {
    delete next.hooks;
  }
  atomicWriteFile(hooksPath, `${JSON.stringify(next, null, 2)}\n`);
  return `removed:codex-sessionstart-hook:${hooksPath}`;
}

function antigravityHooksPath(providerRoot) {
  return path.join(providerRoot, "config", "hooks.json");
}

function antigravitySettingsPath(providerRoot) {
  return path.join(providerRoot, "antigravity-cli", "settings.json");
}

function antigravityHookScriptPath(providerRoot) {
  return path.join(providerRoot, "config", "skills", "m-pact", "scripts", ANTIGRAVITY_HOOK_SCRIPT);
}

function antigravityHookEntry(command) {
  return {
    PreInvocation: [
      { type: "command", command },
    ],
  };
}

function isExactAntigravityHookEntry(entry, command) {
  return entry && typeof entry === "object" && !Array.isArray(entry)
    && Array.isArray(entry.PreInvocation)
    && entry.PreInvocation.length === 1
    && entry.PreInvocation[0]
    && typeof entry.PreInvocation[0] === "object"
    && entry.PreInvocation[0].type === "command"
    && entry.PreInvocation[0].command === command;
}

function malformedAntigravityHookEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return true;
  }
  if (entry.PreInvocation !== undefined && !Array.isArray(entry.PreInvocation)) {
    return true;
  }
  return false;
}

function installAntigravityPreInvocationHook(providerRoot) {
  const hooksPath = antigravityHooksPath(providerRoot);
  const scriptPath = antigravityHookScriptPath(providerRoot);
  if (!fs.existsSync(scriptPath)) {
    return `blocked:antigravity-preinvocation-hook:missing-refresh-script:${scriptPath}`;
  }
  const command = antigravityHookCommand(scriptPath);
  let document = {};
  const existed = fs.existsSync(hooksPath);
  if (existed) {
    try {
      document = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
    } catch (error) {
      return `blocked:antigravity-preinvocation-hook:${hooksPath}:invalid-json:${error.message}`;
    }
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      return `blocked:antigravity-preinvocation-hook:${hooksPath}:document-not-object`;
    }
  }
  if (document[ANTIGRAVITY_HOOK_NAME] !== undefined && malformedAntigravityHookEntry(document[ANTIGRAVITY_HOOK_NAME])) {
    return `blocked:antigravity-preinvocation-hook:${hooksPath}:malformed-mpact-hook-entry`;
  }
  if (isExactAntigravityHookEntry(document[ANTIGRAVITY_HOOK_NAME], command)) {
    return "skipped:antigravity-preinvocation-hook:already-present";
  }
  const next = {
    ...document,
    [ANTIGRAVITY_HOOK_NAME]: antigravityHookEntry(command),
  };
  atomicWriteFile(hooksPath, `${JSON.stringify(next, null, 2)}\n`);
  return `${existed ? "updated" : "created"}:antigravity-preinvocation-hook:${ANTIGRAVITY_HOOK_NAME}`;
}

function removeAntigravityPreInvocationHook(providerRoot) {
  const hooksPath = antigravityHooksPath(providerRoot);
  if (!fs.existsSync(hooksPath)) {
    return `skipped:antigravity-preinvocation-hook:${hooksPath}:missing`;
  }
  let document;
  try {
    document = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
  } catch (error) {
    return `blocked:antigravity-preinvocation-hook:${hooksPath}:invalid-json:${error.message}`;
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return `blocked:antigravity-preinvocation-hook:${hooksPath}:document-not-object`;
  }
  if (document[ANTIGRAVITY_HOOK_NAME] === undefined) {
    return "skipped:antigravity-preinvocation-hook:not-present";
  }
  if (malformedAntigravityHookEntry(document[ANTIGRAVITY_HOOK_NAME])) {
    return `blocked:antigravity-preinvocation-hook:${hooksPath}:malformed-mpact-hook-entry`;
  }
  const next = { ...document };
  delete next[ANTIGRAVITY_HOOK_NAME];
  atomicWriteFile(hooksPath, `${JSON.stringify(next, null, 2)}\n`);
  return `removed:antigravity-preinvocation-hook:${hooksPath}`;
}

function withTrailingSeparator(value) {
  return value.endsWith(path.sep) ? value : `${value}${path.sep}`;
}

function antigravityPermissionRule(action, targetPath) {
  return `${action}(${withTrailingSeparator(path.resolve(targetPath))})`;
}

function containsPermissionRule(values, rule) {
  return values.some((value) => {
    if (typeof value !== "string") {
      return false;
    }
    return process.platform === "win32"
      ? value.toLowerCase() === rule.toLowerCase()
      : value === rule;
  });
}

function grantAntigravityUserRootAccess(providerRoot, userRoot) {
  const settingsPath = antigravitySettingsPath(providerRoot);
  let settings = {};
  const existed = fs.existsSync(settingsPath);
  if (existed) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch (error) {
      return `blocked:antigravity-permissions:${settingsPath}:invalid-json:${error.message}`;
    }
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return `blocked:antigravity-permissions:${settingsPath}:settings-not-object`;
    }
  }
  if (settings.permissions !== undefined && (!settings.permissions || typeof settings.permissions !== "object" || Array.isArray(settings.permissions))) {
    return `blocked:antigravity-permissions:${settingsPath}:permissions-not-object`;
  }
  const permissions = settings.permissions || {};
  if (permissions.allow !== undefined && !Array.isArray(permissions.allow)) {
    return `blocked:antigravity-permissions:${settingsPath}:allow-not-array`;
  }
  const allow = permissions.allow || [];
  const desired = [
    antigravityPermissionRule("read_file", userRoot),
    antigravityPermissionRule("write_file", userRoot),
  ];
  const missing = desired.filter((rule) => !containsPermissionRule(allow, rule));
  if (missing.length === 0) {
    return `skipped:antigravity-permissions:${userRoot}:already-present`;
  }
  const next = {
    ...settings,
    permissions: {
      ...permissions,
      allow: [...allow, ...missing],
    },
  };
  atomicWriteFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  return `${existed ? "updated" : "created"}:antigravity-permissions:${userRoot}`;
}

function revokeAntigravityUserRootAccess(providerRoot, userRoot) {
  const settingsPath = antigravitySettingsPath(providerRoot);
  if (!fs.existsSync(settingsPath)) {
    return `skipped:antigravity-permissions:${userRoot}:settings-missing`;
  }
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (error) {
    return `blocked:antigravity-permissions:${settingsPath}:invalid-json:${error.message}`;
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return `blocked:antigravity-permissions:${settingsPath}:settings-not-object`;
  }
  if (settings.permissions === undefined) {
    return `skipped:antigravity-permissions:${userRoot}:permissions-missing`;
  }
  if (!settings.permissions || typeof settings.permissions !== "object" || Array.isArray(settings.permissions)) {
    return `blocked:antigravity-permissions:${settingsPath}:permissions-not-object`;
  }
  if (settings.permissions.allow === undefined) {
    return `skipped:antigravity-permissions:${userRoot}:not-present`;
  }
  if (!Array.isArray(settings.permissions.allow)) {
    return `blocked:antigravity-permissions:${settingsPath}:allow-not-array`;
  }
  const desired = [
    antigravityPermissionRule("read_file", userRoot),
    antigravityPermissionRule("write_file", userRoot),
  ];
  const kept = settings.permissions.allow.filter((rule) => !desired.some((desiredRule) => containsPermissionRule([rule], desiredRule)));
  const removed = settings.permissions.allow.length - kept.length;
  if (removed === 0) {
    return `skipped:antigravity-permissions:${userRoot}:not-present`;
  }
  const nextPermissions = { ...settings.permissions };
  if (kept.length > 0) {
    nextPermissions.allow = kept;
  } else {
    delete nextPermissions.allow;
  }
  const next = { ...settings, permissions: nextPermissions };
  pruneEmptyObjectProperty(next, "permissions");
  atomicWriteFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  return `removed:antigravity-permissions:${userRoot}:rules=${removed}`;
}

function siblingProjectMemoryReport(userRoot) {
  const sibling = path.join(path.dirname(userRoot), ".AgentMemory");
  return existsDir(sibling)
    ? `user-root:sibling-project-memory-present:${sibling}`
    : null;
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

function detectInstalledProvider(skillRoot, providerRoots) {
  const resolvedSkillRoot = fs.realpathSync(skillRoot);
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    const resolution = providerRoots[name];
    if (!resolution) {
      continue;
    }
    const installRoot = providerInstallRoot(name, resolution.root);
    if (!fs.existsSync(installRoot)) {
      continue;
    }
    if (fs.realpathSync(installRoot) === resolvedSkillRoot) {
      return name;
    }
  }
  return null;
}

function providerTargetReceipt(providerName, providerRoot) {
  const provider = PROVIDERS[providerName];
  const targets = [
    `shim=${providerShimTarget(providerName, providerRoot)}`,
    `hook=${providerHookTarget(providerName, providerRoot)}`,
    `skill=${providerInstallRoot(providerName, providerRoot)}`,
  ];
  if (provider.settingsTarget) {
    targets.push(`settings=${path.join(providerRoot, ...provider.settingsTarget)}`);
  }
  return `${providerName}:targets:${targets.join(";")}`;
}

function providerRootReceipt(providerName, resolution) {
  return `${providerName}:provider-root:${resolution.root}:source=${resolution.source}`;
}

function providerSelectionReceipt(providers, emptyMessage) {
  return `provider:${providers.length > 0 ? providers.join(",") : emptyMessage}`;
}

function installProviderRuntime({
  providerName,
  providerRoot,
  resolvedSkillRoot,
  resolvedUserRoot,
}) {
  const provider = PROVIDERS[providerName];
  const results = [];
  const shimTarget = providerShimTarget(providerName, providerRoot);
  results.push(`${providerName}:${installGlobalShim(resolvedSkillRoot, shimTarget, provider.shimSource)}`);
  if (providerName === "claude") {
    results.push(`claude:${grantClaudeUserRootAccess(providerRoot, resolvedUserRoot)}`);
    results.push(`claude:${installClaudeSessionStartHook(providerRoot)}`);
  } else if (providerName === "codex") {
    results.push(`codex:${installCodexSessionStartHook(providerRoot)}`);
  } else if (providerName === "antigravity") {
    results.push(`antigravity:${grantAntigravityUserRootAccess(providerRoot, resolvedUserRoot)}`);
    results.push(`antigravity:${installAntigravityPreInvocationHook(providerRoot)}`);
  }
  return results;
}

function disableProviderRuntime(providerName, providerRoot) {
  const results = [];
  results.push(`${providerName}:${removeGlobalShim(providerShimTarget(providerName, providerRoot))}`);
  if (providerName === "claude") {
    results.push(`claude:${removeClaudeSessionStartHook(providerRoot)}`);
  } else if (providerName === "codex") {
    results.push(`codex:${removeCodexSessionStartHook(providerRoot)}`);
  } else if (providerName === "antigravity") {
    results.push(`antigravity:${removeAntigravityPreInvocationHook(providerRoot)}`);
  }
  return results;
}

function revokeProviderUserRootAccess(providerName, providerRoot, userRoot) {
  if (providerName === "claude") {
    return [`claude:${revokeClaudeUserRootAccess(providerRoot, userRoot)}`];
  }
  if (providerName === "antigravity") {
    return [`antigravity:${revokeAntigravityUserRootAccess(providerRoot, userRoot)}`];
  }
  return [];
}

function resolveUserRootWithSource({
  args = {},
  userRoot = null,
  env = process.env,
} = {}) {
  assertStringFlagValues(args, ["user-root"]);
  if (userRoot) {
    return { root: path.resolve(userRoot), source: "argument" };
  }
  if (args["user-root"]) {
    return { root: path.resolve(args["user-root"]), source: "--user-root" };
  }
  if (env.MPACT_USER_ROOT && env.MPACT_USER_ROOT.trim()) {
    return { root: defaultUserRoot(env), source: "MPACT_USER_ROOT" };
  }
  return { root: defaultUserRoot(env), source: "default" };
}

function pathEqualsOrInside(childPath, parentPath) {
  const child = path.resolve(childPath);
  const parent = path.resolve(parentPath);
  const relative = path.relative(parent, child);
  const same = process.platform === "win32"
    ? child.toLowerCase() === parent.toLowerCase()
    : child === parent;
  return same || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function removeInstalledSkillDirectory(skillDir) {
  if (!fs.existsSync(skillDir)) {
    return `skipped:installed-skill:${skillDir}:missing`;
  }
  try {
    fs.rmSync(skillDir, { recursive: true, force: true });
    return `removed:installed-skill:${skillDir}`;
  } catch (error) {
    return `blocked:installed-skill:${skillDir}:${error.message}`;
  }
}

function hasBlockedResult(results) {
  return results.some((result) => String(result).includes(":blocked:") || String(result).startsWith("blocked:"));
}

function installMpactRuntime({
  args = {},
  skillRoot = path.dirname(path.dirname(__dirname)),
  home = null,
  userRoot = null,
  env = process.env,
} = {}) {
  assertStringFlagValues(args, ["user-root"]);
  const resolvedSkillRoot = path.resolve(skillRoot);
  const explicitProviders = selectedProviders(args.provider || args.providers);
  const allProviderNames = Object.keys(PROVIDERS);
  const providerRoots = resolveProviderRoots(allProviderNames, { args, home, env });
  const detectedProvider = detectInstalledProvider(resolvedSkillRoot, providerRoots);
  const providers = explicitProviders.length > 0
    ? explicitProviders
    : detectedProvider
      ? [detectedProvider]
      : [];
  const skipStarterRules = booleanArg(args, "skip-starter-rules");
  const resolvedUserRoot = path.resolve(userRoot || args["user-root"] || defaultUserRoot());
  const results = [];
  const externalActions = [];

  results.push(`skill-root:${resolvedSkillRoot}`);
  results.push(providerSelectionReceipt(providers, "(none detected; use --provider codex|claude|antigravity to install one shim)"));
  results.push(`user-root:${resolvedUserRoot}`);
  const siblingReport = siblingProjectMemoryReport(resolvedUserRoot);
  if (siblingReport) {
    results.push(siblingReport);
  }
  const counter = ensureCounterInitialized(resolvedUserRoot);
  results.push(`user-root:${counter.created ? "created" : "preserved"}:project-count__${counter.value}`);
  ensureScratchDirectory(resolvedUserRoot);
  results.push("user-root:created-or-present:.tmp");
  for (const result of installStarterRules(resolvedUserRoot, resolvedSkillRoot, skipStarterRules)) {
    results.push(`user-root:${result}`);
  }

  for (const providerName of providers) {
    const resolution = providerRoots[providerName];
    results.push(providerRootReceipt(providerName, resolution));
    results.push(providerTargetReceipt(providerName, resolution.root));
    const providerResults = installProviderRuntime({
      providerName,
      providerRoot: resolution.root,
      resolvedSkillRoot,
      resolvedUserRoot,
    });
    results.push(...providerResults);
    externalActions.push(...providerResults);
  }

  return { results, providers, providerRoots, skillRoot: resolvedSkillRoot, userRoot: resolvedUserRoot, externalActions };
}

function removeMpactShims({
  args = {},
  skillRoot = path.dirname(path.dirname(__dirname)),
  home = null,
  env = process.env,
} = {}) {
  const resolvedSkillRoot = path.resolve(skillRoot);
  const explicitProviders = selectedProviders(args.provider || args.providers);
  const allProviderNames = Object.keys(PROVIDERS);
  const providerRoots = resolveProviderRoots(allProviderNames, { args, home, env });
  const detectedProvider = detectInstalledProvider(resolvedSkillRoot, providerRoots);
  const providers = explicitProviders.length > 0
    ? explicitProviders
    : detectedProvider
      ? [detectedProvider]
      : [];
  const results = [];
  results.push(`skill-root:${resolvedSkillRoot}`);
  results.push(providerSelectionReceipt(providers, "(none detected; use --provider codex|claude|antigravity to disable one provider)"));
  for (const providerName of providers) {
    const resolution = providerRoots[providerName];
    results.push(providerRootReceipt(providerName, resolution));
    results.push(providerTargetReceipt(providerName, resolution.root));
    results.push(...disableProviderRuntime(providerName, resolution.root));
  }
  return { results, providers, providerRoots };
}

function uninstallMpactRuntime({
  args = {},
  skillRoot = path.dirname(path.dirname(__dirname)),
  home = null,
  userRoot = null,
  env = process.env,
  cwd = process.cwd(),
} = {}) {
  assertStringFlagValues(args, ["user-root"]);
  const explicitProviders = selectedProviders(args.provider || args.providers);
  const providers = explicitProviders.length > 0 ? explicitProviders : Object.keys(PROVIDERS);
  const providerRoots = resolveProviderRoots(providers, { args, home, env });
  const resolvedUserRoot = resolveUserRootWithSource({ args, userRoot, env });
  const results = [];

  for (const providerName of providers) {
    const skillDir = providerInstallRoot(providerName, providerRoots[providerName].root);
    if (pathEqualsOrInside(cwd, skillDir)) {
      throw new Error(`refusing to uninstall while the current working directory is inside ${skillDir}; run scripts/uninstall-mpact.js from another directory and try again`);
    }
  }

  results.push(`skill-root:${path.resolve(skillRoot)}`);
  results.push(providerSelectionReceipt(providers, providers.join(",")));
  results.push(`user-root:${resolvedUserRoot.root}:source=${resolvedUserRoot.source}`);
  results.push("memory:untouched");
  for (const providerName of providers) {
    const resolution = providerRoots[providerName];
    const skillDir = providerInstallRoot(providerName, resolution.root);
    results.push(providerRootReceipt(providerName, resolution));
    results.push(providerTargetReceipt(providerName, resolution.root));
    const providerResults = [
      ...disableProviderRuntime(providerName, resolution.root),
      ...revokeProviderUserRootAccess(providerName, resolution.root, resolvedUserRoot.root),
    ];
    results.push(...providerResults);
    if (hasBlockedResult(providerResults)) {
      results.push(`${providerName}:skipped:installed-skill:${skillDir}:blocked-provider-config`);
    } else {
      results.push(`${providerName}:${removeInstalledSkillDirectory(skillDir)}`);
    }
  }
  return { results, providers, providerRoots, userRoot: resolvedUserRoot.root };
}

module.exports = {
  PROVIDERS,
  grantAntigravityUserRootAccess,
  grantClaudeUserRootAccess,
  detectInstalledProvider,
  disableProviderRuntime,
  installAntigravityPreInvocationHook,
  installCodexSessionStartHook,
  installClaudeSessionStartHook,
  installGlobalShim,
  installMpactRuntime,
  isUserRootComplete,
  markerBounds,
  providerHookTarget,
  providerInstallRoot,
  providerRootReceipt,
  providerShimTarget,
  providerTargetReceipt,
  removeAntigravityPreInvocationHook,
  removeCodexSessionStartHook,
  removeClaudeSessionStartHook,
  removeGlobalShim,
  revokeAntigravityUserRootAccess,
  revokeClaudeUserRootAccess,
  resolveProviderRoot,
  resolveProviderRoots,
  resolveUserRootWithSource,
  removeMpactShims,
  uninstallMpactRuntime,
};
