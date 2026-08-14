"use strict";

function pad4(value) {
  return String(value).padStart(4, "0");
}

function formatCloseStatusSection(status) {
  const lines = ["## Close Status"];
  if (status.unfinished.length === 0 && status.clearedUnresolved.length === 0) {
    lines.push("- (none)");
    return lines.join("\n");
  }
  for (const item of status.unfinished) {
    lines.push(`- [${pad4(item.number)}] unfinished version ${pad4(item.version || 0)}`);
  }
  for (const item of status.clearedUnresolved) {
    lines.push(`- [${pad4(item.number)}] cleared-unresolved version ${pad4(item.version)}`);
  }
  return lines.join("\n");
}

function parseCloseStatus(body) {
  const lines = String(body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const start = lines.findIndex((line) => line === "## Close Status");
  if (start === -1) {
    return { unfinished: [], clearedUnresolved: [] };
  }
  const unfinished = [];
  const clearedUnresolved = [];
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (/^## /.test(line)) {
      break;
    }
    const match = /^- \[(\d{4})\] (unfinished|cleared-unresolved) version (\d{4})$/.exec(line);
    if (!match) {
      continue;
    }
    const value = `${match[1]}@${match[3]}`;
    if (match[2] === "unfinished") {
      unfinished.push(value);
    } else {
      clearedUnresolved.push(value);
    }
  }
  return { unfinished, clearedUnresolved };
}

module.exports = {
  formatCloseStatusSection,
  parseCloseStatus,
};
