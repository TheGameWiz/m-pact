#!/usr/bin/env node
"use strict";

const CONTAINERS = {
  sessions: {
    name: "sessions",
    scope: "root",
    zipFilename: "sessions.zip",
    defaultSort: "name-desc",
    recordsExpected: false,
  },
  "case-studies": {
    name: "case-studies",
    scope: "root",
    zipFilename: "case-studies.zip",
    defaultSort: "name-desc",
    recordsExpected: false,
  },
  journal: {
    name: "journal",
    scope: "root",
    zipFilename: "journal.zip",
    defaultSort: "name-desc",
    recordsExpected: false,
  },
  "task-log": {
    name: "task-log",
    scope: "task",
    zipFilename: "log.zip",
    defaultSort: "record-asc",
    recordsExpected: true,
  },
  "task-summary": {
    name: "task-summary",
    scope: "task",
    zipFilename: "summary.zip",
    defaultSort: "record-asc",
    recordsExpected: true,
  },
  specification: {
    name: "specification",
    scope: "task",
    zipFilename: "specification.zip",
    defaultSort: "record-asc",
    recordsExpected: true,
  },
};

const ALIASES = new Map([
  ["session", "sessions"],
  ["sessions", "sessions"],
  ["case-study", "case-studies"],
  ["case-studies", "case-studies"],
  ["case", "case-studies"],
  ["journal", "journal"],
  ["task-log", "task-log"],
  ["log", "task-log"],
  ["task-summary", "task-summary"],
  ["summary", "task-summary"],
  ["summaries", "task-summary"],
  ["spec", "specification"],
  ["specification", "specification"],
  ["specifications", "specification"],
]);

function containerNames() {
  return Object.keys(CONTAINERS);
}

function getContainer(name) {
  const key = ALIASES.get(String(name || "").trim().toLowerCase());
  if (!key || !CONTAINERS[key]) {
    throw new Error(`container must be one of: ${containerNames().join(", ")}`);
  }
  return CONTAINERS[key];
}

module.exports = {
  containerNames,
  getContainer,
};
