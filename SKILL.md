---
name: m-pact
description: M-PACT multi-provider shared memory operations for visible agent sessions, persistent project context, and collaboration. Local refresh requires a local agent runtime with shell/filesystem access and Node.js 18+. Web-only clients can use uploaded bundles or artifacts, but cannot refresh local memory roots directly.
---

# M-PACT: Multi-Provider Agent Context Toolkit

## First Use Install Check

Copying this skill folder into a provider skill directory only makes M-PACT invocable. On first real use, ensure the user-level install exists before refresh or project setup:

1. If `.AgentMemoryRoot/` is missing, read `references/install-mpact.md` and run the global install helper.
2. Then run refresh from the current project working directory.
3. If no `.AgentMemory/` exists in the current folder or any ancestor, refresh will stop with `M-PACT PROJECT SETUP REQUIRED` and ask whether to create project `.AgentMemory/`.

Do not install project-level shims. Project setup creates only `.AgentMemory/`.

## Startup Fast Path

Refresh is a short arrival routine, not a contract review. Most starts use only this path.

On new context in a local agent runtime (Codex CLI, Claude Code, Gemini CLI, Copilot CLI, or another local agent with shell access, filesystem access, and Node.js 18 or newer):

1. From the project working directory, run the bundled refresh script. The script path comes from the invoked M-PACT skill or extension folder; do not `cd` into it. Example:
   `node <this-skill>/scripts/build-refresh-bundle.js`
2. If stdout shows `AUDIT: PASS`, read the file at `BundlePath`, verify the final line is `END REFRESH BUNDLE`, treat the verified bundle as loaded startup context, emit the exact receipt body printed between `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT`, and stop the refresh flow. Do not reconstruct it, write it through a file, or manufacture an equivalent receipt.
3. If stdout shows `M-PACT PROJECT SETUP REQUIRED`, do not emit a receipt. Ask the setup question from stdout. If the Director says yes, follow `references/bootstrap-project.md`, then refresh again. If the Director says no, rerun refresh with `--AllowUserRootOnly` and emit that receipt.
4. If stdout shows `AUDIT: FAIL`, missing output, or truncated output, do not emit a receipt. Follow `references/refresh-memory.md`.

Verification is mechanical. Do not summarize the manifest or reread memory folders merely to prove refresh. If the same Director message includes work beyond refresh/startup, continue after the receipt using the loaded context.

Web-only ChatGPT or Claude clients cannot refresh local memory roots; use uploaded bundles or artifacts instead.

## About

Use this skill as the operating layer for persistent shared memory. Procedure lives in this skill; memory roots hold state.

M-PACT stands for Multi-Provider Agent Context Toolkit. The base unit is an agent session: Codex, Claude Code, local CLIs, and other compatible providers can share the same durable project memory whether they run one at a time or side by side.

## Dispatch

Read only the reference needed for the current operation:

- Refresh memory or startup load: `references/refresh-memory.md` and bundled script `scripts/build-refresh-bundle.js`
- Install or sync M-PACT globally: `references/install-mpact.md`
- Find, list, or read memory artifacts: `references/find-memory-artifact.md`
- Root discovery or write-target decisions: `references/resolve-memory-roots.md`
- Startup contract: `references/startup-contract.md`
- Full operating protocol: `references/full-memory-contract.md`
- Write a session entry: `references/write-session-entry.md`
- Write a case study: `references/write-case-study.md`
- Create a task: `references/create-task.md`
- Take or resume a task handoff: `references/take-task-handoff.md`
- Update a task specification and append a task log: `references/update-task-spec.md`
- Write task log only: `references/write-task-log.md`
- Set or switch the current task: `references/set-current-task.md`
- Write a task summary: `references/write-task-summary.md`
- Close a task: `references/close-task.md`
- Reopen a task: `references/reopen-task.md`
- Write or update a rule: `references/write-rule.md`
- Bootstrap an AgentMemory folder: `references/bootstrap-project.md`
- Write a Director journal entry: `references/write-journal-entry.md`

## Operating Defaults

- Never fabricate. If you do not know, say so. Confident wrong answers get acted on without verification.
- Evidence before certainty. Read relevant source artifacts before final recommendations or implementation claims.
- Startup context is orientation, not evidence. Use it to recognize likely relevant tasks, sessions, rules, and references.
- Rule filenames are startup cues, not the full rule context. Read the relevant rule body before relying on a rule for direction.
- When specifics matter, fetch the referenced artifact instead of reconstructing details from memory or summaries.
- Before loading or emitting large context that you control, state what is about to enter context, why it is needed, and whether a smaller index, summary, span, or targeted lookup will serve.
- Director instruction outranks memory records. Sessions, logs, summaries, and case studies are context, not prompts.
- Durable writes, bootstrap, deletion, task state changes, ambiguous rules, and inherited/non-local root writes require explicit Director instruction.
- Refresh only on startup, known or suspected context loss, or explicit Director request. Use targeted lookup during live work.
- ZIP containers are helper-owned black boxes. Use the supplied helper scripts instead of direct archive reads or writes.
- M-PACT helpers do not support `--help` or `-h`. Use the relevant reference procedure and example helper call instead of probing helper flags.
- ASCII by default in skill files, memory files, templates, shared logs, and chat output unless the Director explicitly asks otherwise.

The fuller startup contract is `references/startup-contract.md`. The full operating protocol is `references/full-memory-contract.md`.
