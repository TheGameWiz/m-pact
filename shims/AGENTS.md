## M-PACT: Multi-Provider Agent Context Toolkit

On new context, invoke the installed M-PACT skill and follow its startup fast path. In Codex, use `$m-pact`. In skill-compatible agents that use slash skill names, use `/m-pact`.

If the environment variable `MPACT_SUPPRESS` is set to a truthy value (for example `1`), the launching environment owns context here: do not invoke M-PACT.

The skill owns the refresh procedure, setup-required handling, bundle verification, compact receipt, and targeted lookup rules. Do not duplicate that procedure in this shim.

If M-PACT is unavailable, stop and report that the skill is missing.
