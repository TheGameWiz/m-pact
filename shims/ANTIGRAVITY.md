<!-- BEGIN M-PACT SHIM -->
## M-PACT: Multi-Provider Agent Context Toolkit

On new context, invoke the installed M-PACT skill and follow its startup fast path. In Antigravity, use `/m-pact` when skill invocation is available.

M-PACT installs an Antigravity `PreInvocation` hook named `m-pact-refresh` that injects refresh output as transient context. When that injected stdout is present, the fast path treats it as the refresh run already performed. Because Antigravity injected text is transient, verify the bundle, emit the receipt body, and complete the fast path in the same turn.

The installed skill owns refresh trigger policy, setup-required handling, bundle verification, compact receipt output, and targeted lookup rules. Do not duplicate those procedures in this shim.

If the environment variable `MPACT_SUPPRESS` is set to a truthy value (for example `1`), the launching environment owns context here: do not invoke M-PACT.

If M-PACT is unavailable, stop and report that the skill is missing.
<!-- END M-PACT SHIM -->
