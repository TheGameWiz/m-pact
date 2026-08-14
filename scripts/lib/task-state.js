#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { withDirectoryLock } = require("./directory-lock");

const TASK_FOLDER_PATTERN = /^[AC]__p[1234x]-t\d{4}-/;

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findActiveRoot(startPath = process.cwd()) {
  let cursor = path.resolve(startPath);
  if (!isDirectory(cursor)) {
    cursor = path.dirname(cursor);
  }
  while (true) {
    const candidate = path.join(cursor, ".AgentMemory");
    if (isDirectory(candidate)) {
      return fs.realpathSync(candidate);
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return null;
    }
    cursor = parent;
  }
}

function resolveRootPath(input = {}, args = {}) {
  const explicit = args.root;
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (!isDirectory(resolved)) {
      throw new Error(`rootPath is not a directory: ${resolved}`);
    }
    const folder = path.basename(resolved);
    if (folder !== ".AgentMemory" && folder !== ".AgentMemoryRoot") {
      throw new Error(`rootPath is not an M-PACT memory root: ${resolved}`);
    }
    return fs.realpathSync(resolved);
  }
  const discovered = findActiveRoot(process.cwd());
  if (!discovered) {
    throw new Error("no active .AgentMemory root found from current working directory");
  }
  return discovered;
}

function taskStateFromFolder(folder) {
  if (folder.startsWith("A__")) {
    return "A";
  }
  if (folder.startsWith("C__")) {
    return "C";
  }
  return null;
}

function assertAllowedState(taskPath, allowedStates) {
  const state = taskStateFromFolder(path.basename(taskPath));
  if (allowedStates && !allowedStates.includes(state)) {
    const label = state === "A" ? "active" : state === "C" ? "closed" : "unknown";
    throw new Error(`task state ${label} is not allowed for this operation: ${path.basename(taskPath)}`);
  }
}

function validateTaskPath(taskPath, { allowedStates = ["A", "C"], sameTasksPath = null } = {}) {
  const resolved = path.resolve(taskPath);
  if (!isDirectory(resolved)) {
    throw new Error(`taskPath is not a directory: ${resolved}`);
  }
  const folder = path.basename(resolved);
  if (!TASK_FOLDER_PATTERN.test(folder)) {
    throw new Error(`task folder name is invalid: ${folder}`);
  }
  const tasksPath = path.dirname(resolved);
  if (path.basename(tasksPath) !== "tasks") {
    throw new Error(`task folder is not directly under a tasks directory: ${resolved}`);
  }
  const rootPath = path.dirname(tasksPath);
  const rootName = path.basename(rootPath);
  if (rootName !== ".AgentMemory" && rootName !== ".AgentMemoryRoot") {
    throw new Error(`task folder is not under an M-PACT memory root: ${resolved}`);
  }
  if (sameTasksPath && fs.realpathSync(tasksPath) !== fs.realpathSync(sameTasksPath)) {
    throw new Error(`task must be directly under this root tasks folder: ${sameTasksPath}`);
  }
  const taskMd = path.join(resolved, "task.md");
  if (!isFile(taskMd)) {
    throw new Error(`task folder is missing task.md: ${resolved}`);
  }
  assertAllowedState(resolved, allowedStates);
  return {
    taskPath: fs.realpathSync(resolved),
    tasksPath: fs.realpathSync(tasksPath),
    rootPath: fs.realpathSync(rootPath),
    folder,
    state: taskStateFromFolder(folder),
  };
}

function findTaskById(tasksPath, taskValue) {
  if (!isDirectory(tasksPath)) {
    throw new Error("no tasks folder found and no task was provided");
  }
  const taskIdMatch = /^t?(\d{1,4})$/i.exec(String(taskValue).trim());
  if (!taskIdMatch) {
    return null;
  }
  const taskId = `t${taskIdMatch[1].padStart(4, "0")}`;
  const matches = fs.readdirSync(tasksPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.includes(`-${taskId}-`))
    .map((entry) => path.join(tasksPath, entry.name));
  if (matches.length === 0) {
    throw new Error(`task not found: ${taskId}`);
  }
  if (matches.length > 1) {
    throw new Error(`multiple tasks match ${taskId}`);
  }
  return matches[0];
}

function currentTaskPath(tasksPath) {
  if (!isDirectory(tasksPath)) {
    throw new Error("no tasks folder found and no task was provided");
  }
  const current = fs.readdirSync(tasksPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("current__"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  if (current.length > 1) {
    throw new Error(`multiple current task pointers found; no current task is selected: ${current.join(", ")}`);
  }
  if (current.length === 0) {
    throw new Error("no current task is selected");
  }
  const pointerName = current[0];
  const pointerPath = path.join(tasksPath, pointerName);
  if (fs.statSync(pointerPath).size !== 0) {
    throw new Error(`current task pointer must be zero-byte: ${pointerName}`);
  }
  return path.join(tasksPath, pointerName.slice("current__".length));
}

function resolveTaskPath(input = {}, args = {}, options = {}) {
  const allowedStates = options.allowedStates || ["A", "C"];
  const explicitTask = args.task || args["task-path"];
  const rootPath = resolveRootPath(input, args);
  const tasksPath = path.join(rootPath, "tasks");
  let candidate;

  const currentLookup = !explicitTask;
  if (currentLookup) {
    candidate = currentTaskPath(tasksPath);
  } else {
    candidate = findTaskById(tasksPath, explicitTask);
    if (!candidate) {
      const value = String(explicitTask);
      candidate = path.isAbsolute(value) ? path.resolve(value) : path.resolve(tasksPath, value);
    }
  }

  return validateTaskPath(candidate, {
    allowedStates: currentLookup ? ["A"] : allowedStates,
  }).taskPath;
}

function clearCurrentSentinels(tasksPath) {
  if (!isDirectory(tasksPath)) {
    return [];
  }
  const cleared = [];
  for (const entry of fs.readdirSync(tasksPath, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith("current__")) {
      fs.unlinkSync(path.join(tasksPath, entry.name));
      cleared.push(entry.name);
    }
  }
  return cleared;
}

function setCurrentTask(tasksPath, taskPath) {
  const validated = validateTaskPath(taskPath, {
    allowedStates: ["A"],
    sameTasksPath: tasksPath,
  });
  clearCurrentSentinels(tasksPath);
  const sentinel = `current__${validated.folder}`;
  fs.writeFileSync(path.join(tasksPath, sentinel), "");
  return sentinel;
}

function taskNumberFromFolder(folder) {
  const match = /-t(\d{4})-/.exec(folder);
  return match ? `t${match[1]}` : folder;
}

function sanitizeTaskSlug(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function taskFolderName({ state, priority, number, title }) {
  const prefix = String(state || "A").slice(0, 1);
  const taskNumber = typeof number === "number"
    ? `t${String(number).padStart(4, "0")}`
    : String(number || "").startsWith("t")
      ? String(number)
      : `t${String(number).padStart(4, "0")}`;
  const slug = (sanitizeTaskSlug(title) || "task").slice(0, 72).replace(/-+$/g, "") || "task";
  return `${prefix}__${priority}-${taskNumber}-${slug}`;
}

function taskOperationLockPath(taskPath) {
  return path.join(path.dirname(path.resolve(taskPath)), ".m-pact-task-locks", taskNumberFromFolder(path.basename(taskPath)));
}

function assertTaskFolderStillExists(taskPath) {
  const taskMd = path.join(path.resolve(taskPath), "task.md");
  if (!isFile(taskMd)) {
    throw new Error(`task folder moved or disappeared during operation; re-resolve the task and retry: ${path.resolve(taskPath)}`);
  }
}

function withTaskOperationLock(taskPath, fn) {
  return withDirectoryLock(taskOperationLockPath(taskPath), () => {
    assertTaskFolderStillExists(taskPath);
    return fn();
  });
}

function transitionTaskState({ taskPath, fromPrefix, toPrefix }) {
  const folder = path.basename(taskPath);
  const tasksPath = path.dirname(taskPath);
  const newFolder = folder.replace(new RegExp(`^${fromPrefix}__`), `${toPrefix}__`);
  const newPath = path.join(tasksPath, newFolder);
  if (fs.existsSync(newPath)) {
    throw new Error(`task transition target already exists: ${newPath}`);
  }
  fs.renameSync(taskPath, newPath);
  return {
    oldPath: taskPath,
    newPath,
    oldFolder: folder,
    newFolder,
    task: taskNumberFromFolder(folder),
    status: toPrefix === "A" ? "Active" : "Closed",
    tasksPath,
  };
}

module.exports = {
  TASK_FOLDER_PATTERN,
  clearCurrentSentinels,
  findActiveRoot,
  resolveRootPath,
  resolveTaskPath,
  setCurrentTask,
  taskOperationLockPath,
  taskFolderName,
  taskStateFromFolder,
  taskNumberFromFolder,
  transitionTaskState,
  validateTaskPath,
  withTaskOperationLock,
};
