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
const DATA_DESCRIPTOR_FLAG = 1 << 3;
const ZIP_VERSION_DEFLATE = 20;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;
const LOCK_STALE_MS = 60 * 1000;
const LOCK_WAIT_MS = 100;
const LOCK_RETRY_COUNT = 10;
const COPY_CHUNK_SIZE = 64 * 1024;

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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function lockPathForZip(zipPath) {
  return `${zipPath}.lock`;
}

function tempPathForZip(zipPath) {
  return `${zipPath}.tmp`;
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

function cleanupTemp(zipPath) {
  const tmpPath = tempPathForZip(zipPath);
  if (fs.existsSync(tmpPath)) {
    fs.unlinkSync(tmpPath);
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
      cleanupTemp(zipPath);
      return targetLockPath;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
      const stat = fs.statSync(targetLockPath);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > LOCK_STALE_MS) {
        const metadata = readLock(targetLockPath);
        try {
          fs.unlinkSync(targetLockPath);
        } catch (unlinkError) {
          throw new Error(`stale ZIP lock older than ${LOCK_STALE_MS}ms could not be removed: ${targetLockPath}${metadata ? ` ${JSON.stringify(metadata)}` : ""}; ${unlinkError.message}`);
        }
        continue;
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

function readBufferAt(fd, offset, length) {
  const buffer = Buffer.alloc(length);
  const bytesRead = fs.readSync(fd, buffer, 0, length, offset);
  if (bytesRead !== length) {
    throw new Error(`could not read ${length} bytes at offset ${offset}`);
  }
  return buffer;
}

function decodeName(buffer, flags) {
  return buffer.toString("utf8");
}

function assertSupportedEntry(entry, label) {
  if (entry.flags & DATA_DESCRIPTOR_FLAG) {
    throw new Error(`ZIP data descriptors are not supported for ${label}`);
  }
  if (entry.localOffset === MAX_UINT32 || entry.compressedSize === MAX_UINT32 || entry.uncompressedSize === MAX_UINT32) {
    throw new Error(`Zip64 entry is not supported: ${label}`);
  }
  if (entry.method !== COMPRESSION_DEFLATE && entry.method !== COMPRESSION_STORE) {
    throw new Error(`unsupported compression method ${entry.method} for ${label}`);
  }
}

function parseLocalHeader(fd, offset, fileSize = null) {
  if (fileSize !== null && offset + 30 > fileSize) {
    throw new Error(`local file header extends past end of file at offset ${offset}`);
  }
  const header = readBufferAt(fd, offset, 30);
  if (header.readUInt32LE(0) !== LOCAL_FILE_HEADER) {
    throw new Error(`invalid local file header at offset ${offset}`);
  }
  const flags = header.readUInt16LE(6);
  const method = header.readUInt16LE(8);
  const dosTime = header.readUInt16LE(10);
  const dosDate = header.readUInt16LE(12);
  const expectedCrc = header.readUInt32LE(14);
  const compressedSize = header.readUInt32LE(18);
  const uncompressedSize = header.readUInt32LE(22);
  const nameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);
  const nameBuffer = readBufferAt(fd, offset + 30, nameLength);
  const name = decodeName(nameBuffer, flags);
  validateMemberName(name);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  const entry = {
    name,
    flags,
    method,
    dosTime,
    dosDate,
    expectedCrc,
    compressedSize,
    uncompressedSize,
    localOffset: offset,
    localNameLength: nameLength,
    localExtraLength: extraLength,
    dataStart,
    dataEnd,
    modified: dateFromDos(dosDate, dosTime),
    versionMadeBy: ZIP_VERSION_DEFLATE,
    versionNeeded: header.readUInt16LE(4),
    centralExtra: Buffer.alloc(0),
    centralComment: Buffer.alloc(0),
    diskStart: 0,
    internalAttrs: 0,
    externalAttrs: 0,
  };
  assertSupportedEntry(entry, name);
  if (fileSize !== null && dataEnd > fileSize) {
    throw new Error(`compressed data extends past end of archive for ${name}`);
  }
  return entry;
}

function inflateEntryPayload(compressed, entry) {
  let content;
  if (entry.method === COMPRESSION_DEFLATE) {
    content = zlib.inflateRawSync(compressed);
  } else if (entry.method === COMPRESSION_STORE) {
    content = Buffer.from(compressed);
  } else {
    throw new Error(`unsupported compression method ${entry.method} for ${entry.name}`);
  }
  if (content.length !== entry.uncompressedSize) {
    throw new Error(`uncompressed size mismatch for ${entry.name}`);
  }
  if (crc32(content) !== entry.expectedCrc) {
    throw new Error(`CRC mismatch for ${entry.name}`);
  }
  return content;
}

function readMemberContentUnlocked(zipPath, entry) {
  const fd = fs.openSync(zipPath, "r");
  try {
    const stat = fs.fstatSync(fd);
    const local = parseLocalHeader(fd, entry.localOffset, stat.size);
    if (local.name !== entry.name) {
      throw new Error(`local header name mismatch for ${entry.name}`);
    }
    if (local.method !== entry.method || local.compressedSize !== entry.compressedSize || local.uncompressedSize !== entry.uncompressedSize || local.expectedCrc !== entry.expectedCrc) {
      throw new Error(`local header metadata mismatch for ${entry.name}`);
    }
    const compressed = readBufferAt(fd, local.dataStart, local.compressedSize);
    return inflateEntryPayload(compressed, local);
  } finally {
    fs.closeSync(fd);
  }
}

function tryValidateContent(fd, entry) {
  try {
    const compressed = readBufferAt(fd, entry.dataStart, entry.compressedSize);
    inflateEntryPayload(compressed, entry);
    return true;
  } catch {
    return false;
  }
}

function walkLocalHeadersUnlocked(zipPath, { validateContent = false } = {}) {
  if (!fs.existsSync(zipPath)) {
    return { entries: [], localEnd: 0 };
  }
  const fd = fs.openSync(zipPath, "r");
  try {
    const stat = fs.fstatSync(fd);
    const entries = [];
    const seenNames = new Set();
    let offset = 0;
    while (offset + 4 <= stat.size) {
      const signature = readBufferAt(fd, offset, 4).readUInt32LE(0);
      if (signature !== LOCAL_FILE_HEADER) {
        break;
      }
      let entry;
      try {
        entry = parseLocalHeader(fd, offset, stat.size);
      } catch {
        break;
      }
      if (seenNames.has(entry.name)) {
        break;
      }
      if (validateContent && !tryValidateContent(fd, entry)) {
        break;
      }
      entries.push(entry);
      seenNames.add(entry.name);
      offset = entry.dataEnd;
    }
    return { entries, localEnd: offset };
  } finally {
    fs.closeSync(fd);
  }
}

function parseCentralDirectoryBuffer(buffer, totalEntries, centralSize) {
  const entries = [];
  const seenNames = new Set();
  let offset = 0;
  for (let index = 0; index < totalEntries; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_HEADER) {
      return null;
    }
    const versionMadeBy = buffer.readUInt16LE(offset + 4);
    const versionNeeded = buffer.readUInt16LE(offset + 6);
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const dosTime = buffer.readUInt16LE(offset + 12);
    const dosDate = buffer.readUInt16LE(offset + 14);
    const expectedCrc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLengthForEntry = buffer.readUInt16LE(offset + 32);
    const diskStart = buffer.readUInt16LE(offset + 34);
    const internalAttrs = buffer.readUInt16LE(offset + 36);
    const externalAttrs = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const extraEnd = nameEnd + extraLength;
    const commentEnd = extraEnd + commentLengthForEntry;
    if (commentEnd > buffer.length || commentEnd > centralSize) {
      return null;
    }
    const name = decodeName(buffer.subarray(nameStart, nameEnd), flags);
    validateMemberName(name);
    const entry = {
      name,
      flags,
      method,
      dosTime,
      dosDate,
      expectedCrc,
      compressedSize,
      uncompressedSize,
      localOffset,
      modified: dateFromDos(dosDate, dosTime),
      versionMadeBy,
      versionNeeded,
      centralExtra: Buffer.from(buffer.subarray(nameEnd, extraEnd)),
      centralComment: Buffer.from(buffer.subarray(extraEnd, commentEnd)),
      diskStart,
      internalAttrs,
      externalAttrs,
    };
    assertSupportedEntry(entry, name);
    if (seenNames.has(name)) {
      return null;
    }
    seenNames.add(name);
    entries.push(entry);
    offset = commentEnd;
  }
  if (offset !== centralSize) {
    return null;
  }
  return entries;
}

function readCatalogFromEocdUnlocked(zipPath) {
  const fd = fs.openSync(zipPath, "r");
  try {
    const fileSize = fs.fstatSync(fd).size;
    if (fileSize === 0) {
      return [];
    }
    if (fileSize < 22) {
      return null;
    }
    const eocdOffset = fileSize - 22;
    const eocd = readBufferAt(fd, eocdOffset, 22);
    if (eocd.readUInt32LE(0) !== END_OF_CENTRAL_DIRECTORY) {
      return null;
    }
    const diskNumber = eocd.readUInt16LE(4);
    const centralDisk = eocd.readUInt16LE(6);
    const entriesOnDisk = eocd.readUInt16LE(8);
    const totalEntries = eocd.readUInt16LE(10);
    const centralSize = eocd.readUInt32LE(12);
    const centralOffset = eocd.readUInt32LE(16);
    const commentLength = eocd.readUInt16LE(20);
    if (commentLength !== 0 || diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
      return null;
    }
    if (totalEntries === MAX_UINT16 || centralOffset === MAX_UINT32 || centralSize === MAX_UINT32) {
      throw new Error("Zip64 archives are not supported by this helper slice");
    }
    if (centralOffset + centralSize !== eocdOffset) {
      return null;
    }
    const central = readBufferAt(fd, centralOffset, centralSize);
    return parseCentralDirectoryBuffer(central, totalEntries, centralSize);
  } finally {
    fs.closeSync(fd);
  }
}

function readAppendMetadataFromEocdUnlocked(zipPath) {
  if (!fs.existsSync(zipPath)) {
    return {
      totalEntries: 0,
      centralOffset: 0,
      centralSize: 0,
      oldCentral: Buffer.alloc(0),
    };
  }
  const fd = fs.openSync(zipPath, "r");
  try {
    const fileSize = fs.fstatSync(fd).size;
    if (fileSize === 0) {
      return {
        totalEntries: 0,
        centralOffset: 0,
        centralSize: 0,
        oldCentral: Buffer.alloc(0),
      };
    }
    if (fileSize < 22) {
      return null;
    }
    const eocdOffset = fileSize - 22;
    const eocd = readBufferAt(fd, eocdOffset, 22);
    if (eocd.readUInt32LE(0) !== END_OF_CENTRAL_DIRECTORY) {
      return null;
    }
    const diskNumber = eocd.readUInt16LE(4);
    const centralDisk = eocd.readUInt16LE(6);
    const entriesOnDisk = eocd.readUInt16LE(8);
    const totalEntries = eocd.readUInt16LE(10);
    const centralSize = eocd.readUInt32LE(12);
    const centralOffset = eocd.readUInt32LE(16);
    const commentLength = eocd.readUInt16LE(20);
    if (commentLength !== 0 || diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
      return null;
    }
    if (totalEntries === MAX_UINT16 || centralOffset === MAX_UINT32 || centralSize === MAX_UINT32) {
      throw new Error("Zip64 archives are not supported by this helper slice");
    }
    if (centralOffset + centralSize !== eocdOffset) {
      return null;
    }
    return {
      totalEntries,
      centralOffset,
      centralSize,
      oldCentral: readBufferAt(fd, centralOffset, centralSize),
    };
  } finally {
    fs.closeSync(fd);
  }
}

function buildLocalRecord(entry, compressed) {
  const nameBuffer = Buffer.from(entry.name, "utf8");
  assertUInt16(nameBuffer.length, `member name length for ${entry.name}`);
  assertUInt32(entry.compressedSize, `compressed size for ${entry.name}`);
  assertUInt32(entry.uncompressedSize, `uncompressed size for ${entry.name}`);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(LOCAL_FILE_HEADER, 0);
  localHeader.writeUInt16LE(entry.versionNeeded || ZIP_VERSION_DEFLATE, 4);
  localHeader.writeUInt16LE(entry.flags, 6);
  localHeader.writeUInt16LE(entry.method, 8);
  localHeader.writeUInt16LE(entry.dosTime, 10);
  localHeader.writeUInt16LE(entry.dosDate, 12);
  localHeader.writeUInt32LE(entry.expectedCrc, 14);
  localHeader.writeUInt32LE(entry.compressedSize, 18);
  localHeader.writeUInt32LE(entry.uncompressedSize, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);
  return Buffer.concat([localHeader, nameBuffer, compressed]);
}

function entryForContent(memberName, content, modified = new Date()) {
  validateMemberName(memberName);
  const body = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
  const compressed = zlib.deflateRawSync(body);
  const { dosDate, dosTime } = dateToDos(modified);
  const entry = {
    name: memberName,
    flags: UTF8_FLAG,
    method: COMPRESSION_DEFLATE,
    dosTime,
    dosDate,
    expectedCrc: crc32(body),
    compressedSize: compressed.length,
    uncompressedSize: body.length,
    localOffset: 0,
    modified: dateFromDos(dosDate, dosTime),
    versionMadeBy: ZIP_VERSION_DEFLATE,
    versionNeeded: ZIP_VERSION_DEFLATE,
    centralExtra: Buffer.alloc(0),
    centralComment: Buffer.alloc(0),
    diskStart: 0,
    internalAttrs: 0,
    externalAttrs: 0,
  };
  return { entry, compressed, localRecord: buildLocalRecord(entry, compressed) };
}

function nextRecordNumberFromEntries(entries) {
  return entries.length + 1;
}

function buildCentralDirectory(entries, centralOffset) {
  assertUInt16(entries.length, "ZIP member count");
  const centralParts = [];
  for (const entry of entries) {
    validateMemberName(entry.name);
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const extra = entry.centralExtra || Buffer.alloc(0);
    const comment = entry.centralComment || Buffer.alloc(0);
    assertUInt16(nameBuffer.length, `central member name length for ${entry.name}`);
    assertUInt16(extra.length, `central extra length for ${entry.name}`);
    assertUInt16(comment.length, `central comment length for ${entry.name}`);
    assertUInt32(entry.localOffset, `local header offset for ${entry.name}`);
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_HEADER, 0);
    centralHeader.writeUInt16LE(entry.versionMadeBy || ZIP_VERSION_DEFLATE, 4);
    centralHeader.writeUInt16LE(entry.versionNeeded || ZIP_VERSION_DEFLATE, 6);
    centralHeader.writeUInt16LE(entry.flags, 8);
    centralHeader.writeUInt16LE(entry.method, 10);
    centralHeader.writeUInt16LE(entry.dosTime, 12);
    centralHeader.writeUInt16LE(entry.dosDate, 14);
    centralHeader.writeUInt32LE(entry.expectedCrc, 16);
    centralHeader.writeUInt32LE(entry.compressedSize, 20);
    centralHeader.writeUInt32LE(entry.uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(extra.length, 30);
    centralHeader.writeUInt16LE(comment.length, 32);
    centralHeader.writeUInt16LE(entry.diskStart || 0, 34);
    centralHeader.writeUInt16LE(entry.internalAttrs || 0, 36);
    centralHeader.writeUInt32LE(entry.externalAttrs || 0, 38);
    centralHeader.writeUInt32LE(entry.localOffset, 42);
    centralParts.push(centralHeader, nameBuffer, extra, comment);
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  return {
    central: Buffer.concat(centralParts),
    eocd: buildEndOfCentralDirectory(entries.length, centralSize, centralOffset),
    centralSize,
  };
}

function buildEndOfCentralDirectory(totalEntries, centralSize, centralOffset) {
  assertUInt16(totalEntries, "ZIP member count");
  assertUInt32(centralOffset, "central directory offset");
  assertUInt32(centralSize, "central directory size");
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(totalEntries, 8);
  eocd.writeUInt16LE(totalEntries, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return eocd;
}

function writeCentralDirectoryToFd(fd, entries, centralOffset) {
  const { central, eocd } = buildCentralDirectory(entries, centralOffset);
  fs.writeSync(fd, central, 0, central.length, centralOffset);
  fs.writeSync(fd, eocd, 0, eocd.length, centralOffset + central.length);
  const endOffset = centralOffset + central.length + eocd.length;
  fs.ftruncateSync(fd, endOffset);
  try {
    fs.fsyncSync(fd);
  } catch {
    // Best effort on platforms/filesystems that refuse fsync for this handle.
  }
  return endOffset;
}

function recoverCatalogUnlocked(zipPath) {
  const { entries, localEnd } = walkLocalHeadersUnlocked(zipPath, { validateContent: true });
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  const fd = fs.openSync(zipPath, fs.existsSync(zipPath) ? "r+" : "w+");
  try {
    writeCentralDirectoryToFd(fd, entries, localEnd);
  } finally {
    fs.closeSync(fd);
  }
  return entries;
}

function readCatalogUnlocked(zipPath) {
  if (!fs.existsSync(zipPath)) {
    return [];
  }
  const catalog = readCatalogFromEocdUnlocked(zipPath);
  if (catalog) {
    return catalog;
  }
  return recoverCatalogUnlocked(zipPath);
}

function readCatalog(zipPath) {
  const targetLockPath = acquireLock(zipPath);
  try {
    return readCatalogUnlocked(zipPath);
  } finally {
    releaseLock(targetLockPath);
  }
}

function listMembers(zipPath) {
  return readCatalog(zipPath).map((entry) => ({
    name: entry.name,
    size: entry.uncompressedSize,
    modified: entry.modified.toISOString(),
  }));
}

function hasMembers(zipPath) {
  const targetLockPath = acquireLock(zipPath);
  try {
    const metadata = readAppendMetadataFromEocdUnlocked(zipPath);
    if (metadata) {
      return metadata.totalEntries > 0;
    }
    return walkLocalHeadersUnlocked(zipPath, { validateContent: false }).entries.length > 0;
  } finally {
    releaseLock(targetLockPath);
  }
}

function readMember(zipPath, memberName) {
  const targetLockPath = acquireLock(zipPath);
  try {
    const entry = readCatalogUnlocked(zipPath).find((candidate) => candidate.name === memberName);
    if (!entry) {
      throw new Error(`ZIP member not found: ${memberName}`);
    }
    return readMemberContentUnlocked(zipPath, entry);
  } finally {
    releaseLock(targetLockPath);
  }
}

function appendGeneratedMemberFromEocd(zipPath, metadata, memberName, content, modified) {
  validateMemberName(memberName);
  const next = entryForContent(memberName, content, modified);
  next.entry.localOffset = metadata.centralOffset;
  next.localRecord = buildLocalRecord(next.entry, next.compressed);
  const newCentralOffset = metadata.centralOffset + next.localRecord.length;
  const { central: newCentral } = buildCentralDirectory([next.entry], 0);
  const centralSize = metadata.oldCentral.length + newCentral.length;
  const eocd = buildEndOfCentralDirectory(metadata.totalEntries + 1, centralSize, newCentralOffset);
  const fd = fs.openSync(zipPath, fs.existsSync(zipPath) ? "r+" : "w+");
  try {
    fs.writeSync(fd, next.localRecord, 0, next.localRecord.length, metadata.centralOffset);
    if (metadata.oldCentral.length > 0) {
      fs.writeSync(fd, metadata.oldCentral, 0, metadata.oldCentral.length, newCentralOffset);
    }
    fs.writeSync(fd, newCentral, 0, newCentral.length, newCentralOffset + metadata.oldCentral.length);
    const endOffset = newCentralOffset + centralSize + eocd.length;
    fs.writeSync(fd, eocd, 0, eocd.length, newCentralOffset + centralSize);
    fs.ftruncateSync(fd, endOffset);
    try {
      fs.fsyncSync(fd);
    } catch {
      // Best effort on platforms/filesystems that refuse fsync for this handle.
    }
    return {
      bytes: endOffset,
      strategy: "eocd-tail-copy-catalog",
      attempts: 1,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function appendGeneratedMemberFromLocalScan(zipPath, memberName, content, modified) {
  const { entries, localEnd } = walkLocalHeadersUnlocked(zipPath, { validateContent: false });
  if (entries.some((entry) => entry.name === memberName)) {
    throw new Error(`ZIP member already exists: ${memberName}`);
  }
  const next = entryForContent(memberName, content, modified);
  next.entry.localOffset = localEnd;
  next.localRecord = buildLocalRecord(next.entry, next.compressed);
  const fd = fs.openSync(zipPath, fs.existsSync(zipPath) ? "r+" : "w+");
  try {
    fs.writeSync(fd, next.localRecord, 0, next.localRecord.length, localEnd);
    const centralOffset = localEnd + next.localRecord.length;
    const endOffset = writeCentralDirectoryToFd(fd, [...entries, next.entry], centralOffset);
    return {
      bytes: endOffset,
      strategy: "lfh-recovery-overwrite-catalog",
      attempts: 1,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function appendGeneratedMemberLocked(zipPath, memberName, content, modified) {
  validateMemberName(memberName);
  const metadata = readAppendMetadataFromEocdUnlocked(zipPath);
  return metadata
    ? appendGeneratedMemberFromEocd(zipPath, metadata, memberName, content, modified)
    : appendGeneratedMemberFromLocalScan(zipPath, memberName, content, modified);
}

function appendGeneratedMember(zipPath, memberName, content, modified = new Date()) {
  validateMemberName(memberName);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  const targetLockPath = acquireLock(zipPath);
  try {
    return appendGeneratedMemberLocked(zipPath, memberName, content, modified);
  } finally {
    releaseLock(targetLockPath);
  }
}

function buildNumberedMember(record, buildMember) {
  const built = buildMember({ record });
  if (!built || typeof built !== "object") {
    throw new Error("numbered ZIP append builder must return an object");
  }
  const memberName = built.member || built.memberName || built.name;
  validateMemberName(memberName);
  return { memberName, content: built.content };
}

function appendMemberFromEocd(zipPath, metadata, buildMember, modified) {
  const record = metadata.totalEntries + 1;
  const { memberName, content } = buildNumberedMember(record, buildMember);
  const next = entryForContent(memberName, content, modified);
  next.entry.localOffset = metadata.centralOffset;
  next.localRecord = buildLocalRecord(next.entry, next.compressed);
  const newCentralOffset = metadata.centralOffset + next.localRecord.length;
  const { central: newCentral } = buildCentralDirectory([next.entry], 0);
  const centralSize = metadata.oldCentral.length + newCentral.length;
  const eocd = buildEndOfCentralDirectory(record, centralSize, newCentralOffset);
  const fd = fs.openSync(zipPath, fs.existsSync(zipPath) ? "r+" : "w+");
  try {
    fs.writeSync(fd, next.localRecord, 0, next.localRecord.length, metadata.centralOffset);
    if (metadata.oldCentral.length > 0) {
      fs.writeSync(fd, metadata.oldCentral, 0, metadata.oldCentral.length, newCentralOffset);
    }
    fs.writeSync(fd, newCentral, 0, newCentral.length, newCentralOffset + metadata.oldCentral.length);
    const endOffset = newCentralOffset + centralSize + eocd.length;
    fs.writeSync(fd, eocd, 0, eocd.length, newCentralOffset + centralSize);
    fs.ftruncateSync(fd, endOffset);
    try {
      fs.fsyncSync(fd);
    } catch {
      // Best effort on platforms/filesystems that refuse fsync for this handle.
    }
    return {
      bytes: endOffset,
      strategy: "eocd-tail-copy-catalog",
      attempts: 1,
      record,
      member: memberName,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function appendMemberFromLocalScan(zipPath, buildMember, modified) {
  const { entries, localEnd } = walkLocalHeadersUnlocked(zipPath, { validateContent: false });
  const record = nextRecordNumberFromEntries(entries);
  const { memberName, content } = buildNumberedMember(record, buildMember);
  if (entries.some((entry) => entry.name === memberName)) {
    throw new Error(`ZIP member already exists: ${memberName}`);
  }
  const next = entryForContent(memberName, content, modified);
  next.entry.localOffset = localEnd;
  next.localRecord = buildLocalRecord(next.entry, next.compressed);
  const fd = fs.openSync(zipPath, fs.existsSync(zipPath) ? "r+" : "w+");
  try {
    fs.writeSync(fd, next.localRecord, 0, next.localRecord.length, localEnd);
    const centralOffset = localEnd + next.localRecord.length;
    const endOffset = writeCentralDirectoryToFd(fd, [...entries, next.entry], centralOffset);
    return {
      bytes: endOffset,
      strategy: "lfh-recovery-overwrite-catalog",
      attempts: 1,
      record,
      member: memberName,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function appendMember(zipPath, buildMember, modified = new Date()) {
  if (typeof buildMember !== "function") {
    throw new Error("numbered ZIP append requires a member builder function");
  }
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  const targetLockPath = acquireLock(zipPath);
  try {
    const metadata = readAppendMetadataFromEocdUnlocked(zipPath);
    return metadata
      ? appendMemberFromEocd(zipPath, metadata, buildMember, modified)
      : appendMemberFromLocalScan(zipPath, buildMember, modified);
  } finally {
    releaseLock(targetLockPath);
  }
}

function localRecordBounds(fd, entry, fileSize) {
  const local = parseLocalHeader(fd, entry.localOffset, fileSize);
  if (local.name !== entry.name) {
    throw new Error(`local header name mismatch for ${entry.name}`);
  }
  if (local.method !== entry.method || local.compressedSize !== entry.compressedSize || local.uncompressedSize !== entry.uncompressedSize || local.expectedCrc !== entry.expectedCrc) {
    throw new Error(`local header metadata mismatch for ${entry.name}`);
  }
  return {
    start: entry.localOffset,
    end: local.dataEnd,
  };
}

function copyRangeSync(sourceFd, targetFd, start, length, targetStart) {
  const buffer = Buffer.alloc(Math.min(COPY_CHUNK_SIZE, Math.max(length, 1)));
  let remaining = length;
  let sourceOffset = start;
  let targetOffset = targetStart;
  while (remaining > 0) {
    const chunkLength = Math.min(buffer.length, remaining);
    const bytesRead = fs.readSync(sourceFd, buffer, 0, chunkLength, sourceOffset);
    if (bytesRead <= 0) {
      throw new Error(`unexpected EOF while copying ZIP record at offset ${sourceOffset}`);
    }
    fs.writeSync(targetFd, buffer, 0, bytesRead, targetOffset);
    remaining -= bytesRead;
    sourceOffset += bytesRead;
    targetOffset += bytesRead;
  }
}

function replaceMember(zipPath, memberName, content, modified = new Date()) {
  validateMemberName(memberName);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  const targetLockPath = acquireLock(zipPath);
  const tmpPath = tempPathForZip(zipPath);
  try {
    const entries = readCatalogUnlocked(zipPath);
    const existingIndex = entries.findIndex((entry) => entry.name === memberName);
    if (existingIndex === -1) {
      throw new Error(`ZIP member does not exist: ${memberName}`);
    }
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
    const sourceFd = fs.openSync(zipPath, "r");
    const targetFd = fs.openSync(tmpPath, "wx");
    try {
      const sourceSize = fs.fstatSync(sourceFd).size;
      const nextEntries = [];
      let offset = 0;
      const replacement = entryForContent(memberName, content, modified);
      for (const entry of entries) {
        if (entry.name === memberName) {
          replacement.entry.localOffset = offset;
          const record = buildLocalRecord(replacement.entry, replacement.compressed);
          fs.writeSync(targetFd, record, 0, record.length, offset);
          nextEntries.push(replacement.entry);
          offset += record.length;
          continue;
        }
        const bounds = localRecordBounds(sourceFd, entry, sourceSize);
        copyRangeSync(sourceFd, targetFd, bounds.start, bounds.end - bounds.start, offset);
        nextEntries.push({ ...entry, localOffset: offset });
        offset += bounds.end - bounds.start;
      }
      const endOffset = writeCentralDirectoryToFd(targetFd, nextEntries, offset);
      fs.closeSync(sourceFd);
      fs.closeSync(targetFd);
      fs.renameSync(tmpPath, zipPath);
      return {
        bytes: endOffset,
        strategy: "temp-raw-copy-replace",
        attempts: 1,
      };
    } catch (error) {
      try {
        fs.closeSync(sourceFd);
      } catch {
        // Already closed.
      }
      try {
        fs.closeSync(targetFd);
      } catch {
        // Already closed.
      }
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
      throw error;
    }
  } finally {
    releaseLock(targetLockPath);
  }
}

module.exports = {
  appendGeneratedMember,
  appendMember,
  hasMembers,
  listMembers,
  readCatalog,
  readCatalogUnlocked,
  readMember,
  readMemberContentUnlocked,
  replaceMember,
  validateMemberName,
  walkLocalHeadersUnlocked,
};
