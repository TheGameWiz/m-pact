# Bootstrap Project

Bootstrap is approval-gated. Do not create memory folders silently.

Explicit bootstrap or setup language from the Director is approval to bootstrap the named project root. A use, load, sync, or refresh request is not bootstrap approval.

## When To Offer

Offer project bootstrap when no active project `.AgentMemory/` exists after refresh, or when the Director asks to create a local memory root for a child folder.

When offering project bootstrap after refresh reports `project: (none found)`, ask a hard yes/no question and stop. The question must name the write action: create or repair `.AgentMemory/` and create or append startup shims in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. Treat "maybe," "not sure," "let me think," or explanatory questions as no approval yet.

Offer user-root bootstrap when required `.AgentMemoryRoot/` is missing. Missing user root blocks a fully loaded refresh until the Director approves bootstrap.

If a parent project root exists, report that it is being used. Offer local bootstrap only when setup or isolation is clearly relevant or the Director asks.

When offering user-root bootstrap for a missing `.AgentMemoryRoot/`, state that the skill will also install bundled starter core rules into `.AgentMemoryRoot/rules/`. Tell the Director these rules are editable defaults: they should review each rule and edit, delete, or replace anything that does not match their workflow.

## Project Setup

```text
.AgentMemory/
  rules/
  sessions/
  tasks/
  case-studies/
  journal/
```

`tasks/` may contain a zero-byte `current__<active-task-folder>` sentinel plus task folders. Each task folder contains `task.md`, optional `specification.md`, `log/`, and `summary/`.

Approved project bootstrap also installs project startup shims:

```text
AGENTS.md
CLAUDE.md
GEMINI.md
```

The bundled shim templates live in the skill folder:

```text
shims/AGENTS.md
shims/CLAUDE.md
shims/GEMINI.md
```

These shims tell compatible agents to invoke M-PACT and refresh memory on new context. `AGENTS.md` covers Codex and skill-compatible agents such as Copilot CLI, `CLAUDE.md` covers Claude Code, and `GEMINI.md` covers Gemini CLI. Without them, a future local agent session may not automatically refresh memory for the project.

## Project Shim Handling

Project bootstrap approval includes creating or embedding the startup shims unless the Director asks to skip them or names only one agent client.

For each project shim:

1. If the file does not exist, create it from the bundled shim template.
2. If the file exists and already invokes `m-pact` on new context, leave it unchanged and report that it was already configured.
3. If the file exists and has no M-PACT instruction, append the bundled shim section to the existing file. Preserve all existing content. Do not rewrite, reorder, or summarize unrelated instructions.
4. If the existing file appears to contain conflicting M-PACT instructions, stop and ask the Director how to merge them.
5. Report each shim file as created, appended, already configured, skipped, or blocked.

After approved project bootstrap, report each created, repaired, appended, already configured, skipped, or blocked artifact. Do not run refresh merely because bootstrap completed. Run refresh after bootstrap only when the Director also asks to refresh, load, or verify.

## User Root Structure

```text
.AgentMemoryRoot/
  rules/
  sessions/
  tasks/
  case-studies/
  journal/
```

User and project roots use the same standard artifact folders. Journal entries are still written only when the Director explicitly asks.

## User Root Starter Rules

Bundled starter rules live in the skill folder:

```text
starter-rules/user-root/rules/
```

On approved user-root bootstrap for a missing `.AgentMemoryRoot/`:

1. Create the standard `.AgentMemoryRoot/` folders.
2. Copy every bundled `starter-rules/user-root/rules/*.md` file into `.AgentMemoryRoot/rules/`.
3. Never overwrite an existing rule file. If a destination filename already exists, skip it and report the skip.
4. After copying, list the installed starter rule filenames.
5. Tell the Director: "These starter rules are editable defaults. Please review each one and edit, delete, or replace rules that do not fit your workflow."

If the Director asks to bootstrap folders without starter rules, create only the standard folders and report that starter rules were skipped by request.

Starter rules are installed only during initial `.AgentMemoryRoot/` creation. If `.AgentMemoryRoot/` already exists, do not install or re-install bundled starter rules as part of bootstrap; rule changes to existing roots must use normal rule write/update procedures for specific named rules.

Create only what the Director approved.
