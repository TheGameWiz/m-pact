#!/usr/bin/env node
"use strict";

const MIN_NODE_MAJOR = 18;

function pad(value) {
  return String(value).padStart(2, "0");
}

function sanitizeFilenameZone(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function localZoneLabel(date) {
  const override = process.env.MPACT_ZONE_LABEL;
  if (override && override.trim()) {
    return override.trim();
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "shortGeneric",
    }).formatToParts(date);
    const zone = parts.find((part) => part.type === "timeZoneName");
    if (zone && zone.value) {
      return zone.value;
    }
  } catch {
    // Fall through to numeric offset.
  }

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `UTC${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function main() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
    console.error(`ERROR: Node.js ${MIN_NODE_MAJOR} or newer is required.`);
    process.exit(1);
  }

  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const zone = localZoneLabel(now);
  const filenameZone = sanitizeFilenameZone(zone) || "local";
  const filenameStamp = `${date}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${filenameZone}`;

  console.log(`FilenameStamp: ${filenameStamp}`);
  console.log(`BodyTimestamp: ${date} ${time} ${zone}`);
  console.log(`Date: ${date}`);
  console.log(`Zone: ${zone}`);
  console.log(`FilenameZone: ${filenameZone}`);
}

main();
