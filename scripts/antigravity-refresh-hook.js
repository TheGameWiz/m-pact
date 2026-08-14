#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");

const HOOK_NAME = "m-pact-refresh";
const MAX_STATE_CONVERSATIONS = 50;
const NO_WORKSPACE_NOTICE = "M-PACT ANTIGRAVITY HOOK: no workspace bound; M-PACT idle.";

function readHookPayload() {
  try {
    const text = fs.readFileSync(0, "utf8").trim();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    inject(`M-PACT ANTIGRAVITY HOOK ERROR: could not parse PreInvocation payload: ${error.message}`);
    process.exit(0);
  }
}

function inject(ephemeralMessage) {
  process.stdout.write(`${JSON.stringify({ injectSteps: [{ ephemeralMessage }] })}\n`);
}

function statePath() {
  return path.join(os.homedir(), ".gemini", "config", "m-pact-refresh-state.json");
}

function normalizeState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};
  const conversations = {};

  if (state.conversations && typeof state.conversations === "object" && !Array.isArray(state.conversations)) {
    for (const [conversationId, entry] of Object.entries(state.conversations)) {
      if (!conversationId || !entry || typeof entry !== "object" || typeof entry.bundlePath !== "string" || !entry.bundlePath) {
        continue;
      }
      conversations[conversationId] = {
        bundlePath: entry.bundlePath,
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : "",
      };
    }
  } else if (typeof state.conversationId === "string" && state.conversationId && typeof state.bundlePath === "string" && state.bundlePath) {
    conversations[state.conversationId] = {
      bundlePath: state.bundlePath,
      updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : "",
    };
  }

  return { version: 1, conversations: pruneConversations(conversations) };
}

function readState() {
  const filePath = statePath();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return normalizeState({});
  }
}

function writeState(state) {
  const filePath = statePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(normalizeState(state), null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function conversationTimestamp(entry) {
  const time = Date.parse(entry.updatedAt);
  return Number.isFinite(time) ? time : 0;
}

function pruneConversations(conversations, maxEntries = MAX_STATE_CONVERSATIONS) {
  return Object.fromEntries(Object.entries(conversations)
    .sort(([, left], [, right]) => conversationTimestamp(right) - conversationTimestamp(left))
    .slice(0, maxEntries));
}

function rememberConversation(state, conversationId, bundlePath, now = new Date()) {
  if (!conversationId || !bundlePath) {
    return normalizeState(state);
  }
  const normalized = normalizeState(state);
  normalized.conversations[conversationId] = {
    bundlePath,
    updatedAt: now.toISOString(),
  };
  return normalizeState(normalized);
}

function rememberConversationInStateFile(conversationId, bundlePath) {
  if (!conversationId || !bundlePath) {
    return;
  }
  withDirectoryLock(path.dirname(statePath()), () => {
    writeState(rememberConversation(readState(), conversationId, bundlePath));
  });
}

function bundlePathFromStdout(stdout) {
  const match = /^BundlePath:\s*(.+)$/m.exec(stdout);
  return match ? match[1].trim() : null;
}

function activeProjectRootFromStdout(stdout) {
  const match = /^activeProjectRoot=([^;\r\n]+);/m.exec(stdout);
  if (!match) {
    return null;
  }
  const root = match[1].trim();
  return root && !root.startsWith("(") ? root : null;
}

function normalizePathForContainment(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isInsideOrEqual(filePath, directoryPath) {
  const file = normalizePathForContainment(filePath);
  const directory = normalizePathForContainment(directoryPath);
  const relative = path.relative(directory, file);
  return relative === "" || (Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function refreshArgsForPayload(payload) {
  const workspaces = Array.isArray(payload.workspacePaths)
    ? payload.workspacePaths.filter((value) => typeof value === "string" && value.trim())
    : [];
  if (workspaces.length > 1) {
    return {
      ok: false,
      message: `M-PACT ANTIGRAVITY HOOK: ${workspaces.length} workspace paths were provided; refusing to guess which project memory root to refresh.`,
    };
  }
  if (workspaces.length === 0) {
    return { ok: false, message: NO_WORKSPACE_NOTICE };
  }
  return { ok: true, args: ["--StartPath", workspaces[0]], workspacePaths: workspaces };
}

function runRefresh(extraArgs) {
  const refreshScript = path.join(__dirname, "build-refresh-bundle.js");
  return spawnSync(process.execPath, [refreshScript, "--hook", ...extraArgs], {
    cwd: os.homedir(),
    encoding: "utf8",
    windowsHide: true,
  });
}

function injectedRefreshMessage(stdout, stderr) {
  const trimmedStdout = stdout.trimEnd();
  const trimmedStderr = stderr.trimEnd();
  if (trimmedStderr && trimmedStdout) {
    return `${trimmedStderr}\n${trimmedStdout}`;
  }
  return trimmedStdout || trimmedStderr;
}

function workspaceBoundaryNotice(stdout, workspacePaths) {
  const activeRoot = activeProjectRootFromStdout(stdout);
  if (!activeRoot || !Array.isArray(workspacePaths) || workspacePaths.length === 0) {
    return "";
  }
  if (workspacePaths.some((workspacePath) => isInsideOrEqual(activeRoot, workspacePath))) {
    return "";
  }
  return `M-PACT ANTIGRAVITY NOTICE: active project root ${activeRoot} is outside the bound workspace ${workspacePaths.join(", ")}. Provider file-access policy may prompt on or block writes there; creating a local .AgentMemory root in the workspace folder is the alternative.`;
}

function injectedRefreshMessageForWorkspace(stdout, stderr, workspacePaths) {
  const message = injectedRefreshMessage(stdout, stderr);
  const notice = workspaceBoundaryNotice(stdout, workspacePaths);
  return notice ? `${notice}\n${message}` : message;
}

function main() {
  const payload = readHookPayload();
  if (Number(payload.invocationNum) !== 1) {
    return;
  }

  const resolved = refreshArgsForPayload(payload);
  if (!resolved.ok) {
    inject(resolved.message);
    return;
  }

  const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : "";
  const state = readState();
  const conversationState = conversationId ? state.conversations[conversationId] : null;
  if (conversationState && conversationState.bundlePath) {
    inject(`M-PACT ANTIGRAVITY REFRESH: same conversation. If the refresh bundle content is no longer in context, read ${conversationState.bundlePath}, verify its final line is END REFRESH BUNDLE, emit the receipt body, then continue.`);
    return;
  }

  const result = runRefresh(resolved.args);
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const bundlePath = bundlePathFromStdout(stdout);
  rememberConversationInStateFile(conversationId, bundlePath);
  inject(injectedRefreshMessageForWorkspace(stdout, stderr, resolved.workspacePaths));
}

if (require.main === module) {
  main();
}

module.exports = {
  MAX_STATE_CONVERSATIONS,
  NO_WORKSPACE_NOTICE,
  activeProjectRootFromStdout,
  injectedRefreshMessage,
  injectedRefreshMessageForWorkspace,
  isInsideOrEqual,
  normalizeState,
  pruneConversations,
  rememberConversation,
  rememberConversationInStateFile,
  workspaceBoundaryNotice,
};
