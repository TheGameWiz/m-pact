# Resolve Memory Roots

Use this reference whenever root discovery, read roots, or write targets matter.

## Root Types

- User root: required `.AgentMemoryRoot/`, usually at the user's home directory.
- Project roots: all ancestor `.AgentMemory/` roots from the current working directory, collected by walking upward and then reversed into broad-to-specific order.
- Active project root: the nearest ancestor `.AgentMemory/` from the current working directory.

## Memory Chain

1. Start at the current working directory and walk upward.
2. Collect each ancestor `.AgentMemory/`.
3. Reverse the collected project roots into broad-to-specific order.
4. Prepend required user `.AgentMemoryRoot/`.
5. Any variable, log line, or receipt field named `chain` must use this final broad-to-specific order, not the nearest-first walk order.

If the user root is missing, enter bootstrap-required state and report it in the refresh receipt. Do not pretend memory is fully loaded. Create the user root only after Director approval.

If no project root exists during normal refresh, stop with `M-PACT PROJECT SETUP REQUIRED` before emitting any receipt. Do not create a root without approval. Emit a user-root-only receipt only if the Director answers no and refresh is rerun with `--AllowUserRootOnly`.

## Active Root

The active project root is the nearest ancestor `.AgentMemory/`. It is active for project task, session, journal, case-study, and project-rule writes unless the Director explicitly names another target.

If the current folder is a child of a project root and has no local `.AgentMemory/`, use the nearest parent project root as active. Do not create a child memory root unless the Director asks or approves bootstrap.

## Default Write Targets

- Sessions: active project root `sessions/`.
- Existing task log/spec/summary updates: active project root `tasks/`.
- Task creation, close, reopen: active project root only after explicit Director instruction.
- Project rules: active project root `rules/`.
- Broad user rules: user root `rules/` only when the Director explicitly wants a user-level rule.
- Case studies: active project root `case-studies/` by default; user root only when the Director explicitly wants a user-level or cross-project case study.
- Director journal entries: active project root `journal/` by default; user root only when the Director explicitly wants a user-level or cross-project journal entry.
- Inherited roots: read-only by default.

Discovery order is not write-target order. Always identify the artifact type before choosing the write target.
