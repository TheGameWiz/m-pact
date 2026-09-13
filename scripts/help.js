#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { runCli } = require("./lib/helper-common");

const QUICK_BEGIN = "<!-- BEGIN QUICK REFERENCE -->";
const QUICK_END = "<!-- END QUICK REFERENCE -->";
const QUICK_SOURCE = "M-PACT_USER_GUIDE_QUICK_REFERENCE.md";
const FULL_SOURCE = "USER_GUIDE.md";
const QUICK_HTML = "quick-reference.html";
const FULL_HTML = "user-guide.html";
const TARGET_QUICK = "quick";

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SAFE_BARE_URL_RE = /^(?:claude\.ai|console\.anthropic\.com|platform\.openai\.com|chatgpt\.com|openai\.com)(?:[/?#]|$)/i;
const URL_AUTOLINK_RE = /(?:https?:\/\/|(?:claude\.ai|console\.anthropic\.com|platform\.openai\.com|chatgpt\.com|openai\.com)(?=[/?#]))[^\s<>"']+/gi;

function mdSafeHref(url) {
  const u = String(url || "").trim();
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
  if (SAFE_BARE_URL_RE.test(u)) return `https://${u}`;
  return "";
}

function mdInline(s) {
  let t = esc(s || "");
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, label) => label);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => {
    const safe = mdSafeHref(url);
    return safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t;
}

function normalizeLogAgentColorHex(value) {
  const raw = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : "";
}

function logAgentColorStyle(hexValue) {
  const hex = normalizeLogAgentColorHex(hexValue);
  if (!hex) return "";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return ` style="border-left-color:${hex};background:rgba(${r},${g},${b},0.10)"`;
}

function trimAutolinkTrailingPunctuation(raw) {
  let url = String(raw || "");
  let suffix = "";
  while (/[.,!?;:]$/.test(url)) {
    suffix = url.slice(-1) + suffix;
    url = url.slice(0, -1);
  }
  while (/\)$/.test(url)) {
    const opens = (url.match(/\(/g) || []).length;
    const closes = (url.match(/\)/g) || []).length;
    if (closes <= opens) break;
    suffix = ")" + suffix;
    url = url.slice(0, -1);
  }
  return { url, suffix };
}

function autoLinkHtmlFragment(html) {
  const src = String(html || "");
  // The source ConflabCode renderer uses a DOM walker here so it can avoid
  // touching URLs inside existing anchors, code, pre, script, or style nodes.
  // This helper runs in Node, so keep the copied behavior conservative.
  if (typeof document === "undefined") return src;
  URL_AUTOLINK_RE.lastIndex = 0;
  if (!src || !URL_AUTOLINK_RE.test(src)) return src;
  URL_AUTOLINK_RE.lastIndex = 0;
  return src.replace(URL_AUTOLINK_RE, (rawUrl) => {
    const { url, suffix } = trimAutolinkTrailingPunctuation(rawUrl);
    const safe = mdSafeHref(url);
    return safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>${esc(suffix)}` : esc(rawUrl);
  });
}

function isMdTableDelimiter(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || "");
}

function parseMdTableCells(line) {
  let s = String(line || "").trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function isMdBlockStart(lines, i) {
  const line = (lines[i] || "").trim();
  if (!line) return true;
  if (/^#{1,6}\s+/.test(line)) return true;
  if (/^(?:---|\*\*\*|___)\s*$/.test(line)) return true;
  if (/^```/.test(line)) return true;
  if (/^>\s?/.test(line)) return true;
  if (/^[-*+]\s+/.test(line)) return true;
  if (/^\d+\.\s+/.test(line)) return true;
  if (lines[i].includes("|") && i + 1 < lines.length && isMdTableDelimiter(lines[i + 1])) return true;
  return false;
}

function headingPlainText(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function slugifyHeading(value, counts) {
  const base = headingPlainText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "section";
  const seen = counts.get(base) || 0;
  counts.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}

function renderMarkdownHtml(md, options = {}) {
  const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  const out = [];
  const headings = [];
  const headingCounts = new Map();
  let pendingBlockquoteColor = "";
  while (i < lines.length) {
    const raw = lines[i] || "";
    const line = raw.trim();
    if (!line) {
      i++;
      continue;
    }

    const colorMarker = line.match(/^<!--\s*conflabcode-agent-color:\s*(#[0-9a-f]{6})\s*-->\s*$/i);
    if (colorMarker) {
      pendingBlockquoteColor = normalizeLogAgentColorHex(colorMarker[1]);
      i++;
      continue;
    }

    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test((lines[i] || "").trim())) {
        code.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const lvl = h[1].length;
      const id = slugifyHeading(h[2], headingCounts);
      const title = headingPlainText(h[2]);
      headings.push({ level: lvl, id, title });
      out.push(`<h${lvl} id="${esc(id)}">${mdInline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (raw.includes("|") && i + 1 < lines.length && isMdTableDelimiter(lines[i + 1])) {
      const header = parseMdTableCells(raw);
      i += 2;
      const rows = [];
      while (i < lines.length) {
        const r = lines[i] || "";
        if (!r.trim() || !r.includes("|") || isMdTableDelimiter(r.trim())) break;
        rows.push(parseMdTableCells(r));
        i++;
      }
      const thead = `<thead><tr>${header.map((c) => `<th>${mdInline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = rows.length ? `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>` : "";
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test((lines[i] || "").trim())) {
        q.push((lines[i] || "").replace(/^\s*>\s?/, "").trim());
        i++;
      }
      const style = logAgentColorStyle(pendingBlockquoteColor);
      pendingBlockquoteColor = "";
      out.push(`<blockquote${style}>${q.map((v) => mdInline(v)).join("<br>")}</blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length) {
        const m = (lines[i] || "").trim().match(/^[-*+]\s+(.+)$/);
        if (m) {
          items.push(m[1]);
          i++;
          continue;
        }
        if (items.length && /^\s{2,}\S/.test(lines[i] || "")) {
          items[items.length - 1] += " " + (lines[i] || "").trim();
          i++;
          continue;
        }
        break;
      }
      out.push(`<ul>${items.map((v) => `<li>${mdInline(v)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      let start = 1;
      while (i < lines.length) {
        const m = (lines[i] || "").trim().match(/^\d+\.\s+(.+)$/);
        if (m) {
          if (!items.length) start = Math.max(1, Number((lines[i] || "").trim().match(/^(\d+)\./)?.[1]) || 1);
          items.push(m[1]);
          i++;
          continue;
        }
        if (items.length && /^\s{2,}\S/.test(lines[i] || "")) {
          items[items.length - 1] += " " + (lines[i] || "").trim();
          i++;
          continue;
        }
        break;
      }
      out.push(`<ol${start !== 1 ? ` start="${start}"` : ""}>${items.map((v) => `<li>${mdInline(v)}</li>`).join("")}</ol>`);
      continue;
    }

    const para = [];
    while (i < lines.length) {
      const s = (lines[i] || "").trim();
      if (!s || isMdBlockStart(lines, i)) break;
      para.push(s);
      i++;
    }
    if (para.length) {
      out.push(`<p>${mdInline(para.join(" "))}</p>`);
      continue;
    }
    i++;
  }
  const html = autoLinkHtmlFragment(out.join("\n"));
  return options.withHeadings ? { html, headings } : html;
}

const ConflabCode_DELIVERABLE_CSS = `
  :root{color-scheme:light;}
  *{box-sizing:border-box}
  body{
    margin:0;
    padding:10px;
    background:#dfe4ea;
    color:#15202b;
    font-family:Georgia,"Times New Roman",serif;
    line-height:1.6;
  }
  .ConflabCode-deliverable{
    width:min(1180px,100%);
    min-height:calc(100vh - 20px);
    margin:0 auto;
    background:#fff;
    border:1px solid #d7dde4;
    border-radius:7px;
    padding:32px clamp(22px,4vw,52px);
    box-shadow:0 8px 20px rgba(15,23,42,.10);
  }
  h1,h2,h3,h4,h5,h6{
    margin:18px 0 8px;
    color:#0f172a;
    font-family:Arial,Helvetica,sans-serif;
    line-height:1.25;
  }
  h1{font-size:28px}
  h2{font-size:22px}
  h3{font-size:18px}
  h4,h5,h6{font-size:16px}
  p{margin:10px 0}
  ul,ol{margin:10px 0 10px 22px;padding:0}
  li{margin:4px 0}
  hr{border:none;border-top:1px solid #d7dde4;margin:18px 0}
  a{color:#0f766e}
  blockquote{
    margin:16px 0 16px 22px;
    padding:10px 14px;
    border-left:4px solid #7dd3c7;
    background:#f4fbf9;
  }
  code{
    font-family:"JetBrains Mono","Courier New",monospace;
    background:#f3f4f6;
    padding:1px 4px;
    border-radius:4px;
  }
  pre{
    margin:14px 0;
    padding:14px 16px;
    overflow:auto;
    border:1px solid #d7dde4;
    border-radius:8px;
    background:#f8fafc;
  }
  pre code{background:none;padding:0}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{border:1px solid #d7dde4;padding:8px 10px;vertical-align:top;text-align:left}
  th{background:#f8fafc;color:#0f172a}
  img{
    max-width:100%;
    height:auto;
    display:block;
    margin:16px auto;
    border-radius:10px;
  }
  .mpact-help-print{
    position:fixed;
    top:16px;
    right:16px;
    width:38px;
    height:38px;
    border:1px solid #cbd5e1;
    border-radius:8px;
    background:#fff;
    color:#0f172a;
    box-shadow:0 8px 18px rgba(15,23,42,.12);
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
  }
  .mpact-help-print:hover{background:#f8fafc}
  .mpact-help-print svg{width:19px;height:19px;display:block}
  .mpact-help-toc{
    margin:0 0 22px;
    padding:14px 16px;
    border:1px solid #d7dde4;
    border-radius:8px;
    background:#f8fafc;
    font-family:Arial,Helvetica,sans-serif;
  }
  .mpact-help-toc-title{font-weight:700;margin-bottom:8px;color:#0f172a}
  .mpact-help-toc ol{margin:0;padding-left:20px}
  .mpact-help-toc li{margin:3px 0}
  .mpact-help-toc-depth-3{margin-left:14px}
  .mpact-help-toc-depth-4,.mpact-help-toc-depth-5,.mpact-help-toc-depth-6{margin-left:28px}
  .mpact-help-full-link{
    margin-top:24px;
    padding-top:14px;
    border-top:1px solid #d7dde4;
    font-family:Arial,Helvetica,sans-serif;
  }
  @page { size: letter; margin: 0.25in; }
  @media print {
    body { font-size: 11pt; color: #000; background: #fff; padding:0; }
    .ConflabCode-deliverable{width:auto;margin:0;border:0;border-radius:0;padding:0 44px;box-shadow:none}
    a { color: #000; text-decoration: none; }
    img, table, pre, blockquote, h1, h2, h3 { page-break-inside: avoid; }
    .no-print { display: none; }
  }
  @media (max-width: 720px) {
    body{padding:0;background:#fff}
    .ConflabCode-deliverable{min-height:100vh;border:0;border-radius:0;padding:24px 18px;box-shadow:none}
    .mpact-help-print{top:10px;right:10px}
  }
`;

function printButtonHtml() {
  return `<button type="button" class="mpact-help-print no-print" onclick="window.print()" aria-label="Print" title="Print"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg></button>`;
}

function tocHtml(headings) {
  const entries = (headings || []).filter((heading) => heading.level >= 1 && heading.level <= 6);
  if (entries.length === 0) return "";
  return `<nav class="mpact-help-toc" aria-label="Table of contents">
<div class="mpact-help-toc-title">Contents</div>
<ol>
${entries.map((heading) => `<li class="mpact-help-toc-depth-${heading.level}"><a href="#${esc(heading.id)}">${esc(heading.title)}</a></li>`).join("\n")}
</ol>
</nav>`;
}

function wrapHtmlDocument({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title || "M-PACT Help")}</title>
<style>${ConflabCode_DELIVERABLE_CSS}</style>
</head>
<body>
${printButtonHtml()}
<article class="ConflabCode-deliverable">
${bodyHtml}
</article>
</body>
</html>
`;
}

function extractQuickReference(source) {
  const text = String(source || "");
  const begin = text.indexOf(QUICK_BEGIN);
  const end = text.indexOf(QUICK_END);
  if (begin === -1) {
    throw new Error(`missing marker: ${QUICK_BEGIN}`);
  }
  if (end === -1) {
    throw new Error(`missing marker: ${QUICK_END}`);
  }
  if (end < begin) {
    throw new Error(`malformed marker order: ${QUICK_END} before ${QUICK_BEGIN}`);
  }
  return text.slice(begin + QUICK_BEGIN.length, end).trim();
}

function skillHelpDirectory(skillRoot) {
  const hash = crypto.createHash("sha256").update(path.resolve(skillRoot)).digest("hex").slice(0, 12);
  return path.join(os.tmpdir(), `m-pact-help-${hash}`);
}

function parseHelpTarget(argv = []) {
  let words = argv.map((arg) => String(arg || "").trim().toLowerCase()).filter(Boolean);
  if (words.length > 1 && words[0] === "help") {
    words = words.slice(1);
  }
  const phrase = words.join(" ");
  if (
    !phrase
    || phrase === "help"
    || phrase === "quick"
    || phrase === "quick reference"
    || phrase === "quick-reference"
    || phrase === "guide"
    || phrase === "reference guide"
    || phrase === "reference-guide"
  ) {
    return TARGET_QUICK;
  }
  throw new Error("M-PACT help accepts: help, quick reference, reference guide, or guide.");
}

function renderHelpFiles({ skillRoot = path.dirname(__dirname), openBrowser = true, target = TARGET_QUICK } = {}) {
  const docsDir = path.join(skillRoot, "docs");
  const quickSourcePath = path.join(docsDir, QUICK_SOURCE);
  const fullSourcePath = path.join(docsDir, FULL_SOURCE);
  const quickSource = fs.readFileSync(quickSourcePath, "utf8");
  const fullSource = fs.readFileSync(fullSourcePath, "utf8");
  const quickMarkdown = extractQuickReference(quickSource);
  const helpDir = skillHelpDirectory(skillRoot);
  fs.mkdirSync(helpDir, { recursive: true });

  const quickPath = path.join(helpDir, QUICK_HTML);
  const fullPath = path.join(helpDir, FULL_HTML);
  const full = renderMarkdownHtml(fullSource, { withHeadings: true });
  const quick = renderMarkdownHtml(quickMarkdown, { withHeadings: true });
  const fullLinkHref = path.basename(fullPath);

  fs.writeFileSync(fullPath, wrapHtmlDocument({
    title: "M-PACT User Guide",
    bodyHtml: `${tocHtml(full.headings)}\n${full.html}`,
  }), "utf8");
  fs.writeFileSync(quickPath, wrapHtmlDocument({
    title: "M-PACT Quick Reference",
    bodyHtml: `${quick.html}\n<p class="mpact-help-full-link"><a href="${esc(fullLinkHref)}">Open the full M-PACT user guide</a></p>`,
  }), "utf8");

  const normalizedTarget = TARGET_QUICK;
  const selectedPath = quickPath;
  const openResult = openBrowser ? openInBrowser(selectedPath) : { ok: true, skipped: true };
  return { helpDir, quickPath, fullPath, selectedPath, target: normalizedTarget, openResult };
}

function openInBrowser(filePath) {
  const target = path.resolve(filePath);
  let command;
  let args;
  if (process.platform === "win32") {
    command = "cmd.exe";
    args = ["/c", "start", "", target];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [target];
  } else {
    command = "xdg-open";
    args = [target];
  }
  const result = spawnSync(command, args, { stdio: "ignore", windowsHide: true });
  if (result.error) {
    return { ok: false, message: result.error.message };
  }
  if (result.status !== 0) {
    return { ok: false, message: `${command} exited ${result.status}` };
  }
  return { ok: true, message: command };
}

function main() {
  const positionals = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const target = parseHelpTarget(positionals);
  const rendered = renderHelpFiles({ target });
  const opened = rendered.openResult.ok;
  if (!opened) {
    process.stdout.write(`${rendered.selectedPath}\n`);
  }
  return {
    ok: true,
    operation: "help",
    helpDir: rendered.helpDir,
    quickPath: rendered.quickPath,
    fullPath: rendered.fullPath,
    helpTarget: rendered.target,
    selectedPath: rendered.selectedPath,
    openResult: opened ? `opened:${rendered.openResult.message || "default-browser"}` : `fallback:path-printed:${rendered.openResult.message || "open-failed"}`,
  };
}

if (require.main === module) {
  runCli(main, {
    acceptedFlags: [],
  });
}

module.exports = {
  extractQuickReference,
  headingPlainText,
  mdInline,
  mdSafeHref,
  parseHelpTarget,
  renderHelpFiles,
  renderMarkdownHtml,
  skillHelpDirectory,
  slugifyHeading,
  tocHtml,
};
