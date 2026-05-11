# M-PACT: Multi-Provider Agent Context Toolkit

## Refresh Memory

## Why This Exists

You are joining a conversation already underway. The Director has context you do not, and is about to ask you for judgment, action, or collaboration where being half-loaded will produce confident-sounding answers without grounding. Refresh is how you arrive as a useful partner instead of guessing from fragments.

Refresh loads context correctly. It does not make you reliable. You can still misread, misweight, or skim what was loaded. The script narrows the failure surface; it does not eliminate it.

Treat refresh as the floor of being useful, not the ceiling.

For multi-provider work, refresh is the handoff point that lets each visible agent session start from the same durable memory chain instead of an isolated chat.

## When To Run It

Run refresh only when:

- Starting a new context/session.
- Returning after known or suspected compaction or context loss.
- The Director explicitly says "refresh memory."

Do not run refresh merely because a handoff was received, a task seems large, or implementation may be coming. While context is intact, use targeted retrieval for the relevant task, rule, case study, or session. Mention session-entry preservation only when continuity risk is high, such as likely compaction, imminent context loss, or handoff-worthy accumulated state.

## How To Run It

One path. No alternatives.

Run the M-PACT bundled refresh script with Node.js from the current project working directory and read its stdout manifest. Node is the only runtime. The script path comes from the invoked M-PACT skill or extension; do not treat the current project's own `scripts/` directory as a fallback or probe, because unrelated projects often have unrelated `scripts/` folders.

Pass the installed skill script path to Node while staying in the current project working directory. For this local install, the common commands are:

```bash
# Codex / Node.js
node ~/.codex/skills/m-pact/scripts/build-refresh-bundle.js

# Claude Code / Node.js
node ~/.claude/skills/m-pact/scripts/build-refresh-bundle.js

# Copilot CLI / Node.js
node ~/.copilot/skills/m-pact/scripts/build-refresh-bundle.js

# Gemini CLI extension / Node.js
node ~/.gemini/extensions/m-pact/scripts/build-refresh-bundle.js
```

Node.js 18 or newer is required. If `node` is unavailable, or the script reports an unsupported Node version, stop and report the exact refresh failure.

If the skill is installed somewhere else, run the `scripts/build-refresh-bundle.js` file from the invoked skill folder with Node.js. Do not `cd` into the skill directory before running it. The script resolves memory roots from the current project working directory unless `--StartPath` is explicitly supplied. When actively developing M-PACT itself, a maintainer may intentionally run the source-tree script for verification, but startup refresh instructions for agents should still point at the invoked M-PACT script path.

Never run refresh as `cd <skill-folder> && node scripts\...`; that resolves memory roots from the skill install directory and can falsely report `project: (none found)`. A false `project: (none found)` caused by running from the skill folder is not permission to bootstrap. Re-run refresh from the real project root instead.

If stdout contains `M-PACT PROJECT SETUP REQUIRED` and its literal final line is `END PROJECT SETUP REQUIRED`, no refresh bundle was produced. Do not emit a receipt and do not load user-root-only context yet. Ask the setup question from stdout and stop. If the Director says yes, follow `references/bootstrap-project.md` to add the missing project scaffolding, then run refresh again. If the Director says no, run refresh again with `--AllowUserRootOnly` and emit the resulting user-root-only receipt.

If stdout contains `AUDIT: PASS`, `M-PACT REFRESH BUNDLE MANIFEST`, a `BundlePath: <absolute path>` line, and its literal final line is `END REFRESH BUNDLE`, read the bundle file at `BundlePath`, verify that the file's literal final line is also `END REFRESH BUNDLE`, then emit the compact receipt body from that bundle. The receipt body starts with `M-PACT MEMORY REFRESH`; do not emit the internal `BEGIN REFRESH RECEIPT` or `END REFRESH RECEIPT` marker lines.

The stdout manifest alone is not a completed refresh and does not load memory by itself. `BundlePath` is not a question for the Director; it is the next required step. Never stop after printing the bundle path, never ask whether to open or apply the bundle, and never ask what to do next before the receipt body has been emitted.

After successful refresh, treat the verified bundle as the loaded startup context. Do not read `.AgentMemory`, `.AgentMemoryRoot`, rules, sessions, tasks, journals, case studies, or generated temp bundles merely to verify refresh or "complete" the startup load. The script already selected the startup content and audited the bundle. If the same user message includes a substantive request beyond refresh/startup, continue with that request using the loaded context. Use targeted lookup only when the Director asks for a specific artifact or the current work actually requires omitted details.

If stdout reports `AUDIT: FAIL` and `END REFRESH FAILURE`, stop and report the exact failure. If the script is missing, fails, output is truncated, lacks one of the valid final markers (`END PROJECT SETUP REQUIRED` or `END REFRESH BUNDLE`), lacks `AUDIT: PASS` for a refresh bundle, lacks a `BundlePath` for a refresh bundle, the bundle file cannot be read, the bundle file lacks final-line `END REFRESH BUNDLE`, or stdout reports `AUDIT: FAIL`, stop and report the exact failure. Do not improvise a manual refresh.

If stdout contains `LimitHit: true`, the refresh still succeeded but the bundle is partial. Emit the compact receipt, explicitly say the size limit was hit, and use targeted memory lookup for omitted startup content when needed. Do not treat a size-limited partial bundle as `AUDIT: FAIL`.

If no project root exists, the normal refresh script should stop before bundle generation with `M-PACT PROJECT SETUP REQUIRED`. The setup question should say setup will add any missing pieces: `.AgentMemory/` with standard subfolders and the M-PACT startup shims in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. It should also say existing files will not be overwritten. Ask the Director to answer yes or no, then stop. Do not create anything unless the Director explicitly approves. Treat "maybe," "not sure," "let me think," or explanatory questions as no approval yet. Emit a user-root-only receipt only after the Director answers no and refresh has been rerun with `--AllowUserRootOnly`.

Manual investigation is allowed only when the Director explicitly asks for debugging or repair.

## Receipt

The bundle file includes a compact receipt block between `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT`. Emit only that compact receipt body, excluding the marker lines themselves. The first visible line must be `M-PACT MEMORY REFRESH`. Normal successful refresh should be a tiny acknowledgement, not a startup report. Do not print roots, rule lists, session counts, task pointers, or the full startup manifest merely to prove refresh; those details are already loaded inside the verified bundle. After emitting the compact receipt, stop the refresh flow; do not self-verify with additional memory reads, and do not end the turn solely because refresh completed when the same user message includes a substantive request.

## When Refresh Fails

State the exact error. State what the script was trying to do when it failed. Ask the Director how to proceed.

Do not load failed partial context and continue. Half-loaded context from an audit failure is worse than not-loaded because it produces confident-sounding wrong answers instead of obvious gaps. A size-limited bundle with `AUDIT: PASS`, `LimitHit: true`, and `END REFRESH BUNDLE` is an explicit partial success; continue with the warning visible and retrieve omitted artifacts on demand.
