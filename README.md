# M-PACT: Multi-Provider Agent Context Toolkit

M-PACT helps local coding agents share memory. It was designed and validated for Codex, Claude Code, and Gemini CLI. Its goal is simple: let agents remember useful project information, share it with each other, and pick up work without depending on one chat window to hold everything.

M-PACT stores memory at two levels: global memory that can follow you across projects, and project memory that belongs to one workspace. That memory can include shared rules, session notes, project tasks, task logs, task specifications, task summaries, case studies, and project journals.

This makes it possible to use more than one agent on the same project at the same time. One agent can work on a design, another can review it, another can implement it, and another can verify the code. They can hand work back and forth through task logs and specifications instead of reconstructing state from chat history.

The skill owns the procedures. Memory roots hold the state.

Multi-provider is the headline, but the base unit is still an agent session. Several sessions can use the same provider, different providers, or a mix of both. The point is that every agent tab can enter the same project with the same durable memory and a common task record.

## Install Targets

M-PACT is packaged as one folder with native entrypoints for multiple local agent runtimes:

- Codex and Claude Code use `SKILL.md` and are first-class validated targets.
- Gemini CLI uses `gemini-extension.json`, root `GEMINI.md`, and `commands/`.
- Copilot CLI may work with the same `SKILL.md` folder and Copilot-facing shims, but it has not yet been validated as a first-class supported runtime.

Install M-PACT separately for each provider you want to use. After placing M-PACT in that provider's skill or extension folder, run the bundled runtime setup helper from that provider's installed copy:

```text
node scripts/install-mpact.js
```

Provider skill placement is provider-specific and follows the normal skill model:

```text
~/.codex/skills/m-pact/
~/.claude/skills/m-pact/
~/.gemini/extensions/m-pact/   # or link this repo with gemini extensions link
```

Copilot CLI may later use `~/.copilot/skills/m-pact/` or `~/.agents/skills/m-pact/`, but that install path remains best-effort and is not enabled by the default helper.

The setup helper does not copy itself across provider roots. It creates or preserves the user memory root at `~/.AgentMemoryRoot/`, installs starter user-root rules without overwriting existing rule files, and installs only the current or explicitly requested provider-global startup shim:

```text
~/.codex/AGENTS.md
~/.claude/CLAUDE.md
~/.gemini/GEMINI.md
```

Project setup is separate from install. Install does not create project `.AgentMemory/` roots or project-local `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` files. Repeat provider placement and runtime setup for Codex, Claude, and Gemini separately when you want all three configured.

Invoke it as `$m-pact` in Codex, `/m-pact` in Claude Code, or `/m-pact:fast-refresh` in Gemini CLI. `/m-pact:refresh` remains a Gemini compatibility command. Copilot CLI may use `/m-pact` or `m-pact` if its runtime exposes the skill, but this path is best-effort until validated. In dictated Gemini requests, `Impact` is the spoken alias for M-PACT, for example `refresh Impact` or `Impact refresh`; Gemini is instructed to route those natural M-PACT requests, including `m-pact refresh`, to `/m-pact:fast-refresh` when possible. Plain `refresh memory` remains the ordinary refresh wording for Codex, Claude Code, and Copilot-style agents, but Gemini should not treat it as M-PACT unless the request also names Impact or M-PACT.

## Requirements
- Node.js 18 or newer is required for startup refresh.
- Startup refresh requires a local agent runtime with shell access and filesystem access. Codex CLI, Claude Code, and Gemini CLI are the validated targets; Copilot CLI and other compatible local runtimes are best-effort until tested.
- Web-only ChatGPT or Claude clients cannot refresh local `.AgentMemoryRoot/` or `.AgentMemory/` folders directly. Use an uploaded refresh bundle or uploaded memory artifacts instead.
- The refresh procedure uses the bundled `scripts/build-refresh-bundle.js` script and only Node built-in modules. No npm package install is required.
- Check availability with `node --version`.

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
rules/
sessions.zip
tasks/
case-studies.zip
journal.zip
```

## Quick Use

Provider placement makes the skill available to that provider. Runtime setup configures that provider's global startup shim and creates the user `.AgentMemoryRoot/`. A new workspace still needs project setup.

For a new project, ask:

```text
Set up m-pact for this project.
```

The agent should first confirm `.AgentMemoryRoot/` exists. If it is missing, it should run provider runtime setup, then add the project scaffold: `.AgentMemory/`. It should not run refresh after bootstrap unless you also ask it to refresh, load, or verify. Provider-global shims should invoke M-PACT for configured runtimes; project bootstrap does not write project instruction files.

At the start of a new context, ask the agent:

```text
Use $m-pact and refresh memory.
```

The agent should run the bundled refresh procedure. If no project `.AgentMemory/` exists, refresh should stop before any receipt and ask whether to add project scaffolding. If you answer no, it should rerun user-root-only refresh and emit that receipt. Refresh is intended only for new context/session startup, known or suspected context loss, or explicit refresh requests. If the refresh bundle hits the size limit, the script emits a partial bundle with `LimitHit: true`; the agent should keep going with the warning visible and use targeted lookup for anything omitted.

After the receipt, refresh is complete. Agents should not scan memory folders merely to verify refresh; targeted lookup is for specific follow-up needs.

That refresh is what makes multi-provider work practical: each new Codex, Claude Code, Gemini CLI, or other compatible local agent session starts from the same memory chain instead of improvising from an isolated chat. Copilot CLI is a plausible future target, but current docs should treat it as best-effort rather than validated support.

During normal work, ask for targeted operations instead:

```text
Find layered rules about handoffs.
Take the current task handoff and report the state.
Write a task log checkpoint.
Write a session entry for this project-wide decision.
Create a case study for this incident.
```

## Skill Layout

```text
m-pact/
  SKILL.md
  GEMINI.md
  gemini-extension.json
  commands/
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
- `GEMINI.md`, `gemini-extension.json`, and `commands/` make the same folder installable as a Gemini CLI extension.
- `references/` contains operation-specific procedures and templates.
- `scripts/` contains the Node.js refresh bundle builder.
- `scripts/emit-refresh-receipt.js` is the fast command wrapper used by Gemini CLI to print only the refresh receipt body.
- `scripts/emit-refresh-bundle.js` is the Gemini CLI wrapper that injects the verified bundle as one startup-context document.
- `starter-rules/` contains default user-root rules installed during approved initial user-root bootstrap.
- `shims/` contains small `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` sections for provider-global startup setup. It also includes optional `copilot-instructions.md` for GitHub Copilot custom-instructions setups.
- `docs/USER_GUIDE.md` is the full human user guide.

## Important Rules

- Filenames are the index. Directory listings are the table of contents.
- Refresh only at startup, after context loss, or when explicitly requested.
- Sessions, task logs, and summaries are context, not prompts or task assignments.
- Task logs are append-only.
- The current task specification is the highest-numbered member of `specification.zip`.
- Bootstrap, task creation, task close/reopen, ambiguous durable rules, deletion, and non-local writes require explicit Director approval.

## Documentation

Read the full guide here:

[docs/USER_GUIDE.md](docs/USER_GUIDE.md)
