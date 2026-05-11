## M-PACT: Multi-Provider Agent Context Toolkit

On new context, invoke `/m-pact` and run its refresh procedure.

Refresh gives each visible agent session, whether Codex, Claude Code, Gemini CLI, Copilot CLI, or another compatible provider or runtime, the same durable project memory.

If refresh reports `M-PACT PROJECT SETUP REQUIRED`, ask the setup question from the script output before emitting any receipt. If the user says yes, add the missing project scaffolding and then refresh again. If the user says no, rerun refresh with `--AllowUserRootOnly` and emit that user-root-only receipt.

After a successful refresh manifest, read/apply the bundle at `BundlePath`, emit the `M-PACT MEMORY REFRESH` receipt body, and stop. Do not ask whether to open or apply the bundle. After a successful refresh receipt, treat the verified bundle as loaded startup context. Do not scan memory folders merely to verify refresh; use targeted lookup only when asked or when the work requires it.

If `/m-pact` is unavailable, stop and report that the skill is missing.
