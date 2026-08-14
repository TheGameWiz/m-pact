#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { withDirectoryLock } = require("./lib/directory-lock");
const {
  booleanArg,
  localTimestamp,
  resolveRootPath,
  runCli,
  sanitizeSlug,
  yamlScalar,
} = require("./lib/helper-common");
const { validateProjectWrite } = require("./lib/project-identity");

const RULE_NAME_MAX = 96;
const CATEGORIES = new Set(["core", "behavior", "format", "director", "user"]);
const ACCEPTED_FLAGS = [
  "root",
  "project-id",
  "cross-project",
  "user-root",
  "input",
  "from-stdin",
  "category",
  "title",
  "filename",
  "description",
  "type",
  "replace",
  "update",
];
const REQUIRED_FLAGS = [];
const REQUIRED_ONE_OF = [["title", "filename", "description"]];

function cappedRuleFilename(category, title) {
  const prefix = `${category}-`;
  const suffix = ".md";
  const maxSlug = RULE_NAME_MAX - prefix.length - suffix.length;
  const slug = (sanitizeSlug(title) || "rule").slice(0, maxSlug).replace(/-+$/g, "") || "rule";
  return `${prefix}${slug}${suffix}`;
}

function existingCreatedDate(content) {
  const match = /^created:\s*(.+)$/m.exec(content);
  return match ? match[1].trim() : null;
}

function main({ args, input }) {
  const rootPath = resolveRootPath(input, args);
  const identity = validateProjectWrite({ rootPath, input, args });
  const rulesPath = path.join(rootPath, "rules");
  const category = String(args.category || "behavior").replace(/-$/, "");
  if (!CATEGORIES.has(category) && !/^[a-z][a-z0-9]+$/.test(category)) {
    throw new Error("category must be a simple lowercase rule prefix");
  }

  const title = args.title || args.filename || args.description;
  let filename = args.filename || cappedRuleFilename(category, title);
  if (!filename.endsWith(".md")) {
    filename = `${filename}.md`;
  }
  if (filename.length > RULE_NAME_MAX) {
    throw new Error(`rule filename exceeds ${RULE_NAME_MAX} characters`);
  }
  if (path.basename(filename) !== filename || filename.includes("\\") || filename.includes("/")) {
    throw new Error("rule filename must not include a path");
  }

  const description = args.description || "";
  const type = args.type || "behavior";
  const body = input.body || "";
  if (!String(body).trim()) {
    throw new Error("body is required");
  }

  return withDirectoryLock(rootPath, () => {
    fs.mkdirSync(rulesPath, { recursive: true });
    const rulePath = path.join(rulesPath, filename);
    const exists = fs.existsSync(rulePath);
    if (exists && !booleanArg(args, "replace") && !booleanArg(args, "update")) {
      throw new Error(`rule already exists; pass --replace to update: ${rulePath}`);
    }

    const now = new Date();
    const timestamp = localTimestamp(now);
    const created = exists ? (existingCreatedDate(fs.readFileSync(rulePath, "utf8")) || timestamp.date) : timestamp.date;
    const content = [
      "---",
      `description: ${description ? yamlScalar(description) : "\"\""}`,
      `type: ${type}`,
      "source: director",
      `created: ${created}`,
      "---",
      "",
      String(body).trim(),
      "",
    ].join("\n");

    fs.writeFileSync(rulePath, content, "utf8");
    return { ok: true, operation: exists ? "update-rule" : "write-rule", rootPath, projectId: identity.projectId, projectPath: identity.projectPath, crossProject: identity.crossProject || undefined, rulePath, timestamp: timestamp.body };
  });
}

runCli(main, {
  acceptedFlags: ACCEPTED_FLAGS,
  stringFlags: ["root", "project-id", "user-root", "input", "category", "title", "filename", "description", "type"],
  requiredFlags: REQUIRED_FLAGS,
  requiredOneOf: REQUIRED_ONE_OF,
  stdinFlags: ["from-stdin"],
});
