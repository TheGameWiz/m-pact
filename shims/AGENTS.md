## M-PACT: Multi-Provider Agent Context Toolkit

On new context, invoke the M-PACT skill and run its refresh procedure. In Codex, use `$m-pact`. In skill-compatible agents that use slash skill names, use `/m-pact`.

Refresh gives each visible agent session, whether Codex, Claude Code, Gemini CLI, Copilot CLI, or another compatible provider or runtime, the same durable project memory.

After a successful refresh manifest, read/apply the bundle at `BundlePath`, emit the `M-PACT MEMORY REFRESH` receipt body, and stop the refresh flow. Do not ask whether to open or apply the bundle. Do not end the turn solely because refresh completed; if the same user message includes a substantive request beyond refresh/startup, continue with that request using the loaded context. After a successful refresh receipt, treat the verified bundle as loaded startup context. Do not scan memory folders merely to verify refresh; use targeted lookup only when asked or when the work requires it.

If M-PACT is unavailable, stop and report that the skill is missing.
