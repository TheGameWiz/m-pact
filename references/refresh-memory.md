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

Run the bundled script from the current project working directory and read its stdout manifest. If the current repository itself contains `scripts/build-refresh-bundle.js`, prefer that local script:

```powershell
node scripts\build-refresh-bundle.js
```

For installed skill copies outside the repository, pass the script path to Node while staying in the current project working directory. For this local install, the common commands are:

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

If the skill is installed somewhere else, run the `scripts/build-refresh-bundle.js` file from the invoked skill folder with Node.js. Do not `cd` into the skill directory before running it. The script resolves memory roots from the current project working directory unless `--StartPath` is explicitly supplied.

Never run refresh as `cd <skill-folder> && node scripts\...`; that resolves memory roots from the skill install directory and can falsely report `project: (none found)`. A false `project: (none found)` caused by running from the skill folder is not permission to bootstrap. Re-run refresh from the real project root instead.

If stdout contains `AUDIT: PASS`, `M-PACT REFRESH BUNDLE MANIFEST`, a `BundlePath: <absolute path>` line, and its literal final line is `END REFRESH BUNDLE`, read the bundle file at `BundlePath`, verify that the file's literal final line is also `END REFRESH BUNDLE`, then emit the receipt body from that bundle verbatim. The receipt body starts with `M-PACT MEMORY REFRESH`; do not emit the internal `BEGIN REFRESH RECEIPT` or `END REFRESH RECEIPT` marker lines.

The stdout manifest alone is not a completed refresh and does not load memory by itself. `BundlePath` is not a question for the Director; it is the next required step. Never stop after printing the bundle path, never ask whether to open or apply the bundle, and never ask what to do next before the receipt body has been emitted.

After successful refresh, treat the verified bundle as the loaded startup context. Do not read `.AgentMemory`, `.AgentMemoryRoot`, rules, sessions, tasks, journals, case studies, or generated temp bundles merely to verify refresh or "complete" the startup load. The script already selected the startup content and audited the bundle. Use targeted lookup only when the Director asks for a specific artifact or the current work actually requires omitted details.

If stdout reports `AUDIT: FAIL` and `END REFRESH FAILURE`, stop and report the exact failure. If the script is missing, fails, output is truncated, lacks `AUDIT: PASS`, lacks a `BundlePath`, lacks final-line `END REFRESH BUNDLE`, the bundle file cannot be read, the bundle file lacks final-line `END REFRESH BUNDLE`, or stdout reports `AUDIT: FAIL`, stop and report the exact failure. Do not improvise a manual refresh.

If stdout contains `LimitHit: true`, the refresh still succeeded but the bundle is partial. Emit the receipt body verbatim, explicitly say the size limit was hit, and use targeted memory lookup for omitted startup content when needed. Do not treat a size-limited partial bundle as `AUDIT: FAIL`.

If refresh succeeds but the receipt reports `project: (none found)`, explain that only user-level memory was loaded for this workspace and ask a hard yes/no project setup question. The question should say setup will create or repair `.AgentMemory/` and create or append the M-PACT startup shims in `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`. Ask the Director to answer yes or no, then stop. Do not create anything unless the Director explicitly approves. Treat "maybe," "not sure," "let me think," or explanatory questions as no approval yet.

Manual investigation is allowed only when the Director explicitly asks for debugging or repair.

## Receipt

The bundle file includes a receipt block between `BEGIN REFRESH RECEIPT` and `END REFRESH RECEIPT`. Emit only the receipt body between those markers, excluding the marker lines themselves. The first visible line must be `M-PACT MEMORY REFRESH`. Do not summarize, condense, or paraphrase the receipt body. After emitting it, stop the refresh flow; do not self-verify with additional memory reads.

## When Refresh Fails

State the exact error. State what the script was trying to do when it failed. Ask the Director how to proceed.

Do not load failed partial context and continue. Half-loaded context from an audit failure is worse than not-loaded because it produces confident-sounding wrong answers instead of obvious gaps. A size-limited bundle with `AUDIT: PASS`, `LimitHit: true`, and `END REFRESH BUNDLE` is an explicit partial success; continue with the warning visible and retrieve omitted artifacts on demand.
