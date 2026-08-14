# M-PACT: Multi-Provider Agent Context Toolkit

## Refresh Memory

For a normal happy-path startup, use the `SKILL.md` Startup Fast Path. This reference is the detailed procedure for stdout markers, saved-context edge cases, and failures. Refresh loads context correctly, but it is the floor of being useful, not the ceiling: you can still misread or misweight what was loaded.

Refresh trigger policy, run mechanics (invoked-skill script path, Node.js 18+, working directory, no `scripts/` probing), and the post-refresh no-scan and unread-record rules are owned by `startup-contract.md`.

## How To Run It

One path. No alternatives. Pass the installed skill script path to Node while staying in the current project working directory. For this local install, the common commands are:

```bash
# Codex / Node.js
node ~/.codex/skills/m-pact/scripts/build-refresh-bundle.js

# Claude Code / Node.js
node ~/.claude/skills/m-pact/scripts/build-refresh-bundle.js

# Antigravity / Node.js
node ~/.gemini/config/skills/m-pact/scripts/build-refresh-bundle.js
```

The script resolves memory roots from the current project working directory unless `--StartPath` is explicitly supplied.

Never run refresh as `cd <skill-folder> && node scripts\...`; that resolves memory roots from the skill install directory and can falsely report `project: (none found)`. A false `project: (none found)` caused by running from the skill folder is not permission to bootstrap. Re-run refresh from the real project root instead.

## Saved Context And Task Reporting

Refresh tries to resolve the running agent. If identity resolves and saved-context files exist for that agent in the resolved memory root `.tmp`, refresh silently deletes older duplicates and handles the newest file: a recent file is embedded in the bundle, consumed, and named in the ordinary receipt; an older file halts with `M-PACT SAVED CONTEXT DECISION REQUIRED`.

If identity cannot be resolved and any saved-context files are present in the resolved memory root `.tmp`, refresh fails with `AUDIT: FAIL`, names `M-PACT SAVED CONTEXT UNHANDLED`, emits no bundle and no ordinary receipt, and ends with `END REFRESH FAILURE`. This prevents a saved context from being silently skipped when refresh cannot tell which agent is starting. Pass `--agent <token>` from a recognized local runtime or fix the conflicting provider markers, then rerun refresh.

If identity cannot be resolved and no saved-context files are present, refresh still produces a complete bundle and names that per-agent saved context restore is unavailable. Pass `--agent <token>` only in the override cases enumerated in `startup-contract.md`.

When a current task exists, refresh also reports the resolved agent's task-log read-cursor and unread task-log records after that cursor; if the agent has authored a record on the current task, refresh includes that cursor record as orientation. If the receipt names `orphanedSpecMembers`, use `references/repair-task-spec-log.md` for the affected task and surface the repair announcement.

## Stdout Markers

If stdout contains `M-PACT SUPPRESSED` and its literal final line is `END M-PACT SUPPRESSED`, this is not a failure and not a setup-required state. Do not emit a receipt and do not retry through this reference; the `SKILL.md` Suppressed Sessions section owns the handling.

If stdout contains `M-PACT PROJECT SETUP REQUIRED` and its literal final line is `END PROJECT SETUP REQUIRED`, no refresh bundle was produced. Do not emit a receipt and do not load user-root-only context. Ask the setup question from stdout and stop; the yes/no branches follow the `SKILL.md` fast path, and `references/bootstrap-project.md` owns the question prose. Do not create anything unless the Director explicitly approves; treat "maybe," "not sure," "let me think," or explanatory questions as no approval yet. If the Director answers no, say `M-PACT: no memory root here; refresh skipped` and stop. User-root-only refresh is available only as an explicit Director request with `--AllowUserRootOnly`.

If stdout contains `M-PACT SAVED CONTEXT DECISION REQUIRED` and its literal final line is `END SAVED CONTEXT DECISION REQUIRED`, no refresh bundle was produced. Do not emit a receipt. Ask and rerun per `SKILL.md` fast path step 5, with the exact `--saved-context RESTORE:<filename>` or `--saved-context DISCARD:<filename>` declaration from stdout.

If stdout contains `AUDIT: PASS`, `M-PACT REFRESH BUNDLE MANIFEST`, a `BundlePath: <absolute path>` line, a compact receipt block, and its literal final line is `END REFRESH BUNDLE`, read the bundle file at `BundlePath`, verify the file's literal final line is also `END REFRESH BUNDLE`, then emit the compact receipt body. The stdout manifest alone is not a completed refresh and does not load memory by itself; `BundlePath` is the next required step, not a question for the Director. Never stop after printing the bundle path, and never ask whether to open the bundle or what to do next before the receipt body has been emitted.

If that successful stdout also contains `M-PACT PROJECT ADOPTION REQUIRED`, refresh still completed and memory is loaded. Emit the compact receipt first, then follow the adoption flow in `SKILL.md` fast path step 2.

## Receipt

Stdout and the bundle file both include the compact receipt block between `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT`. Emit only that receipt body, excluding the marker lines themselves. The first visible line must be `M-PACT MEMORY REFRESH`. Normal successful refresh should be a tiny acknowledgement, not a startup report: do not print roots, rule lists, session counts, task pointers, or the full startup manifest merely to prove refresh; those details are already loaded inside the verified bundle. The receipt does not end the turn: when the same user message includes a substantive request beyond refresh/startup, continue with that request using the loaded context.

## When Refresh Fails

Stop and report the exact failure when: `node` is unavailable or the script reports an unsupported Node version; the script is missing or fails; output is truncated; stdout lacks one of the valid final markers (`END PROJECT SETUP REQUIRED`, `END SAVED CONTEXT DECISION REQUIRED`, `END M-PACT SUPPRESSED`, or `END REFRESH BUNDLE`); stdout lacks `AUDIT: PASS` or a `BundlePath` for a refresh bundle; the bundle file cannot be read or lacks final-line `END REFRESH BUNDLE`; or stdout reports `AUDIT: FAIL` and `END REFRESH FAILURE`. Do not improvise a manual refresh.

State the exact error and what the script was trying to do when it failed, then ask the Director how to proceed. Do not load failed partial context and continue; half-loaded context from an audit failure is worse than not-loaded because it produces confident-sounding wrong answers instead of obvious gaps. Manual investigation is allowed only when the Director explicitly asks for debugging or repair.
