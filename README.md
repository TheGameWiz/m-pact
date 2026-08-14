# M-PACT: Multi-Provider Agent Context Toolkit

M-PACT helps local coding agents share memory. It was designed and validated for Codex and Claude Code, with Antigravity support replacing the retired Gemini CLI extension. Its goal is simple: let agents remember useful project information, share it with each other, and pick up work without depending on one chat window to hold everything.

M-PACT stores memory at two levels: global memory that can follow you across projects, and project memory that belongs to one workspace. That memory can include shared rules, session notes, project tasks, task logs, task specifications, task summaries, case studies, and project journals.

This makes it possible to use more than one agent on the same project at the same time. One agent can work on a design, another can review it, another can implement it, and another can verify the code. They can hand work back and forth through task logs and specifications instead of reconstructing state from chat history.

The skill owns the procedures. Memory roots hold the state.

Multi-provider is the headline, but the base unit is still an agent session. Several sessions can use the same provider, different providers, or a mix of both. The point is that every agent tab can enter the same project with the same durable memory and a common task record.

## Install Targets

M-PACT is packaged as one folder with native entrypoints for multiple local agent runtimes:

- Codex and Claude Code use `SKILL.md` and are first-class validated targets.
- Antigravity uses the same `SKILL.md` skill folder shape, plus a provider-global `PreInvocation` hook and a global backstop shim.
- Copilot CLI may work with the same `SKILL.md` folder and Copilot-facing shims, but it has not yet been validated as a first-class supported runtime.

Gemini CLI is no longer listed as validated. Enterprise Gemini Code Assist licensees may still have a working Gemini CLI, but M-PACT no longer ships a Gemini CLI extension.

Install M-PACT separately for each provider you want to use. After placing M-PACT in that provider's skill folder, run the bundled runtime setup helper from that provider's installed copy:

```text
node scripts/install-mpact.js
```

Provider skill placement is provider-specific and follows the normal skill model:

```text
~/.codex/skills/m-pact/
~/.claude/skills/m-pact/
~/.gemini/config/skills/m-pact/   # Antigravity
```

Copilot CLI may later use `~/.copilot/skills/m-pact/` or `~/.agents/skills/m-pact/`, but that install path remains best-effort and is not enabled by the default helper.

The setup helper does not copy itself across provider roots. It creates or preserves the user memory root at `~/.AgentMemoryRoot/`, creates or preserves the `project-count__<n>` identity counter, installs starter user-root rules without overwriting existing rule files, and installs only the current or explicitly requested provider-global startup shim:

```text
~/.codex/AGENTS.md
~/.claude/CLAUDE.md
~/.gemini/GEMINI.md
```

Project setup is separate from install. Install does not create project `.AgentMemory/` roots or project-local instruction files. Repeat provider placement and runtime setup for Codex, Claude, and Antigravity separately when you want all three configured.

Use `node scripts/install-mpact.js --disable` when you want the skill to stay installed and invocable but stop automatic startup refresh. Use `node scripts/install-mpact.js --enable` to restore startup shims and hooks. Use `node scripts/uninstall-mpact.js` when you want to remove provider shims, M-PACT-owned hooks, provider permission entries for the resolved M-PACT user root, and installed M-PACT skill directories. Uninstall does not delete `.AgentMemoryRoot/` or project `.AgentMemory/` folders; memory deletion is a separate manual action.

Invoke it as `$m-pact` in Codex, `/m-pact` in Claude Code, or `/m-pact` in Antigravity when skill invocation is available. Copilot CLI may use `/m-pact` or `m-pact` if its runtime exposes the skill, but this path is best-effort until validated.

## Requirements
- Node.js 18 or newer is required for startup refresh.
- Startup refresh requires a local agent runtime with shell access and filesystem access. Codex CLI and Claude Code are validated targets; Antigravity is configured through its skill and hook surfaces. Copilot CLI and other compatible local runtimes are best-effort until tested.
- Web-only ChatGPT or Claude clients cannot refresh local `.AgentMemoryRoot/` or `.AgentMemory/` folders directly. Use an uploaded refresh bundle or uploaded memory artifacts instead.
- The refresh procedure uses the bundled `scripts/build-refresh-bundle.js` script and only Node built-in modules. No npm package install is required.
- Check availability with `node --version`.

## Harness Suppression

Set `MPACT_SUPPRESS` to a truthy value, such as `1`, when another launcher, wrapper, or harness should own startup and runtime context for the session because its own memory or context system may conflict with M-PACT. ConflabCode is the motivating case. This is a compatibility guard for hosts, not the ordinary user off switch.

Provider startup shims and helper scripts treat suppression as an intentional state: they do not refresh memory, do not load M-PACT context, and helpers print `M-PACT SUPPRESSED`. Direct helper invocations exit nonzero; installed hook invocations exit cleanly so the suppression notice can be injected without logging a failed hook run. Disable and enable remain gated by suppression because they are setup commands. Uninstall remains available under suppression because it reads and writes no memory.

To use M-PACT again, unset `MPACT_SUPPRESS`, set it to an empty value, or start a normal session without that environment variable.

## What It Is For

Use this skill when you want agents to:

- Share useful memory between providers and sessions at both global and project levels.
- Start a new context with the right rules, recent sessions, active tasks, and project orientation.
- Create shared rules that teach agents your coding style, project habits, and recurring lessons.
- Use task logs, specifications, and summaries to design, implement, review, test, and verify work in a visible loop.
- Hand work from one agent to another without relying on chat history or oversized startup prompts.
- Preserve decisions, checkpoints, task progress, and context-window handoffs across sessions.
- Keep project memory separate from user-level memory.
- Capture richer successes, failures, investigations, and lessons as case studies instead of long standing instructions.

It is not meant to duplicate source code, git history, or information an agent can cheaply recover from local project files.

## Memory Roots

M-PACT uses two root types:

```text
~/.AgentMemoryRoot/      # user-level memory
.AgentMemory/           # project-level memory
```

The memory chain is broad-to-specific: user root first, then ancestor project roots, then the nearest project root. The nearest `.AgentMemory/` is the active project root for ordinary project writes.

Each root uses the same standard folders:

```text
project-count__<n>       # user root only
project__<path-slug>     # project roots only
rules/
sessions.zip
tasks/
case-studies.zip
journal.zip
```

Project identity sentinels are helper-owned. New project bootstrap mints a local project ID automatically. Existing pre-identity roots use lazy confirmed adoption: refresh or a durable write reports `M-PACT PROJECT ADOPTION REQUIRED`, asks for a Director yes, and only the one-root adoption helper mints identity. Path-mismatched or malformed identity still requires repair instead of hand editing.

## Quick Use

Provider placement makes the skill available to that provider. Runtime setup configures that provider's global startup shim and creates the user `.AgentMemoryRoot/`. A new workspace still needs project setup.

For a new project, ask:

```text
Set up m-pact for this project.
```

The project bootstrap helper ensures required user-root setup before adding the project scaffold: `.AgentMemory/` with its project identity sentinel. It should not run refresh after bootstrap unless you also ask it to refresh, load, or verify. Provider-global shims should invoke M-PACT for configured runtimes; project bootstrap does not write project instruction files.

At the start of a new context, ask the agent:

```text
Use $m-pact and refresh memory.
```

The agent should run the bundled refresh procedure without separately probing `.AgentMemoryRoot/` first. If the user root is truly missing, refresh performs provider runtime setup mechanics and continues. If no project `.AgentMemory/` exists, refresh should stop before any receipt and ask whether to add project scaffolding. If you answer no, it should rerun user-root-only refresh and emit that receipt. Refresh trigger policy is owned by `references/startup-contract.md`; other surfaces point there instead of restating the full rule. The refresh bundle is complete when it is emitted; the recent-session section has its own byte budget and may truncate the rendered newest session artifact inside the complete bundle.

After the receipt, refresh itself is complete. If the same message included work beyond refresh, the agent should continue with that work using the loaded context. Agents should not scan memory folders merely to verify refresh; targeted lookup is for specific follow-up needs.

That refresh is what makes multi-provider work practical: each new Codex, Claude Code, Antigravity, or other compatible local agent session starts from the same memory chain instead of improvising from an isolated chat. Copilot CLI is a plausible future target, but current docs should treat it as best-effort rather than validated support.

During normal work, ask for targeted operations instead:

```text
Find layered rules about handoffs.
Take Handoff, Review.
Write a task log checkpoint.
Write a session entry for this project-wide decision.
Create a case study for this incident.
```

## Skill Layout

```text
m-pact/
  SKILL.md
  README.md
  docs/
    USER_GUIDE.md
  references/
  scripts/
  starter-rules/
  shims/
  agents/
```

- `SKILL.md` is the compact dispatch and operating contract agents load when invoking the skill.
- `references/` contains operation-specific procedures and templates.
- `scripts/` contains the Node.js refresh bundle builder.
- `scripts/antigravity-refresh-hook.js` wraps refresh output for Antigravity `PreInvocation` injection.
- `starter-rules/` contains default user-root rules installed during approved initial user-root bootstrap.
- `shims/` contains small `AGENTS.md`, `CLAUDE.md`, and `ANTIGRAVITY.md` sections for provider-global startup setup. It also includes optional `copilot-instructions.md` for GitHub Copilot custom-instructions setups.
- `docs/USER_GUIDE.md` is the full human user guide.

## Important Rules

- Filenames are the index. Directory listings are the table of contents.
- Refresh trigger policy is owned by `references/startup-contract.md`.
- Sessions, task logs, and summaries are context, not prompts or task assignments.
- Task logs are append-only.
- Task specifications live in `specification.zip`. Legacy tasks use numbered snapshots; new-format tasks use a current narrative blob plus immutable item members and may have a helper-maintained editable `specification.md` narrative mirror.
- Durable project-root writes require the project ID from the latest refresh or successful helper receipt. Helper receipts include `projectPath` beside `projectId` so humans can verify the target project.
- Bootstrap, task creation, task close/reopen, ambiguous durable rules, deletion, and non-local writes require explicit Director approval.

## Documentation

Read the full guide here:

[docs/USER_GUIDE.md](docs/USER_GUIDE.md)
