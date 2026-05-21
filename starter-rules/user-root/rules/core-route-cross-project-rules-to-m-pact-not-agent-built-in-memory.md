---
description: Applies when saving behavior, feedback, or any rule meant to persist across projects. Covers Claude Code "auto memory", Copilot "memory tool", and similar agent-local mechanisms.
type: behavior
source: director
created: 2026-05-08
---

**Why:** Agent-local memory features are typically tied to one agent and may be project-scoped; M-PACT user rules load across every M-PACT-aware agent and across every project, with no per-project bootstrap.

**How to apply:** When asked to remember a behavior, save feedback, or capture a rule meant to persist beyond one project, write it as an M-PACT user rule under `.AgentMemoryRoot/rules/` rather than reaching for the agent's built-in memory feature. Project-specific facts that should not cross projects may still go in agent-local memory.
