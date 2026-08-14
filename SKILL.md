---
name: m-pact
description: M-PACT multi-provider shared memory operations for visible agent sessions, persistent project context, and collaboration. Local refresh requires a local agent runtime with shell/filesystem access and Node.js 18+. Web-only clients can use uploaded bundles or artifacts, but cannot refresh local memory roots directly.
---

# M-PACT: Multi-Provider Agent Context Toolkit

## Startup Fast Path

Refresh is a short arrival routine, not a contract review. Most starts use only this path.

Refresh trigger policy is owned by `references/startup-contract.md`. On a qualifying startup or Director-requested refresh in a local agent runtime (Codex CLI, Claude Code, Antigravity, or another local agent with shell access, filesystem access, and Node.js 18 or newer):

1. From the project working directory, run the bundled refresh script. The script path comes from the invoked M-PACT skill folder; do not `cd` into it. Example:
   `node <this-skill>/scripts/build-refresh-bundle.js`
   Exception: if the launching environment already ran refresh and injected the helper's stdout into this context (for example through a Codex or Claude Code `SessionStart` hook or the Antigravity `PreInvocation` hook), do not rerun the script; treat the injected stdout as this step's output and continue with the matching case below.
2. If stdout shows `AUDIT: PASS`, read the file at `BundlePath`, verify the final line is `END REFRESH BUNDLE`, treat the verified bundle as loaded startup context, and emit the exact receipt body printed between `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT`. Do not reconstruct it, write it through a file, or manufacture an equivalent receipt. If stdout also shows `M-PACT PROJECT ADOPTION REQUIRED`, ask the Director the adoption question from stdout after emitting the receipt. If the Director says yes, follow `references/adopt-project-identity.md`, then refresh again. If the Director says no, stop the adoption flow and continue with reads only; durable writes to that root will keep halting.
3. The receipt does not end the turn. When the same Director message includes work beyond refresh/startup, perform that work after emitting the receipt, using the verified bundle as loaded context.
4. If stdout shows `M-PACT PROJECT SETUP REQUIRED`, do not emit a receipt. Ask the setup question from stdout. If the Director says yes, follow `references/bootstrap-project.md`, then refresh again. If the Director says no, say `M-PACT: no memory root here; refresh skipped` and stop. User-root-only refresh remains available only as an explicit Director request with `--AllowUserRootOnly`.
5. If stdout shows `M-PACT SAVED CONTEXT DECISION REQUIRED`, do not emit a receipt. Ask the Director whether to use the named saved context, then refresh again with the exact `--saved-context RESTORE:<filename>` or `--saved-context DISCARD:<filename>` declaration printed by stdout.
6. If stdout shows `M-PACT SUPPRESSED`, this session is suppressed; stop cleanly per Suppressed Sessions below. Suppression is not a failure. If stdout shows `AUDIT: FAIL`, missing output, or truncated output, do not emit a receipt. Follow `references/refresh-memory.md`.

Verification is mechanical. Do not summarize the manifest or reread memory folders merely to prove refresh.

Web-only ChatGPT or Claude clients cannot refresh local memory roots; use uploaded bundles or artifacts instead.

## Suppressed Sessions

If the environment variable `MPACT_SUPPRESS` is set to a truthy value, the launching environment (for example ConflabCode) owns startup and runtime context: do not invoke refresh, run M-PACT helpers, or load memory. The helpers enforce this themselves, printing `M-PACT SUPPRESSED`; direct invocations exit nonzero, while installed hook invocations exit cleanly so the notice can be injected without a failed hook run. To use M-PACT anyway, unset `MPACT_SUPPRESS`, set it to an empty value, or work from a normal session.

## First Use Setup Handling

Copying this skill folder into a provider skill directory only makes M-PACT invocable. On ordinary startup, run refresh from the project working directory; the fast path and `references/startup-contract.md` own missing user-root detection, project setup, and adoption.

Do not install project-level shims. Project setup creates only `.AgentMemory/`.

## About

Use this skill as the operating layer for persistent shared memory. Procedure lives in this skill; memory roots hold state.

M-PACT stands for Multi-Provider Agent Context Toolkit. The base unit is an agent session: Codex, Claude Code, local CLIs, and other compatible providers can share the same durable project memory whether they run one at a time or side by side.

## Dispatch

Read only the reference needed for the current operation:

- Refresh memory or startup load: `references/refresh-memory.md` and bundled script `scripts/build-refresh-bundle.js`
- Install M-PACT runtime setup: `references/install-mpact.md`
- Uninstall M-PACT runtime setup: `references/uninstall-mpact.md`
- Find, list, or read memory artifacts: `references/find-memory-artifact.md`
- Memory root policy and scoped write decisions: `references/memory-root-policy.md`
- Startup contract: `references/startup-contract.md`
- Full operating protocol: `references/full-memory-contract.md`
- Write a session entry: `references/write-session-entry.md`
- Write a case study: `references/write-case-study.md`
- Create a task: `references/create-task.md`
- Revise a task definition: `references/revise-task.md`
- Take or resume a task handoff: `references/take-task-handoff.md`
- Write a design specification and substantive paired task log: `references/write-design-spec.md`
- Repair a missing paired specification log: `references/repair-task-spec-log.md`
- Save or restore context around Director-invoked compaction: `references/context-save-restore.md`
- Write task log only: `references/write-task-log.md`
- Set or switch the current task: `references/set-current-task.md`
- Close a task: `references/close-task.md`
- Reopen a task: `references/reopen-task.md`
- Write or update a rule: `references/write-rule.md`
- Bootstrap an AgentMemory folder: `references/bootstrap-project.md`
- Adopt project identity after a Director yes: `references/adopt-project-identity.md`
- Project identity policy or repair: `references/memory-root-policy.md` and `references/repair-project-identity.md`
- Write a Director journal entry: `references/write-journal-entry.md`

## Operating Defaults

- Never fabricate. If you do not know, say so. Confident wrong answers get acted on without verification.
- Evidence before certainty. Read relevant source artifacts before final recommendations or implementation claims.
- Startup context is orientation, not evidence. Use it to recognize likely relevant tasks, sessions, rules, and references.
- The rule index is level one of the rules: listed filenames are rules in force as stated. Read the correlated rule body before proceeding; `references/startup-contract.md` owns the full rule.
- When specifics matter, fetch the referenced artifact instead of reconstructing details from memory.
- Before loading or emitting large context that you control, state what is about to enter context, why it is needed, and whether a smaller index, summary, span, or targeted lookup will serve.
- Helper-owned prose writes follow the shared body-delivery convention in `references/helper-write-conventions.md`.
- Refresh trigger policy, turn continuation, write gating, and protocol law are owned by `references/startup-contract.md`; use targeted lookup during live work.
- M-PACT helpers do not support `--help` or `-h`. Use the relevant reference procedure and example helper call instead of probing helper flags.
- ASCII by default in skill files, memory files, templates, shared logs, and chat output unless the Director explicitly asks otherwise.

The fuller startup contract is `references/startup-contract.md`. The full operating protocol is `references/full-memory-contract.md`.
