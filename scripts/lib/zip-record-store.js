#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const zlib = require("zlib");

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const COMPRESSION_STORE = 0;
const COMPRESSION_DEFLATE = 8;
const UTF8_FLAG = 1 << 11;
const ZIP_VERSION_DEFLATE = 20;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;
const MAX_EOCD_SEARCH = 22 + MAX_UINT16;
const LOCK_STALE_MS = 60 * 1000;
const LOCK_WAIT_MS = 100;
const LOCK_RETRY_COUNT = 10;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dateFromDos(dosDate, dosTime) {
  const day = dosDate & 0x1f;
  const month = (dosDate >>> 5) & 0x0f;
  const year = ((dosDate >>> 9) & 0x7f) + 1980;
  const second = (dosTime & 0x1f) * 2;
  const minute = (dosTime >>> 5) & 0x3f;
  const hour = (dosTime >>> 11) & 0x1f;
  return new Date(year, month - 1, day, hour, minute, second);
}

function dateToDos(date) {
  const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = Math.min(Math.max(value.getFullYear(), 1980), 2107);
  const month = value.getMonth() + 1;
  const day = value.getDate();
  const hour = value.getHours();
  const minute = value.getMinutes();
  const second = Math.floor(value.getSeconds() / 2);
  return {
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
    dosTime: (hour << 11) | (minute << 5) | second,
  };
}

function assertUInt16(value, label) {
  if (value < 0 || value > MAX_UINT16) {
    throw new Error(`${label} exceeds ZIP uint16 limit`);
  }
}

function assertUInt32(value, label) {
  if (value < 0 || value > MAX_UINT32) {
    throw new Error(`${label} exceeds ZIP uint32 limit`);
  }
}

function validateMemberName(name) {
  if (!name || typeof name !== "string") {
    throw new Error("ZIP member name is required");
  }
  if (Buffer.byteLength(name, "utf8") > MAX_UINT16) {
    throw new Error("ZIP member name is too long for ZIP headers");
  }
  if (name.includes("\0")) {
    throw new Error("ZIP member name must not contain NUL");
  }
  if (name.includes("\\") || path.isAbsolute(name) || name.startsWith("/") || name.includes("../") || name.includes("..\\")) {
    throw new Error(`unsafe ZIP member name: ${name}`);
  }
}

function findEocd(buffer) {
  const minOffset = Math.max(0, buffer.length - MAX_EOCD_SEARCH);
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  throw new Error("ZIP end-of-central-directory record was not found");
}

function readZipEntriesUnlocked(zipPath) {
  if (!fs.existsSync(zipPath)) {
    return [];
  }

  const archive = fs.readFileSync(zipPath);
  if (archive.length === 0) {
    return [];
  }

  const eocdOffset = findEocd(archive);
  const totalEntries = archive.readUInt16LE(eocdOffset + 10);
  const centralSize = archive.readUInt32LE(eocdOffset + 12);
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);
  if (centralOffset === MAX_UINT32 || centralSize === MAX_UINT32) {
    throw new Error("Zip64 archives are not supported by this helper slice");
  }
  if (centralOffset + centralSize > archive.length) {
    throw new Error("ZIP central directory extends past end of file");
  }

  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index++) {
    if (archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_HEADER) {
      throw new Error(`invalid central directory header at offset ${offset}`);
    }

    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const dosTime = archive.readUInt16LE(offset + 12);
    const dosDate = archive.readUInt16LE(offset + 14);
    const expectedCrc = archive.readUInt32LE(offset + 16);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);

    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const name = archive.toString((flags & UTF8_FLAG) ? "utf8" : "utf8", nameStart, nameEnd);
    validateMemberName(name);

    if (localOffset === MAX_UINT32 || compressedSize === MAX_UINT32 || uncompressedSize === MAX_UINT32) {
      throw new Error(`Zip64 entry is not supported: ${name}`);
    }
    if (archive.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
      throw new Error(`invalid local file header for ${name}`);
    }

    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.length) {
      throw new Error(`compressed data extends past end of archive for ${name}`);
    }

    const compressed = archive.subarray(dataStart, dataEnd);
    let content;
    if (method === COMPRESSION_DEFLATE) {
      content = zlib.inflateRawSync(compressed);
    } else if (method === COMPRESSION_STORE) {
      content = Buffer.from(compressed);
    } else {
      throw new Error(`unsupported compression method ${method} for ${name}`);
    }

    if (content.length !== uncompressedSize) {
      throw new Error(`uncompressed size mismatch for ${name}`);
    }
    if (crc32(content) !== expectedCrc) {
      throw new Error(`CRC mismatch for ${name}`);
    }

    entries.push({
      name,
      content,
      modified: dateFromDos(dosDate, dosTime),
    });

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function readZipEntries(zipPath) {
  const targetLockPath = acquireLock(zipPath);
  try {
    return readZipEntriesUnlocked(zipPath);
  } finally {
    releaseLock(targetLockPath);
  }
}

function restoreArchive(zipPath, original, existed) {
  if (existed) {
    fs.writeFileSync(zipPath, original);
  } else if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function lockPathForZip(zipPath) {
  return `${zipPath}.lock`;
}

function lockMetadata(zipPath) {
  return {
    pid: process.pid,
    hostname: os.hostname(),
    command: process.argv.join(" "),
    zipPath: path.resolve(zipPath),
    createdAt: new Date().toISOString(),
  };
}

function readLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}

function acquireLock(zipPath) {
  const targetLockPath = lockPathForZip(zipPath);
  fs.mkdirSync(path.dirname(targetLockPath), { recursive: true });
  for (let attempt = 0; attempt <= LOCK_RETRY_COUNT; attempt++) {
    try {
      const fd = fs.openSync(targetLockPath, "wx");
      fs.writeFileSync(fd, JSON.stringify(lockMetadata(zipPath), null, 2));
      fs.closeSync(fd);
      return targetLockPath;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
      const stat = fs.statSync(targetLockPath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > LOCK_STALE_MS) {
        const metadata = readLock(targetLockPath);
        throw new Error(`stale ZIP lock older than ${LOCK_STALE_MS}ms: ${targetLockPath}${metadata ? ` ${JSON.stringify(metadata)}` : ""}`);
      }
      if (attempt === LOCK_RETRY_COUNT) {
        throw new Error(`ZIP lock is busy: ${targetLockPath}`);
      }
      sleep(LOCK_WAIT_MS);
    }
  }
  throw new Error(`could not acquire ZIP lock: ${targetLockPath}`);
}

function releaseLock(lockPath) {
  fs.unlinkSync(lockPath);
}

function buildZipArchive(entries) {
  assertUInt16(entries.length, "ZIP member count");
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    validateMemberName(entry.name);
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(String(entry.content), "utf8");
    const compressed = zlib.deflateRawSync(content);
    const checksum = crc32(content);
    const { dosDate, dosTime } = dateToDos(entry.modified);

    assertUInt32(offset, `local header offset for ${entry.name}`);
    assertUInt32(compressed.length, `compressed size for ${entry.name}`);
    assertUInt32(content.length, `uncompressed size for ${entry.name}`);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER, 0);
    localHeader.writeUInt16LE(ZIP_VERSION_DEFLATE, 4);
    localHeader.writeUInt16LE(UTF8_FLAG, 6);
    localHeader.writeUInt16LE(COMPRESSION_DEFLATE, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_HEADER, 0);
    centralHeader.writeUInt16LE(ZIP_VERSION_DEFLATE, 4);
    centralHeader.writeUInt16LE(ZIP_VERSION_DEFLATE, 6);
    centralHeader.writeUInt16LE(UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(COMPRESSION_DEFLATE, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  assertUInt32(centralOffset, "central directory offset");
  assertUInt32(centralSize, "central directory size");

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function writeMemberWithNodeZip(zipPath, memberName, content, modified = new Date(), { replace = false } = {}) {
  validateMemberName(memberName);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  const targetLockPath = acquireLock(zipPath);
  let existed = false;
  let original = Buffer.alloc(0);
  try {
    existed = fs.existsSync(zipPath);
    original = existed ? fs.readFileSync(zipPath) : Buffer.alloc(0);
    const entries = readZipEntriesUnlocked(zipPath);
    const existingIndex = entries.findIndex((entry) => entry.name === memberName);
    if (!replace && existingIndex !== -1) {
      throw new Error(`ZIP member already exists: ${memberName}`);
    }
    if (replace && existingIndex === -1) {
      throw new Error(`ZIP member does not exist: ${memberName}`);
    }

    const nextEntry = {
      name: memberName,
      content: Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8"),
      modified,
    };
    if (replace) {
      entries[existingIndex] = nextEntry;
    } else {
      entries.push(nextEntry);
    }

    const archive = buildZipArchive(entries);
    fs.writeFileSync(zipPath, archive);
    return {
      bytes: archive.length,
      strategy: "node-zlib-deflate",
      attempts: 1,
    };
  } catch (error) {
    restoreArchive(zipPath, original, existed);
    throw error;
  } finally {
    releaseLock(targetLockPath);
  }
}

function listMembers(zipPath) {
  return readZipEntries(zipPath).map((entry) => ({
    name: entry.name,
    size: entry.content.length,
    modified: entry.modified.toISOString(),
  }));
}

function readMember(zipPath, memberName) {
  const entry = readZipEntries(zipPath).find((candidate) => candidate.name === memberName);
  if (!entry) {
    throw new Error(`ZIP member not found: ${memberName}`);
  }
  return entry.content;
}

function appendMember(zipPath, memberName, content, modified = new Date()) {
  return writeMemberWithNodeZip(zipPath, memberName, content, modified, { replace: false });
}

function replaceMember(zipPath, memberName, content, modified = new Date()) {
  return writeMemberWithNodeZip(zipPath, memberName, content, modified, { replace: true });
}

module.exports = {
  appendMember,
  listMembers,
  readMember,
  readZipEntries,
  replaceMember,
  validateMemberName,
};
