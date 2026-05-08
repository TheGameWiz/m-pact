# M-PACT: Multi-Provider Agent Context Toolkit User Guide

M-PACT is a multi-provider agent context toolkit for visible agent sessions. It was designed and validated for Codex, Claude Code, and Gemini CLI, and lets compatible local agents carry durable context across tabs, providers, and sessions without pretending chat history is permanent or stuffing every detail into startup prompts.

Multi-provider is the headline. The underlying unit is still an agent session: you can run several sessions from the same provider, several providers side by side, or any mix that fits the work. M-PACT keeps those sessions grounded in the same durable rules, task state, handoffs, decisions, and historical notes.

The system has one important separation:

- The `m-pact` skill owns procedures: refresh, lookup, bootstrap, task operations, rule writing, and artifact templates.
- Memory roots hold state: rules, sessions, tasks, case studies, and journals.

This guide describes the user-facing operations, what each one is for, and why you would ask an agent to use it.

## Install Targets

M-PACT is packaged as one folder with native entrypoints for multiple local agent runtimes:

```text
~/.codex/skills/m-pact/
~/.claude/skills/m-pact/
~/.copilot/skills/m-pact/      # or ~/.agents/skills/m-pact/
~/.gemini/extensions/m-pact/   # or link this repo with gemini extensions link
```

Use `$m-pact` in Codex, `/m-pact` in Claude Code, and `/m-pact:fast-refresh` in Gemini CLI. `/m-pact:refresh` remains a Gemini compatibility command. Copilot CLI may use `/m-pact` or `m-pact` if its runtime exposes the skill, but this path is best-effort until validated. In dictated Gemini requests, `Impact` is the spoken alias for M-PACT, for example `refresh Impact` or `Impact refresh`. Gemini is instructed to route these natural M-PACT requests, including `m-pact refresh`, to `/m-pact:fast-refresh` when possible, then emit only the receipt body and stop. Plain `refresh memory` remains the ordinary refresh wording for Codex, Claude Code, and Copilot-style agents, but Gemini should not treat it as M-PACT unless the request also names Impact or M-PACT.

Codex and Claude Code use `SKILL.md`. Gemini CLI uses `gemini-extension.json`, root `GEMINI.md`, and `commands/`. Copilot CLI-facing instructions are included for future compatibility, but Copilot CLI has not yet been validated as a first-class supported runtime.

## Compatibility
M-PACT startup refresh is for local agent runtimes only. Codex CLI, Claude Code, and Gemini CLI are the validated targets. Copilot CLI and other compatible local agents may work if they have shell access, filesystem access, and Node.js 18 or newer, but they are best-effort until tested.

Web-only ChatGPT or Claude clients may be able to read or install skill instructions in products that support skills, but they cannot refresh local `.AgentMemoryRoot/` or `.AgentMemory/` folders directly. For web-only work, provide an uploaded refresh bundle or uploaded memory artifacts instead of asking the web agent to run local refresh.

## Quick Start

### New Project Setup

Install makes the skill available globally. A new workspace still needs project setup.

For a new project, ask:

```text
Set up m-pact for this project.
```

The agent should create or repair `.AgentMemory/` and create or append the M-PACT startup shims in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. It should not run refresh after bootstrap unless you also ask it to refresh, load, or verify. `AGENTS.md` is also the default project shim for Copilot-compatible agents; `shims/copilot-instructions.md` is available as an optional GitHub Copilot custom-instructions template.

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

The agent should run the skill's refresh procedure, load the memory chain, and emit the refresh receipt body verbatim. The visible receipt starts with `M-PACT MEMORY REFRESH`; internal begin/end marker lines in the bundle are not shown. That receipt proves memory was loaded and tells you which roots, rules, sessions, and task pointer were seen.

After the receipt, the agent should not scan `.AgentMemory`, sessions, rules, tasks, or the generated bundle just to verify the refresh. The bundle is already the verified startup context. Ask for targeted lookup when you want a specific memory artifact.

This startup refresh is the practical bridge for multi-provider work. A Codex tab, a Claude Code tab, and a Gemini CLI session can all begin from the same memory chain instead of acting like separate isolated chats. Copilot CLI is a plausible future target, but the current project should describe it as unvalidated best-effort support.

If refresh succeeds but says `project: (none found)`, only your user-level memory was loaded. The agent should offer to set up the project by creating or repairing `.AgentMemory/`, creating or appending `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` startup shims, and running refresh again to verify the local root is active.

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
Append a task log checkpoint for what we just decided.
Update the task specification with this decision and write the log entry.
Close this task as complete.
Reopen task A__p2-t0007-example because there is follow-up work.
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

Project bootstrap creates the local memory folders and configures startup shims in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. If those files already exist, the agent should append the M-PACT section instead of overwriting your existing agent instructions.

If your user root is missing, ask:

```text
Bootstrap my .AgentMemoryRoot with the starter rules.
```

User-root bootstrap installs bundled starter core rules unless you ask to skip them. These starter rules are editable defaults. Review them and edit, delete, or replace anything that does not fit your workflow.

As a general pattern: start each new context with refresh, use targeted reads during normal work, and write the smallest durable artifact that fits. Use a rule for behavior, a task log for task state, a session for broad continuity, and a case study for a narrative lesson.

## Core Concepts

### Director

The user is the Director. The Director has decision authority over task creation, durable rules, memory writes, bootstrap, migration, deletion, close/reopen actions, and ambiguous judgment calls.

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

### Standard Root Structure

Both user and project roots use the same standard folders:

```text
.AgentMemoryRoot/ or .AgentMemory/
  rules/
  sessions/
  tasks/
  case-studies/
  journal/
```

Task folders may contain:

```text
tasks/
  current-task.md
  A__p2-t0007-short-task-slug/
    task.md
    specification.md
    log/
    summary/
```

### Filenames Are The Index

There is no separate index file. Filenames and directory listings are the table of contents.

This matters because memory should be cheap to scan. A good filename tells the agent whether a file is relevant before reading the body.

## Refresh Memory

### What It Does

Refresh loads startup context from the memory chain. It resolves roots, loads the full memory contract, loads core rules, notes non-core rule filenames, reads selected recent sessions, notes active tasks, and reports what was loaded.

### Why Use It

Use refresh so a new or compacted agent context starts grounded in durable memory instead of guessing from partial chat history.

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

The agent should emit a verbatim refresh receipt body, starting with `M-PACT MEMORY REFRESH` and excluding internal begin/end marker lines. After the receipt, the refresh flow is done; the agent should not self-verify by scanning memory folders. If refresh succeeds with `LimitHit: true`, the agent should say the bundle is partial and use targeted lookup for omitted content when needed. If refresh fails with `AUDIT: FAIL`, the agent should stop and report the exact failure instead of pretending memory loaded.

Gemini CLI uses `scripts/emit-refresh-bundle.js` for `/m-pact:fast-refresh` and `/m-pact:refresh`. That wrapper generates, validates, and injects the whole refresh bundle as one startup-context document, then Gemini should emit only the receipt body and stop. `/m-pact:fast-refresh` exists to test whether natural Impact requests can be routed into the faster custom-command path. Gemini custom slash commands are still model-mediated, so this may be slower than Codex or Claude Code if Gemini stays in a normal model turn. Inline `!node ...` can also make Gemini continue thinking after the receipt is printed, and Gemini CLI v0.40.1 on Windows did not reliably accept `!` as a standalone shell-mode toggle during testing. For a fast terminal-only receipt outside Gemini's agent turn, run this from PowerShell in the project root:

```powershell
node scripts\emit-refresh-receipt.js
```

### What Not To Do

Do not refresh just because work is large or a handoff exists. While context is intact, use targeted lookup and checkpoints.

## Resolve Memory Roots

### What It Does

Root resolution identifies the user root, every ancestor project root, the active project root, and the default write target for the requested artifact.

### Why Use It

Use root resolution when placement matters. It prevents agents from writing a project rule into user memory, writing to a parent project by accident, or scanning unrelated sibling projects.

### Common Requests

```text
Which memory root is active here?
Show the memory chain.
Where would a new session entry be written?
Use the user root for this rule.
```

## Bootstrap Memory Roots

### What It Does

Bootstrap creates the standard memory folder structure for a missing `.AgentMemoryRoot/` or `.AgentMemory/`. Project bootstrap also creates or embeds local startup shims so future Codex, Claude Code, Gemini CLI, and compatible local-agent sessions refresh memory automatically. Copilot-facing shims are included as best-effort future support.

### Why Use It

Use bootstrap when a project or user has no memory root yet and you want agents to start preserving durable context.

### User Root Bootstrap

Approved user-root bootstrap creates:

```text
.AgentMemoryRoot/
  rules/
  sessions/
  tasks/
  case-studies/
  journal/
```

It also installs bundled starter core rules unless you ask to skip them.

The starter rules are editable defaults. Review, edit, delete, or replace any rule that does not fit your workflow.

### Project Bootstrap

Approved project bootstrap creates:

```text
.AgentMemory/
  rules/
  sessions/
  tasks/
  case-studies/
  journal/
```

It also configures:

```text
AGENTS.md
CLAUDE.md
GEMINI.md
```

If a shim file is missing, the agent creates it from the bundled shim. If a shim file already exists, the agent appends the M-PACT shim section while preserving the existing content. If the file already invokes M-PACT, the agent leaves it unchanged. If there are conflicting M-PACT instructions, the agent should stop and ask how to merge them.

After setup, the agent should run refresh once and verify that the new `.AgentMemory/` is the active project root.

### Approval Gate

Bootstrap is never silent. The agent should create only what you approved.

## Find, List, Or Read Memory Artifacts

### What It Does

The lookup procedure searches memory artifacts by scope and type. It searches filenames first, then reads bodies only after narrowing candidates.

### Why Use It

Use lookup when you want to find prior context without loading everything into the current chat.

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

Session entries are append-only summaries in `sessions/`. They preserve cross-task or project-wide continuity.

### Why Use Them

Use sessions when something happened outside a single task, or when future agents need a compact project-level checkpoint.

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

### Task Creation

Task creation is Director-orchestrated only. The agent should not create a task based only on its own judgment.

You can create a task from a fresh instruction:

```text
Create a p2 task for documenting M-PACT user workflows.
```

You can also create a task from the live conversation:

```text
Make this a task.
Create a task from this conversation.
```

For conversation-created tasks, the agent should create an ordinary task with the next normal task number, derive a meaningful title and slug from the discussion, make it current, and write the first task log entry with enough state for another agent or future context to resume. This is not a separate scratch-task type; it is just a normal task whose source material was the conversation.

If you say only "create a task," the agent may ask a short clarification unless the current conversation has one obvious topic. If you say "make this a task" or "create a task from this conversation," it should not stop to ask for a title by default.

### Current Task Pointer

`tasks/current-task.md` points to the active task explicitly made current. It is an attention pointer, not a task index or queue. If there is no current task, the file should be absent; agents should never infer a replacement from other active tasks.

### Task Close And Reopen

Closing or reopening a task requires explicit Director instruction. Close appends a closing log entry, renames `A__` to `C__`, and updates task status. Reopen does the reverse and appends a reopen log entry.

Common requests:

```text
Close the current task as complete.
Reopen C__p2-t0008-example because we found follow-up work.
```

## Task Handoffs

### What They Are

A task handoff is a read/analyze/evaluate/report operation for an existing task. The agent reads `task.md`, `specification.md` when present, relevant summaries when useful, and the ordered log span needed for continuity.

### Why Use Them

Use handoffs when one agent or session needs to understand current task state before deciding what to do next.

You can also use a handoff phrase to create the handoff task from the current conversation:

```text
Handoff.
Handoff to Claude.
Hand this off.
```

In that case, the current agent should create a normal task from the conversation, make it current, and write the first log entry as the compressed handoff state. Naming an agent is optional. If you name the same agent you are already using, the request still makes sense: it creates a durable context-switch point.

Standalone `handoff` means create a new task from the live conversation. It should not append to an older task just because `tasks/current-task.md` still points there from earlier work. To write a handoff for an existing task instead, say that explicitly:

```text
Write a handoff for the current task.
Handoff this task.
Append a handoff log to task A__p2-t0012-example.
```

After a created handoff, go to the other agent or new session and say:

```text
Take handoff.
Take handoff from Codex.
```

The receiving agent should read `tasks/current-task.md`, then take that task handoff.

### Cold-Start Log Loading

When an agent enters a task from a fresh session or after context loss, it should load enough context to work without silently consuming the whole conversation history.

Default behavior:

```text
1. Read task.md.
2. Read specification.md when present.
3. List log filenames with sizes.
4. If logs total 50KB or less, read all logs.
5. If logs exceed 50KB, read newest logs backward up to about 50KB unless you asked for all logs or a specific range.
```

If the newest single log is larger than 50KB, the agent should read that newest log rather than splitting it. When it does not read all logs, it should say what range it read and what older history it skipped. If the older logs appear to switch to a different workstream, it should say that too and offer to read another chunk or search older logs for a specific decision.

### Important Limit

"Take this handoff" does not by itself authorize implementation, spec edits, doc edits, task-state changes, or log writes. It means read, analyze, evaluate, verify, and report unless you also explicitly ask the agent to continue implementation or update memory.

### Common Requests

```text
Take the current task handoff and tell me the state.
Resume task A__p1-t0004-example from log 0008 onward.
Read enough log history to reconstruct the current task state.
```

## Task Logs

### What They Are

Task logs are append-only records in a task's `log/` folder. Each log file has a global record number within that task.

Example:

```text
0009-codex-update-refresh-docs.md
0010-claude-review-docs.md
```

### Why Use Them

Use task logs to preserve what happened, what was decided, what changed, and what a future agent must know.

### Numbering Rule

Immediately before writing a log entry, the agent must re-list the log folder and use the next unused number after the highest existing record. It must not rely on a stale remembered number.

### Common Requests

```text
Append a task log checkpoint for this decision.
Write a handoff log entry for the next agent.
```

## Task Specifications

### What They Are

`specification.md` is the mutable current state of a task. It may contain requirements, refined decisions, implementation plan, acceptance criteria, or design state.

### Why Use It

Use the task specification when the current task has an evolving source of truth that should be easier to read than a long log chain.

### Approval Gate

Agents should not update `specification.md` unless you instruct them to update the spec or fold approved decisions into it.

### Common Requests

```text
Update the task specification with this decision and append the log.
Fold these requirements into the current spec.
```

## Task Summaries

### What They Are

Task summaries live in `summary/`. They are generated on demand to compress long task histories, capture current state, or create a compact handoff map.

### Why Use Them

Use summaries when the log is long enough that future agents need a compact map before reading targeted log records. They are especially useful for standing tasks that stay open across many small passes, such as recurring UI cleanup, polish, article refinement, or ongoing investigation.

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

Case studies are narrative write-ups in `case-studies/`. They describe incidents, investigations, decisions, pivots, root causes, fixes, and lessons learned.

### Why Use Them

Use case studies when a lesson is too rich for a rule. A rule says what to do; a case study explains why the rule exists and how the lesson was learned.

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

Journal entries are first-person, Director-voiced reflective notes in `journal/`.

### Why Use Them

Use journals when you want to preserve your own thinking, design reflections, or historical notes for future readers.

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

### Important Limit

Starter rules are not immutable policy. They are editable defaults. Review each one and edit, delete, or replace rules that do not match your workflow.

## Shims

### What They Are

The package includes small `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` shims. Their job is to tell compatible agents to invoke M-PACT and run refresh on new context.

### Why Use Them

Use shims when you want a project to opt into the skill without copying the full operating protocol into every repository instruction file.

Project bootstrap should install these shims. If the project already has `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md`, setup should append the M-PACT shim section to the existing file rather than replacing it. `AGENTS.md` is the default Copilot-compatible project shim; `shims/copilot-instructions.md` can also be copied to `.github/copilot-instructions.md` when the Director wants GitHub Copilot custom instructions.

## Recommended Workflows

### New Project

1. Bootstrap M-PACT for the project.
2. Confirm `.AgentMemory/`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` were created or updated.
3. Add only project-specific rules when real project behavior needs to persist.
4. Use sessions for broad continuity and tasks for structured work.

### New User Setup

1. Bootstrap `.AgentMemoryRoot/`.
2. Install starter rules unless you want a blank root.
3. Review starter rules.
4. Add user-level rules only for broad behavior that should follow you across projects.

### Multi-Agent Task

1. Create a task with priority and clear acceptance.
2. Keep current state in `specification.md` when the task has evolving requirements.
3. Append task logs for decisions, implementations, reviews, and handoffs.
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
- Migration.
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
