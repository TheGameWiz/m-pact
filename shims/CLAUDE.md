## M-PACT: Multi-Provider Agent Context Toolkit

On new context, invoke `/m-pact` and follow its startup fast path.

If the environment variable `MPACT_SUPPRESS` is set to a truthy value (for example `1`), the launching environment owns context here: do not invoke `/m-pact`.

The skill owns the refresh procedure, setup-required handling, bundle verification, compact receipt, and targeted lookup rules. Do not duplicate that procedure in this shim.

If `/m-pact` is unavailable, stop and report that the skill is missing.
