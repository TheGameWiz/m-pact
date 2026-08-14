<!-- BEGIN M-PACT SHIM -->
## M-PACT: Multi-Provider Agent Context Toolkit

On new context, invoke the installed M-PACT skill and follow its startup fast path. In Codex, use `$m-pact`. In skill-compatible agents that use slash skill names, use `/m-pact`.

M-PACT installs a Codex `SessionStart` hook that runs the refresh helper on session startup, after `/clear`, and after compaction, injecting the helper's stdout into context. When that injected stdout is present, the fast path treats it as the refresh run already performed.

The installed skill owns refresh trigger policy, setup-required handling, bundle verification, compact receipt output, and targeted lookup rules. Do not duplicate those procedures in this shim.

If the environment variable `MPACT_SUPPRESS` is set to a truthy value (for example `1`), the launching environment owns context here: do not invoke M-PACT.

If M-PACT is unavailable, stop and report that the skill is missing.
<!-- END M-PACT SHIM -->
