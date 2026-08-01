# Memory Root Policy

Use this reference when Director intent depends on which memory root should be read from or written to. This is policy, not a script operation.

Helpers know the mechanics: active root discovery, explicit `--root`, task lookup, user-root validation, chain order, and sentinel rules. Agents should not reimplement those mechanics by listing folders or calculating roots themselves.

Project identity is helper-owned. New project bootstrap mints identity automatically. Existing pre-identity roots use lazy confirmed adoption: refresh or a durable write reports `M-PACT PROJECT ADOPTION REQUIRED`, asks the Director whether to adopt that one root, and mints identity only through `scripts/adopt-project-identity.js` after a yes. Use `scripts/repair-project-identity.js` when a helper reports a path-mismatched project sentinel. Do not hand-edit `project__*` or `project-count__*` sentinels.

## Routing Principles

- Current-project writes use the active project root by default.
- Current-project durable writes pass the refreshed project number as `--project-id <n>`. Successful project-write helper receipts include `projectPath` beside `projectId` so the Director can sanity-check the target project.
- A named project, sibling project, or explicit path may require passing an explicit `--root` to the relevant helper. If that project ID is loaded, pass it as `--project-id <n>` and let the helper verify the target root. Use `--cross-project` only when the Director explicitly approved writing to a project whose ID was not loaded; it lifts the requirement to supply a declaration, and a declaration that contradicts the target still halts.
- User-root writes require explicit user-level, global, or cross-project intent from the Director.
- Inherited project roots are read-only by default.
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
