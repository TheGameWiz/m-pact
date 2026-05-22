# Memory Root Policy

Use this reference when Director intent depends on which memory root should be read from or written to. This is policy, not a script operation.

Helpers know the mechanics: active root discovery, explicit `--root`, task lookup, user-root validation, chain order, and sentinel rules. Agents should not reimplement those mechanics by listing folders or calculating roots themselves.

## Routing Principles

- Current-project writes use the active project root by default.
- A named project, sibling project, or explicit path may require passing an explicit `--root` to the relevant helper.
- User-root writes require explicit user-level, global, or cross-project intent from the Director.
- Inherited project roots are read-only by default.
- Bootstrap and root creation require explicit Director approval.

## Agent Responsibilities

Identify the artifact type and the Director's intended scope before choosing a helper call.

If the Director says "this project" or gives no scope, use the helper's default active-root behavior.

If the Director names another project, locate or ask for that project's memory root before writing. Do not guess a root from nearby folder names.

If the Director asks for a user-level rule, cross-project journal, or other broad memory artifact, pass the user root only when that broad scope is explicit.

## Startup Context

The refresh bundle may include root orientation such as start path, required user root, project roots, active project root, memory chain, current-task sentinel status, and active task names. It should not include a full memory-root tree by default.

Use targeted lookup helpers for explicit history, member lists, searches, and handoffs. Do not inspect memory folders merely to decide where a normal write belongs.
