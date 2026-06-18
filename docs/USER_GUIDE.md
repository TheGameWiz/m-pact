# M-PACT: Multi-Provider Agent Context Toolkit User Guide

M-PACT helps local coding agents share memory. It was designed and validated for Codex, Claude Code, and Gemini CLI. Its goal is simple: let agents remember useful project information, share it with each other, and pick up work without depending on one chat window to hold everything.

M-PACT stores memory at two levels: global memory that can follow you across projects, and project memory that belongs to one workspace. That memory can include shared rules, session notes, project tasks, task logs, task specifications, task summaries, case studies, and project journals.

This makes it possible to use more than one agent on the same project at the same time. One agent can work on a design, another can review it, another can implement it, and another can verify the code. They can hand work back and forth through task logs and specifications instead of trying to reconstruct state from chat history.

The workflow is flexible, but one useful pattern is to pair agents from different providers. For example, Claude Code can be useful for design, code review, completeness checks, and test verification. Codex can be useful for design review, implementation, and testing. Together they can challenge each other's assumptions and often reach a good result with fewer iterations.

The system has one important separation:

- The `m-pact` skill owns procedures: refresh, lookup, bootstrap, task operations, rule writing, and artifact templates.
- Memory roots hold state: rules, sessions, tasks, case studies, and journals.

This guide describes the user-facing operations, what each one is for, and why you would ask an agent to use it.

## What You Can Do

At the simplest level, M-PACT lets you:

- Create shared rules that teach agents your coding style, preferences, project habits, and recurring lessons.
- Write session entries that preserve a handoff when you are switching agents, switching providers, or approaching the end of a context window.
- Create project tasks with logs, specifications, and summaries so agents can design, implement, review, test, and verify work in a structured loop.
- Create case studies for important successes, failures, investigations, and lessons that you want future agents to remember.
- Write journal entries for project notes you want to keep but do not want to turn into rules, tasks, or case studies.

A common task workflow looks like this:

1. Tell one agent to create a task for the work.
2. Describe the goal and ask it to write a task log or task specification.
3. Switch to another agent and ask it to take the handoff, review the plan, inspect the codebase, and identify risks or gaps.
4. Have that agent write its own log entry back to the task.
5. Repeat the loop until the design, implementation plan, code, tests, and verification are complete.
6. Close the task when the work is done.

For context management, you can also ask for a detailed session entry before you compact, clear, or restart a session. After that, run M-PACT refresh in the next context and continue from the saved handoff.

## Install Targets

M-PACT is packaged as one folder with native entrypoints for multiple local agent runtimes:

```text
~/.codex/skills/m-pact/
~/.claude/skills/m-pact/
~/.gemini/extensions/m-pact/   # or link this repo with gemini extensions link
```

Copilot CLI may later use `~/.copilot/skills/m-pact/` or `~/.agents/skills/m-pact/`, but that install path remains best-effort and is not enabled by the default helper.

Use `$m-pact` in Codex, `/m-pact` in Claude Code, and `/m-pact:fast-refresh` in Gemini CLI. `/m-pact:refresh` remains a Gemini compatibility command. Copilot CLI may use `/m-pact` or `m-pact` if its runtime exposes the skill, but this path is best-effort until validated. In dictated Gemini requests, `Impact` is the spoken alias for M-PACT, for example `refresh Impact` or `Impact refresh`. Gemini is instructed to route these natural M-PACT requests, including `m-pact refresh`, to `/m-pact:fast-refresh` when possible, then emit only the receipt body and stop. Plain `refresh memory` remains the ordinary refresh wording for Codex, Claude Code, and Copilot-style agents, but Gemini should not treat it as M-PACT unless the request also names Impact or M-PACT.

Codex and Claude Code use `SKILL.md`. Gemini CLI uses `gemini-extension.json`, root `GEMINI.md`, and `commands/`. Copilot CLI-facing instructions are included for future compatibility, but Copilot CLI has not yet been validated as a first-class supported runtime.

## Compatibility
M-PACT startup refresh is for local agent runtimes only. Codex CLI, Claude Code, and Gemini CLI are the validated targets. Copilot CLI and other compatible local agents may work if they have shell access, filesystem access, and Node.js 18 or newer, but they are best-effort until tested.

Web-only ChatGPT or Claude clients may be able to read or install skill instructions in products that support skills, but they cannot refresh local `.AgentMemoryRoot/` or `.AgentMemory/` folders directly. For web-only work, provide an uploaded refresh bundle or uploaded memory artifacts instead of asking the web agent to run local refresh.

### Temporarily Suspend M-PACT

Set `MPACT_SUPPRESS` to a truthy value, such as `1`, when another launcher, wrapper, or host environment should own startup and runtime context for a session. This is useful for managed sessions that inject their own context and should not also trigger M-PACT refresh.

When `MPACT_SUPPRESS` is set, provider startup shims should not invoke M-PACT. Helper scripts enforce the same rule themselves: they print `M-PACT SUPPRESSED`, end with `END M-PACT SUPPRESSED`, and exit nonzero before reading memory or writing setup state.

To use M-PACT again, unset `MPACT_SUPPRESS`, set it to an empty value, or start a normal session without that environment variable.

## Quick Start

### Provider Runtime Setup

Install M-PACT separately for each provider you want to use. After placing M-PACT in that provider's skill or extension folder, run runtime setup from that provider's installed copy:

```text
node scripts/install-mpact.js
```

Provider skill placement is provider-specific and follows the normal skill model:

```text
~/.codex/skills/m-pact/
~/.claude/skills/m-pact/
~/.gemini/extensions/m-pact/   # or link this repo with gemini extensions link
```

The runtime setup helper does not copy itself across provider roots. It creates or preserves `.AgentMemoryRoot/`, installs starter user-root rules without overwriting existing rule files, and installs only the current or explicitly requested provider-global startup shim:

```text
~/.codex/AGENTS.md
~/.claude/CLAUDE.md
~/.gemini/GEMINI.md
```

Install does not create project `.AgentMemory/` roots or project-local instruction files. Repeat provider placement and runtime setup for Codex, Claude, and Gemini separately when you want all three configured.

### New Project Setup

Runtime setup configures the current provider's global startup shim and creates the user `.AgentMemoryRoot/`. A new workspace still needs project setup.

For a new project, ask:

```text
Set up m-pact for this project.
```

The agent should first confirm `.AgentMemoryRoot/` exists. If it is missing, it should run runtime setup, then add the project scaffold: `.AgentMemory/`. Artifact folders and ZIP containers are lazy and are created only when first used. It should not run refresh after bootstrap unless you also ask it to refresh, load, or verify. Provider-global shims should invoke M-PACT for configured runtimes; project bootstrap does not write project instruction files.

If you start an agent from a subfolder below an existing project `.AgentMemory/`, refresh uses the nearest parent project root. It should not ask to create another `.AgentMemory/` in the subfolder unless you explicitly ask for a new child project root.

Use this wording instead of "install m-pact" when the skill is already installed and your goal is to configure the current workspace.

### Routine Use

Use M-PACT when you want an agent to:

- Run multiple visible agent sessions across one provider or many providers.
- Start a session with the right standing context.
- Pick up a task after another agent or previous session.
- Preserve a compact checkpoint before context gets messy.
- Record a durable rule after a repeated mistake or important preference.
- Keep project-specific memory separate from user-level memory.
- Store richer narratives, like investigations or decisions, without bloating startup context.

Do not use it for information the agent can cheaply recover from source code, git history, or current project files.

At the start of a new agent context, say:

```text
Use $m-pact and refresh memory.
```

The agent should run the skill's refresh procedure. If a project memory root exists, it loads the memory chain and emits a compact refresh receipt. The visible receipt starts with `M-PACT MEMORY REFRESH`; internal begin/end marker lines in the bundle are not shown. The full roots, rules, sessions, and task pointer details stay inside the loaded bundle instead of being printed during normal startup.

After the receipt, the agent should not scan `.AgentMemory`, sessions, rules, tasks, or the generated bundle just to verify the refresh. The bundle is already the verified startup context. Ask for targeted lookup when you want a specific memory artifact.

This startup refresh is the practical bridge for multi-provider work. A Codex tab, a Claude Code tab, and a Gemini CLI session can all begin from the same memory chain instead of acting like separate isolated chats. Copilot CLI is a plausible future target, but the current project should describe it as unvalidated best-effort support.

If no project `.AgentMemory/` exists, normal refresh should stop before emitting a receipt and ask whether to create project scaffolding. If you answer yes, the agent should add `.AgentMemory/` and then run refresh again. Artifact folders and ZIP containers remain absent until an approved operation needs them. If you answer no, the agent should run user-root-only refresh and emit that receipt.

Refresh is only for:

- New contexts or session startup.
- Known or suspected compaction/context loss.
- Explicit "refresh memory" requests.

Do not refresh just because a task is large. Use targeted lookup, task handoffs, and checkpoints while the current context is still intact.

If refresh hits the bundle size limit, it should still return a partial bundle with a visible `LimitHit: true` warning. Treat that as usable startup context, then ask for targeted lookup when omitted details matter.

Common lookup requests:

```text
Find memory entries about task handoffs.
List the active project rules.
Show layered rules about code review.
Read the current task.
```

Common task-continuity requests:

```text
Handoff.
Handoff to Claude.
Make this a task.
Create a task from this conversation.
Take the current task handoff and report the state.
Write a task log checkpoint for what we just decided.
Write the task specification with this decision and write the paired log.
Close this task as complete.
Reopen task t0007 because there is follow-up work.
```

Common durable-context requests:

```text
Write a session entry summarizing this project-wide decision.
Create a case study for this debugging incident.
Add a user-level rule that agents must verify X before doing Y.
Write a journal entry in my voice about this design decision.
```

If a project has no `.AgentMemory/`, ask:

```text
Bootstrap M-PACT for this project.
```

Project bootstrap first ensures the user `.AgentMemoryRoot/` exists, running provider runtime setup if needed. Then it creates only the local memory root. The root's artifact folders are created later by the first approved write that needs them. It does not write project-local instruction files.

If your user root is missing, ask:

```text
Bootstrap my .AgentMemoryRoot with the starter rules.
```

User-root bootstrap installs bundled starter core rules unless you ask to skip them. These starter rules are editable defaults. Review them and edit, delete, or replace anything that does not fit your workflow.

As a general pattern: start each new context with refresh, use targeted reads during normal work, and write the smallest durable artifact that fits. Use a rule for behavior, a task log for task state, a session for broad continuity, and a case study for a narrative lesson.

## Core Concepts

### Director

The user is the Director. The Director has decision authority over task creation, durable rules, memory writes, bootstrap, deletion, close/reopen actions, and ambiguous judgment calls.

### Memory Roots

There are two root types:

- User root: `.AgentMemoryRoot/`, usually under the user's home directory.
- Project root: `.AgentMemory/`, placed in a project folder.

The memory chain is broad-to-specific:

```text
~/.AgentMemoryRoot/
ancestor/.AgentMemory/
nearest-project/.AgentMemory/
```

The nearest project `.AgentMemory/` is the active root. Most project writes default there.

Subfolders inherit the nearest parent project root. Running refresh inside `project/subfolder/` should use `project/.AgentMemory/` when it exists, not prompt for a new subfolder root. Create a child `.AgentMemory/` only when you explicitly want that subfolder to become its own M-PACT project.

### Standard Root Shape

Both user and project roots may eventually have this shape:

```text
.AgentMemoryRoot/ or .AgentMemory/
  rules/
  sessions.zip
  tasks/
  case-studies.zip
  journal.zip
```

Task folders may contain:

```text
tasks/
  current__A__p2-t0007-short-task-slug
  A__p2-t0007-short-task-slug/
    task.md
    specification.zip
    log.zip
    summary.zip
```

The shape is lazy. A new project bootstrap creates `.AgentMemory/` only. `rules/`, `tasks/`, `sessions.zip`, `case-studies.zip`, and `journal.zip` appear only when first used. A new task folder starts with `task.md`; its specification, log, and summary ZIPs appear only when those records are written.

### Filenames Are The Index

There is no separate index file. Filenames and directory listings are the table of contents.

This matters because memory should be cheap to scan. A good filename tells the agent whether a file is relevant before reading the body.

## Refresh Memory

### What It Does

Refresh loads startup context from the memory chain. It resolves roots, loads the full memory contract, loads core rules, notes non-core rule filenames, reads selected recent sessions, notes active tasks, and reports what was loaded.

### Why Use It

Use refresh so a new or compacted agent context starts grounded in durable memory instead of guessing from partial chat history.

### How To Use It

Start a new local agent session, then ask that agent to refresh M-PACT. The agent should run the skill's refresh helper from the project you are working in, verify the generated bundle, print the compact receipt, and then continue with your actual work. You do not need to tell it which files to read unless you want a targeted lookup after refresh.

### When To Ask For It

Ask for refresh when:

- Starting a new agent context.
- Returning after known or suspected compaction or context loss.
- You explicitly want memory reloaded.

Example:

```text
Use $m-pact and refresh memory.
```

### What To Expect

The agent should emit the compact stdout refresh receipt body, starting with `M-PACT MEMORY REFRESH` and excluding internal begin/end marker lines. It must still verify the bundle at `BundlePath` before emitting the receipt. After the receipt, the refresh flow is done; the agent should not self-verify by scanning memory folders. If refresh succeeds with `LimitHit: true`, the agent should say the bundle is partial and use targeted lookup for omitted content when needed. If refresh fails with `AUDIT: FAIL`, the agent should stop and report the exact failure instead of pretending memory loaded.

Gemini CLI uses `scripts/emit-refresh-bundle.js` for `/m-pact:fast-refresh` and `/m-pact:refresh`. That wrapper generates, validates, and injects the whole refresh bundle as one startup-context document, then Gemini should emit only the receipt body and stop. `/m-pact:fast-refresh` exists to test whether natural Impact requests can be routed into the faster custom-command path. Gemini custom slash commands are still model-mediated, so this may be slower than Codex or Claude Code if Gemini stays in a normal model turn. Inline `!node ...` can also make Gemini continue thinking after the receipt is printed, and Gemini CLI v0.40.1 on Windows did not reliably accept `!` as a standalone shell-mode toggle during testing. For a fast terminal-only receipt outside Gemini's agent turn, run this from PowerShell in the project root:

```powershell
node scripts\emit-refresh-receipt.js
```

### What Not To Do

Do not refresh just because work is large or a handoff exists. While context is intact, use targeted lookup and checkpoints.

## Memory Root Policy

### What It Does

Memory root policy helps the agent understand the intended scope of a read or write without making it reimplement root discovery. Helpers own the mechanics: active root discovery, explicit `--root`, task lookup, user-root validation, chain order, and sentinel rules.

### Why Use It

Use memory root policy when placement matters. It keeps ordinary writes on the active project root, reserves user-root writes for explicit user-level or cross-project intent, and keeps inherited roots read-only by default.

The startup bundle may include root orientation such as the start path, user root, project roots, active project root, memory chain, current-task state, and active task names. It does not include a full memory-root tree by default.

### How To Use It

Name the project, path, or scope when you want something written outside the active project. Otherwise, ask naturally and let the helper resolve the active root. This is useful when you are in one workspace but want to add a task, rule, session, or lookup to another known project.

### Common Requests

```text
Which memory root is active here?
Show the memory chain.
Where would a new session entry be written?
Use the user root for this rule.
Add a task to the Conflab project.
```

## Bootstrap Memory Roots

### What It Does

Bootstrap creates the memory root for a missing `.AgentMemoryRoot/` or `.AgentMemory/`. Project bootstrap does not create local startup shims; provider-global shims should make future Codex, Claude Code, Gemini CLI, and compatible local-agent sessions refresh memory automatically. Artifact folders and ZIP containers are lazy. Copilot-facing shims are included as best-effort future support.

### Why Use It

Use bootstrap when a project or user has no memory root yet and you want agents to start preserving durable context.

### How To Use It

Ask for project bootstrap when the current workspace does not have `.AgentMemory/`. Ask for user-root bootstrap or provider runtime setup when `.AgentMemoryRoot/` does not exist yet. The agent should explain what it is about to create and wait for your approval before writing the root.

### User Root Bootstrap

Approved user-root bootstrap creates the root:

```text
.AgentMemoryRoot/
```

It also installs bundled starter core rules unless you ask to skip them. Installing starter rules creates `rules/` because rule files are being written. If you skip starter rules, `.AgentMemoryRoot/` remains otherwise empty until first use.

The starter rules are editable defaults. Review, edit, delete, or replace any rule that does not fit your workflow.

### Project Bootstrap

Approved project bootstrap creates the root:

```text
.AgentMemory/
```

Before creating that root, project bootstrap ensures `.AgentMemoryRoot/` exists. If it is missing, the agent runs provider runtime setup first. Project bootstrap does not configure project startup shims. Startup is handled by provider-global shims installed during provider runtime setup.

Project bootstrap is only needed when no `.AgentMemory/` exists in the current folder or any ancestor folder. If an ancestor project root exists, the child folder inherits it.

After setup from a refresh preflight yes/no prompt, the agent should run refresh once and emit the receipt for the new `.AgentMemory/`. For a standalone bootstrap request, it should run refresh only if you also ask it to refresh, load, or verify.

### Approval Gate

Bootstrap is never silent. The agent should create only what you approved.

## Find, List, Or Read Memory Artifacts

### What It Does

The lookup procedure searches memory artifacts by scope and type. It searches filenames first, then reads bodies only after narrowing candidates.

### Why Use It

Use lookup when you want to find prior context without loading everything into the current chat.

### How To Use It

Ask the agent to find, list, or read the kind of memory you need and include a few topic words. Lookup is best when you remember that something was discussed but do not know which session, task, rule, case study, or journal entry contains it. The helper should narrow by filenames first, then read only the likely matches.

### Scopes

Unscoped, `local`, or `active` means the active project root.

`root`, `user`, `global`, or `cross-project` means `.AgentMemoryRoot/`.

`parent` means the nearest parent `.AgentMemory/` above the active root.

`all` or `layered` means user root, ancestor project roots, then active root.

Normal lookup is lineage-based. Agents should not scan sibling projects unless you name them.

### Common Requests

```text
List active project sessions.
Find layered rules about review.
Read task A__p1-t0012-refresh-script.
Show case studies about context compaction.
Search user memory for handoff rules.
```

## Rules

### What They Are

Rules are short durable instructions stored in `rules/`. They capture user preferences, behavior constraints, incident-driven lessons, and project-specific operating rules.

Core rules use `core-*.md` filenames and are loaded during refresh. Non-core rules are discovered by filename and read on demand.

### Why Use Them

Use rules when an instruction should persist across sessions and should shape future agent behavior.

Good rule topics:

- A repeated agent failure mode.
- A workflow constraint.
- A project-specific behavior that should not be forgotten.
- A broad preference that is too important to rely on chat memory.

### How To Use Them

Ask for a rule when you want future agents to behave differently, not just remember what happened. Say whether the rule is project-level or user-level. The agent should check for an existing matching rule when duplication is plausible, then write or update the smallest rule that captures the durable behavior.

### How Rules Are Written

The filename should carry the main meaning, such as:

```text
core-review-implementation-against-spec-first.md
```

The frontmatter `description` adds scope, trigger, or nuance beyond the filename. The body should not repeat the filename or description.

### Approval Gate

Ambiguous or judgment-call rules require Director confirmation. User-level/global rules require explicit user-level placement.

### Common Requests

```text
Add a project rule that agents must read the spec before reviewing code.
Write this as a user-level rule.
Check whether we already have a rule for this.
Update the existing handoff rule instead of creating a duplicate.
```

## Sessions

### What They Are

Session entries are append-only summaries in `sessions.zip`. They preserve cross-task or project-wide continuity.

### Why Use Them

Use sessions when something happened outside a single task, or when future agents need a compact project-level checkpoint.

### How To Use Them

Ask for a session entry when you are ending a work period, approaching context limits, switching providers, or recording a project-wide decision. The agent should write a concise but useful handoff with a strong summary so the next refresh can orient the next agent quickly.

### Startup Behavior

Startup refresh reads the newest active-root session in full and selected older sessions by summary. Put startup-relevant context in `## Summary`.

### What They Are Not

Session entries are not prompts, task assignments, or implementation directives. They are informational context.

### Common Requests

```text
Write a session entry summarizing today's M-PACT changes.
List recent active project sessions.
Read the newest session in full.
```

## Tasks

### What They Are

Tasks are folders under `tasks/`. They store durable task state, ordered logs, optional current specifications, and summaries.

Task folder names encode status, priority, task number, and slug:

```text
A__p1-t0003-refresh-script-hardening/
C__px-t0010-old-investigation/
```

`A__` means active. `C__` means closed.

### Why Use Them

Use tasks when work needs structured continuity across agents or sessions. Tasks are the right tool for multi-step implementation, investigations, reviews, and handoffs.

Tasks can also be useful for standing workstreams, such as UI polish or article refinement, where the subject stays stable but individual passes are small. In that case, use summaries to keep the task readable instead of creating a new task for every small pass.

### How To Use Them

Ask for a task when work needs continuity, review, implementation steps, testing, or a handoff between agents. Give the agent the goal, priority if it matters, and any acceptance criteria you already know. The agent should create the task, make it current, and write an initial log entry when the task comes from the current conversation.

### Task Creation

Task creation is Director-orchestrated only. The agent should not create a task based only on its own judgment.

You can create a task from a fresh instruction:

```text
Add a p2 task for documenting M-PACT user workflows.
Create a p2 task for documenting M-PACT user workflows.
```

You can also create a task from the live conversation:

```text
Make this a task.
Create a task from this conversation.
```

For conversation-created tasks, the agent should create an ordinary task with the next normal task number, derive a meaningful title and slug from the discussion, make it current, and write the first task log entry with enough state for another agent or future context to resume. This is not a separate scratch-task type; it is just a normal task whose source material was the conversation.

If you say only "add a task" or "create a task," the agent may ask a short clarification unless the current conversation has one obvious topic. If you say "make this a task" or "create a task from this conversation," it should not stop to ask for a title by default.

### Current Task Pointer

The current task pointer is a zero-byte sentinel named `tasks/current__<active-task-folder>`. The pointer is entirely in the filename and has no extension or body. It is an attention pointer, not a task index, queue, activity timestamp, or log cursor. If there is no current task, no `current__*` file should exist. If multiple `current__*` files exist, agents should delete all of them and proceed as if there is no current task.

### Task Close And Reopen

Closing or reopening a task requires explicit Director instruction. Close marks the task closed. Reopen marks it active again and makes it current.

Close a task when you have decided the work is complete or no longer active. Reopen it when follow-up work belongs with the same task history instead of a new task. The agent should not close or reopen based only on its own sense that the work is done.

Common requests:

```text
Close the current task as complete.
Reopen t0008 because we found follow-up work.
```

## Task Handoffs

### What They Are

A task handoff is a read/analyze/evaluate/report operation for an existing task. The agent reads `task.md`, the latest `specification.zip` member when present, relevant summaries when useful, and the ordered log span needed for continuity. The expected output is not just a summary: the agent should evaluate the current handoff span for feasibility, risks, assumptions, implementation or specification issues, and recommend the best next path when evidence supports one.

### Why Use Them

Use handoffs when one agent or session needs to understand current task state before deciding what to do next.

### How To Use Them

Ask the receiving agent to take the current task handoff when you want it to understand the task before acting. The agent should read the task, current spec, relevant summaries, and the needed ordered log span, then report state, risks, assumptions, and recommended next steps. Ask it to implement, edit, or log separately if you want it to continue beyond analysis.

You can also use a handoff phrase to create the handoff task from the current conversation:

```text
Handoff.
Handoff to Claude.
Hand this off.
```

In that case, the current agent should create a normal task from the conversation, make it current, and write the first log entry as the compressed handoff state. Naming an agent is optional. If you name the same agent you are already using, the request still makes sense: it creates a durable context-switch point.

Standalone `handoff` means create a new task from the live conversation. It should not append to an older task just because a `tasks/current__*` sentinel still points there from earlier work. To write a handoff for an existing task instead, say that explicitly:

```text
Write a handoff for the current task.
Handoff this task.
Write a handoff log to task A__p2-t0012-example.
```

After a created handoff, go to the other agent or new session and say:

```text
Take handoff.
Take handoff from Codex.
```

The receiving agent should resolve the single `tasks/current__*` sentinel, then take that task handoff.

### Cold-Start Log Loading

When an agent enters a task from a fresh session or after context loss, it should load enough context to work without silently consuming the whole conversation history.

Default behavior now starts with the handoff read-plan helper:

```text
1. Run scripts/prepare-handoff.js for the current or named task.
2. Pass any conversation-known read cursor.
3. Read task.md, the current specification snapshot, and the recommended log span in order.
4. Treat summaries as background boundaries, not replacements for later log records.
```

The helper owns the byte-budget and collision checks. A cursor or summary boundary should prevent old logs from being treated as current. The agent may still read older logs as background context when useful, but it should not act on them as live state when later records have superseded them. When it does not read all logs, it should say what range it read as the current span, what boundary it used, and what older history it loaded only as background or skipped.

### Important Limit

"Take this handoff" does not by itself authorize implementation, spec edits, doc edits, task-state changes, or log writes. It means read, analyze, evaluate, verify, and report unless you also explicitly ask the agent to continue implementation or update memory. If judging the handoff requires checking the codebase, spec, tests, or docs, the agent should inspect those artifacts and then give you its recommendation rather than leaving the interpretation entirely to you.

### Common Requests

```text
Take the current task handoff and tell me the state.
Resume task A__p1-t0004-example from log 0008 onward.
Read enough log history to reconstruct the current task state.
```

## Task Logs

### What They Are

Task logs are append-only records in a task's `log.zip` container. Each log member has a global record number within that task.

Example:

```text
0009-codex-update-refresh-docs.md
0010-claude-review-docs.md
```

### Why Use Them

Use task logs to preserve what happened, what was decided, what changed, and what a future agent must know.

### How To Use Them

Ask for a task log after a decision, implementation pass, review, test result, handoff, or important correction. Logs are best for chronological task state. The agent should write the next numbered log through the helper and include enough detail for another agent to resume without reading the whole chat.

### Numbering Rule

When writing a log entry, the helper handles `log.zip` placement and uses the next record number from the container entry count. The agent supplies the task, agent name, title, body, and metadata from the current request and current conversation. It should not read existing log entries just to write the next log, and it must not assign the record number itself.

### Common Requests

```text
Write a task log checkpoint for this decision.
Write a handoff log entry for the next agent.
```

## Task Specifications

### What They Are

`specification.zip` stores numbered specification snapshots. The highest-numbered member is the current state of the task. A task has no specification container until the first approved specification write.

### Why Use It

Use the task specification when the current task has an evolving source of truth that should be easier to read than a long log chain.

### How To Use It

Ask for a task specification when requirements, design decisions, acceptance criteria, or implementation plans need one current written version. The helper writes a new numbered spec snapshot and a paired task log so the task history explains why the spec changed.

### Approval Gate

Agents should not write a new specification snapshot unless you instruct them to update the spec or fold approved decisions into it.

### Common Requests

```text
Write the task specification with this decision and write the paired log.
Fold these requirements into the current spec.
```

## Task Summaries

### What They Are

Task summaries live in `summary.zip`. They are generated on demand to compress long task histories, capture current state, or create a compact handoff map. A task has no summary container until the first summary is written.

### Why Use Them

Use summaries when the log is long enough that future agents need a compact map before reading targeted log records. They are especially useful for standing tasks that stay open across many small passes, such as recurring UI cleanup, polish, article refinement, or ongoing investigation.

### How To Use Them

Ask for a summary when a task has enough logs that handoff is getting expensive or when you want a compact checkpoint before switching agents. The agent should summarize the relevant log range and leave later handoffs free to read only the summary plus newer logs.

### Default Range

When you ask for a task summary without naming a range, the agent should write an incremental summary. It summarizes from the first log record after the latest relevant summary through the newest log record.

If there is no prior relevant summary, the agent summarizes from the first log record. If you want the whole history, ask for a complete, full, or from-the-beginning summary.

The latest relevant summary matters. A thematic summary such as `open-questions` should not become the range boundary for a general current-state or handoff summary unless it really covers that span.

### Important Limit

Summaries do not automatically replace unseen log records during handoff. They help orientation, but the agent may still need the ordered log span for continuity.

### Common Requests

```text
Write a task summary.
Summarize the current task since the last relevant summary.
Write a handoff summary through the latest log entry.
Write a complete summary of this task from the beginning.
```

## Case Studies

### What They Are

Case studies are narrative write-ups in `case-studies.zip`. They describe incidents, investigations, decisions, pivots, root causes, fixes, and lessons learned.

### Why Use Them

Use case studies when a lesson is too rich for a rule. A rule says what to do; a case study explains why the rule exists and how the lesson was learned.

### How To Use Them

Ask for a case study after a meaningful success, failure, debugging incident, design pivot, or process lesson. They are useful when future agents should understand the story, tradeoffs, symptoms, root cause, and prevention pattern rather than just follow a one-line rule.

### Startup Behavior

Case studies are not read at startup. Agents load them on demand when the topic is relevant.

### Common Requests

```text
Create a case study for this failed refresh investigation.
Find case studies about task log numbering.
Read the case study that explains the filename-led rule model.
```

## Journals

### What They Are

Journal entries are first-person, Director-voiced reflective notes in `journal.zip`.

### Why Use Them

Use journals when you want to preserve your own thinking, design reflections, or historical notes for future readers.

### How To Use Them

Ask for a journal entry when you want a Director-voiced note that records your reasoning, preferences, or project history without turning it into an instruction. Journals are good for reflection and background context; they are not a command channel for future agents.

### Important Limit

Journal entries are not prompts, assignments, or startup context. Agents should write them only when you explicitly ask.

### Common Requests

```text
Write a journal entry in my voice about this design pivot.
List project journal entries from last week.
Read the user-level journal entry about Conflab-Code.
```

## Starter Rules

### What They Are

Starter rules are bundled defaults installed during initial `.AgentMemoryRoot/` bootstrap, unless you ask to skip them.

### Why Use Them

They give new memory roots a baseline behavior profile: verify before claiming, diagnose before fixing, protect context, keep answers concise, respect Director authority, and treat user rules as incident-driven.

### How To Use Them

Use starter rules as editable defaults after first setup. Review them once the user root exists, keep the ones that match your workflow, and change or delete the ones that do not. New behavior that you discover later should usually become a normal rule, not an edit to a starter rule unless it belongs in that baseline.

### Important Limit

Starter rules are not immutable policy. They are editable defaults. Review each one and edit, delete, or replace rules that do not match your workflow.

## Shims

### What They Are

The package includes small `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` shims. Their job is to tell compatible agents to invoke M-PACT and run refresh on new context.

### Why Use Them

Use provider-global shims when you want a runtime to invoke M-PACT on startup.

Project bootstrap does not install these shims. Provider runtime setup writes the current provider's shim to a provider-global location such as `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, or `~/.gemini/GEMINI.md`. `shims/copilot-instructions.md` is available as optional best-effort material if the Director wants GitHub Copilot custom instructions.

### How To Use Them

Place M-PACT in each provider's normal skill or extension folder, then run provider runtime setup from that provider's installed copy. The setup helper installs only that provider's global shim. Repeat the same process separately for Codex, Claude Code, and Gemini CLI when you want all of them configured.

## Recommended Workflows

### New Project

1. Bootstrap M-PACT for the project.
2. Confirm `.AgentMemory/` was created.
3. Add only project-specific rules when real project behavior needs to persist.
4. Use sessions for broad continuity and tasks for structured work.

### New User Setup

1. Install/place M-PACT for each provider you want to use, then run provider runtime setup.
2. Review starter rules.
3. Add user-level rules only for broad behavior that should follow you across projects.

### Multi-Agent Task

1. Create a task with priority and clear acceptance.
2. Keep current state in `specification.zip` snapshots when the task has evolving requirements.
3. Write task logs for decisions, implementations, reviews, and handoffs.
4. Use task summaries to compress long or standing task histories.
5. Tell the next agent to take the task handoff.
6. Close the task only when you explicitly decide it is done.

### Context Hygiene

1. Refresh only at startup, compaction/context loss, or explicit request.
2. Use targeted lookup while context is intact.
3. Mention session preservation only when continuity risk is high.
4. Store narrative lessons as case studies, not long rules.
5. Store durable behavior as short rules, not long sessions.

## Safety And Authority Model

M-PACT is designed to avoid silent state changes. Agents should surface durable writes and should ask when a memory operation is ambiguous.

Director approval is required for:

- Bootstrap.
- Deletion.
- Task creation.
- Task close.
- Task reopen.
- Ambiguous durable rules.
- Writes to inherited or non-local roots.
- User-level/global placement unless explicitly requested.

Agents may proceed through low-risk details once you clearly authorize the operation.

## Choosing The Right Artifact

Use a rule when future agent behavior should change.

Use a session when project-wide continuity should be remembered.

Use a task when structured work needs state, logs, or handoffs.

Use a task log when a task-scoped event or decision needs an append-only record.

Use a task specification when a task needs a mutable current source of truth.

Use a task summary when long logs need compression.

Use a case study when the lesson needs a narrative.

Use a journal when you want a Director-voiced reflection.

Use bootstrap when a root does not exist.

Use refresh when the current agent context needs startup memory.

Use targeted lookup when you need prior context without flooding the current chat.
