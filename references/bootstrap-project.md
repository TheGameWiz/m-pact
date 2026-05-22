# Bootstrap Project

Bootstrap is approval-gated. Do not create memory roots or starter rules silently.

Use `scripts/bootstrap-project.js` after the Director explicitly approves bootstrap or setup. The helper owns creating `.AgentMemory/`, creating `.AgentMemoryRoot/`, copying starter rules, and preserving existing files.

## When To Offer

Offer project bootstrap when refresh preflight reports `M-PACT PROJECT SETUP REQUIRED`, or when the Director asks to create a local memory root for a child folder.

When offering project bootstrap during refresh preflight, ask a hard yes/no question and stop. The question must name the write action: add `.AgentMemory/`. Say artifact folders and ZIP containers are created lazily when first used. Project startup shims are not part of project bootstrap; provider-global shims invoke the skill.

Offer user-root bootstrap when required `.AgentMemoryRoot/` is missing. Tell the Director that approved user-root bootstrap installs bundled starter core rules into `.AgentMemoryRoot/rules/` unless they ask to skip them. Starter rules are editable defaults.

Normal runtime setup should already create `.AgentMemoryRoot/` and install starter rules. If the Director asks to install or set up M-PACT for a project and `.AgentMemoryRoot/` is missing, run `references/install-mpact.md` first from the current provider's installed M-PACT copy, then create the project `.AgentMemory/`.

## Project Bootstrap

Run from the project directory or pass `--project <project-root>`:

```bash
node scripts/bootstrap-project.js --project <project-root>
```

The helper creates `.AgentMemory/` only. Artifact folders and ZIP containers are lazy and appear when later helpers need them.

Project bootstrap does not write `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md`. Startup belongs to provider-global shims installed by `references/install-mpact.md`.

In project mode, `scripts/bootstrap-project.js` checks for the user `.AgentMemoryRoot/`. If it is missing, the helper runs `scripts/install-mpact.js` first so the current provider shim, starter rules, and `.AgentMemoryRoot/` exist before the project root is created.

After approved project bootstrap, reply with one concise user-level sentence. Mention skipped or blocked files only when the user needs to act. Do not run refresh merely because bootstrap completed. If bootstrap approval was the yes answer to a refresh preflight question, the original refresh request is still active: run refresh again after setup and emit the resulting receipt.

## User Root Bootstrap

Run:

```bash
node scripts/bootstrap-project.js --user-root
```

Optional flags:

- `--root <user-root>` targets a non-default user root when explicitly needed.
- `--skip-starter-rules true` creates only the root.

Starter rules are installed only during initial user-root bootstrap. If a destination rule file already exists, the helper skips it instead of overwriting.

Create only what the Director approved.
