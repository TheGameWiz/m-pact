# Memory Root Policy

Use this reference when Director intent depends on which memory root should be read from or written to. This is policy, not a script operation.

Helpers know the mechanics: active root discovery, explicit `--root`, task lookup, user-root validation, chain order, and sentinel rules. Agents should not reimplement those mechanics by listing folders or calculating roots themselves.

Project identity is helper-owned. New project bootstrap mints identity automatically. Existing pre-identity roots use lazy confirmed adoption: refresh or a durable write reports `M-PACT PROJECT ADOPTION REQUIRED`, asks the Director whether to adopt that one root, and mints identity only through `scripts/adopt-project-identity.js` after a yes. Use `scripts/repair-project-identity.js` when a helper reports a path-mismatched or multiple project sentinel state. Do not hand-edit `project__*` or `project-count__*` sentinels.

Project sentinel names are path slugs. They fold case and collapse runs of non-alphanumeric characters, so distinct paths can produce the same sentinel name. This limitation is accepted to avoid changing the sentinel scheme and migrating existing roots.

## Routing Principles

- Current-project writes use the active project root by default.
- Project-ID declarations (`--project-id`) and `--cross-project` follow the Writes rules in `startup-contract.md`.
- A named project, sibling project, or explicit path may require passing an explicit `--root` to the relevant helper.
- User-root writes require explicit user-level, global, or cross-project intent from the Director.
- Inherited project roots are read-only by default; writing to one requires explicit Director instruction.
- Bootstrap and root creation require explicit Director approval.

## Agent Responsibilities

Identify the artifact type and the Director's intended scope before choosing a helper call.

If the Director says "this project" or gives no scope, use the helper's default active-root behavior.

If the Director names another project, locate or ask for that project's memory root before writing. Do not guess a root from nearby folder names.

Do not use `--cross-project` to work around an identity refusal. Refresh, repair identity with the helper when instructed, or change directory back to the intended project.

Do not use `--cross-project` to adopt a pre-identity root. An unadopted target still asks the adoption question before any durable write can proceed.

If the Director asks for a user-level rule, cross-project journal, or other broad memory artifact, pass the user root only when that broad scope is explicit.

## Startup Context

The refresh bundle may include root orientation such as start path, required user root, project roots, active project root, project identity, memory chain, current-task sentinel status, and active task names. It should not include a full memory-root tree by default.

Use targeted lookup helpers for explicit history, member lists, searches, and handoffs. Do not inspect memory folders merely to decide where a normal write belongs.
