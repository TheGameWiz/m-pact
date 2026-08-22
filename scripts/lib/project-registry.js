"use strict";

const fs = require("fs");
const path = require("path");
const { withDirectoryLock } = require("./directory-lock");

const REGISTRY_FILE = "projects.json";

function registryPath(userRoot) {
  return path.join(path.resolve(userRoot), REGISTRY_FILE);
}

function normalizeCompare(filePath) {
  let resolved;
  try {
    resolved = fs.realpathSync(path.resolve(filePath));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    resolved = path.resolve(filePath);
  }
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function assertProjectId(projectId) {
  if (!Number.isSafeInteger(projectId) || projectId < 1) {
    throw new Error("registry projectId must be a positive safe integer");
  }
}

function validateEntry(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`registry entry ${index} must be an object`);
  }
  assertProjectId(entry.projectId);
  if (typeof entry.name !== "string" || entry.name.length === 0) {
    throw new Error(`registry entry ${index} name must be a non-empty string`);
  }
  if (typeof entry.path !== "string" || entry.path.length === 0) {
    throw new Error(`registry entry ${index} path must be a non-empty string`);
  }
  return { projectId: entry.projectId, name: entry.name, path: entry.path };
}

function readRegistryUnlocked(userRoot) {
  const filePath = registryPath(userRoot);
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`project registry is not valid JSON: ${filePath}; ${error.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`project registry must be a JSON array: ${filePath}`);
  }
  return parsed.map(validateEntry);
}

function atomicWriteFile(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.m-pact-${process.pid}-${Date.now()}-${path.basename(filePath)}.tmp`);
  fs.writeFileSync(tempPath, body, "utf8");
  fs.renameSync(tempPath, filePath);
}

function writeRegistryUnlocked(userRoot, entries) {
  atomicWriteFile(registryPath(userRoot), `${JSON.stringify(entries, null, 2)}\n`);
}

function publicEntryForProject(projectId, projectPath) {
  assertProjectId(projectId);
  const resolvedPath = fs.realpathSync(path.resolve(projectPath));
  return {
    projectId,
    name: path.basename(resolvedPath),
    path: resolvedPath,
  };
}

function upsertProject(userRoot, { projectId, path: projectPath }) {
  const resolvedUserRoot = path.resolve(userRoot);
  return withDirectoryLock(resolvedUserRoot, () => {
    const nextEntry = publicEntryForProject(projectId, projectPath);
    const nextCompare = normalizeCompare(nextEntry.path);
    const entries = readRegistryUnlocked(resolvedUserRoot)
      .filter((entry) => entry.projectId !== nextEntry.projectId)
      .filter((entry) => normalizeCompare(entry.path) !== nextCompare);
    entries.push(nextEntry);
    entries.sort((a, b) => a.projectId - b.projectId);
    writeRegistryUnlocked(resolvedUserRoot, entries);
    return nextEntry;
  });
}

function sweepMissingProjects(userRoot) {
  const resolvedUserRoot = path.resolve(userRoot);
  return withDirectoryLock(resolvedUserRoot, () => {
    const entries = readRegistryUnlocked(resolvedUserRoot);
    const kept = entries.filter((entry) => fs.existsSync(entry.path));
    if (kept.length !== entries.length || !fs.existsSync(registryPath(resolvedUserRoot))) {
      writeRegistryUnlocked(resolvedUserRoot, kept);
    }
    return { before: entries.length, after: kept.length, removed: entries.length - kept.length };
  });
}

function maintainProjectRegistry(userRoot, identity) {
  const projectPath = path.dirname(identity.rootPath);
  const entry = upsertProject(userRoot, { projectId: identity.projectId, path: projectPath });
  const sweep = sweepMissingProjects(userRoot);
  return { entry, sweep };
}

module.exports = {
  maintainProjectRegistry,
  normalizeCompare,
  readRegistryUnlocked,
  registryPath,
  sweepMissingProjects,
  upsertProject,
};
