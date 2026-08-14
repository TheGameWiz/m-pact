#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOCK_STALE_MS = 60 * 1000;
const LOCK_WAIT_MS = 100;
const LOCK_RETRY_COUNT = 10;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function lockMetadata(targetPath) {
  return {
    pid: process.pid,
    hostname: os.hostname(),
    command: process.argv.join(" "),
    targetPath: path.resolve(targetPath),
    createdAt: new Date().toISOString(),
  };
}

function readLock(lockPath) {
  let text;
  try {
    text = fs.readFileSync(lockPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function acquireDirectoryLock(targetPath) {
  const resolved = path.resolve(targetPath);
  fs.mkdirSync(resolved, { recursive: true });
  const lockPath = path.join(resolved, ".m-pact.lock");
  for (let attempt = 0; attempt <= LOCK_RETRY_COUNT; attempt++) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, JSON.stringify(lockMetadata(resolved), null, 2));
      fs.closeSync(fd);
      return lockPath;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
      let stat;
      try {
        stat = fs.statSync(lockPath);
      } catch (statError) {
        if (statError.code === "ENOENT") {
          continue;
        }
        throw statError;
      }
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > LOCK_STALE_MS) {
        const metadata = readLock(lockPath);
        try {
          fs.unlinkSync(lockPath);
        } catch (unlinkError) {
          if (unlinkError.code === "ENOENT") {
            continue;
          }
          throw new Error(`stale directory lock older than ${LOCK_STALE_MS}ms could not be removed: ${lockPath}${metadata ? ` ${JSON.stringify(metadata)}` : ""}; ${unlinkError.message}`);
        }
        continue;
      }
      if (attempt === LOCK_RETRY_COUNT) {
        throw new Error(`directory lock is busy: ${lockPath}`);
      }
      sleep(LOCK_WAIT_MS);
    }
  }
  throw new Error(`could not acquire directory lock: ${lockPath}`);
}

function releaseDirectoryLock(lockPath) {
  fs.unlinkSync(lockPath);
}

function withDirectoryLock(targetPath, fn) {
  const lockPath = acquireDirectoryLock(targetPath);
  try {
    return fn();
  } finally {
    releaseDirectoryLock(lockPath);
  }
}

module.exports = {
  acquireDirectoryLock,
  releaseDirectoryLock,
  withDirectoryLock,
};
