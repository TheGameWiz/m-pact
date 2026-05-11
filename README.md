# M-PACT: Multi-Provider Agent Context Toolkit

M-PACT is a multi-provider agent context toolkit for visible agent sessions. It was designed and validated for Codex, Claude Code, and Gemini CLI, and gives compatible local agents a shared memory layer outside the chat window so future sessions can recover durable rules, project context, task state, handoffs, decisions, and useful historical notes.

The skill owns the procedures. Memory roots hold the state.

Multi-provider is the headline, but the base unit is an agent session. Several sessions can use the same provider, different providers, or a mix of both. The point is that every agent tab can enter the same project with the same durable memory and a common task record.

## Install Targets

M-PACT is packaged as one folder with native entrypoints for multiple local agent runtimes:

- Codex and Claude Code use `SKILL.md` and are first-class validated targets.
- Gemini CLI uses `gemini-extension.json`, root `GEMINI.md`, and `commands/`.
- Copilot CLI may work with the same `SKILL.md` folder and Copilot-facing shims, but it has not yet been validated as a first-class supported runtime.

Install or copy the same `m-pact` folder into each runtime's expected location:

```text
~/.codex/skills/m-pact/
~/.claude/skills/m-pact/
~/.copilot/skills/m-pact/      # or ~/.agents/skills/m-pact/
~/.gemini/extensions/m-pact/   # or link this repo with gemini extensions link
```

Invoke it as `$m-pact` in Codex, `/m-pact` in Claude Code, or `/m-pact:fast-refresh` in Gemini CLI. `/m-pact:refresh` remains a Gemini compatibility command. Copilot CLI may use `/m-pact` or `m-pact` if its runtime exposes the skill, but this path is best-effort until validated. In dictated Gemini requests, `Impact` is the spoken alias for M-PACT, for example `refresh Impact` or `Impact refresh`; Gemini is instructed to route those natural M-PACT requests, including `m-pact refresh`, to `/m-pact:fast-refresh` when possible. Plain `refresh memory` remains the ordinary refresh wording for Codex, Claude Code, and Copilot-style agents, but Gemini should not treat it as M-PACT unless the request also names Impact or M-PACT.

## Requirements
- Node.js 18 or newer is required for startup refresh.
- Startup refresh requires a local agent runtime with shell access and filesystem access. Codex CLI, Claude Code, and Gemini CLI are the validated targets; Copilot CLI and other compatible local runtimes are best-effort until tested.
- Web-only ChatGPT or Claude clients cannot refresh local `.AgentMemoryRoot/` or `.AgentMemory/` folders directly. Use an uploaded refresh bundle or uploaded memory artifacts instead.
- The refresh procedure uses the bundled `scripts/build-refresh-bundle.js` script and only Node built-in modules. No npm package install is required.
- Check availability with `node --version`.

## What It Is For

Use this skill when you want agents to:

- Run multiple visible agent sessions across one provider or many providers without losing shared project context.
- Start a new context with the right durable project and user memory.
- Pick up existing work from task handoffs.
- Preserve decisions, checkpoints, and task progress across sessions.
- Store durable behavioral rules without bloating every prompt.
- Keep project memory separate from user-level memory.
- Capture richer lessons as case studies instead of long standing instructions.

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
sessions/
tasks/
case-studies/
journal/
```

## Quick Use

Install makes the skill available globally. A new workspace still needs project setup.

For a new project, ask:

```text
Set up m-pact for this project.
```

The agent should add any missing project scaffolding: `.AgentMemory/` with standard subfolders and the M-PACT startup shims in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. It should not run refresh after bootstrap unless you also ask it to refresh, load, or verify. `AGENTS.md` is also the default project shim for Copilot-compatible agents; `shims/copilot-instructions.md` is available as an optional GitHub Copilot custom-instructions template.

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
Append a task log checkpoint.
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
- `shims/` contains small `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` sections that project bootstrap creates or appends so compatible agents invoke M-PACT on new context. It also includes optional `copilot-instructions.md` for GitHub Copilot custom-instructions setups.
- `docs/USER_GUIDE.md` is the full human user guide.

## Important Rules

- Filenames are the index. Directory listings are the table of contents.
- Refresh only at startup, after context loss, or when explicitly requested.
- Sessions, task logs, and summaries are context, not prompts or task assignments.
- Task logs are append-only.
- `specification.md` is mutable current task state.
- Bootstrap, task creation, task close/reopen, ambiguous durable rules, deletion, migration, and non-local writes require explicit Director approval.

## Documentation

Read the full guide here:

[docs/USER_GUIDE.md](docs/USER_GUIDE.md)
