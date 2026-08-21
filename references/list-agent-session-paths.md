# List Agent Session Paths

Use when the Director asks about provider chat history tied to a task: chat session, conversation, thread, transcript, provider history, "where did we discuss X?", or "summarize the chat where this task evidence came from."

This helper resolves task-local `Agents.json` entries to provider transcript JSONL paths. It does not search transcript contents and does not read transcript bodies.

## Procedure

1. Use the current task by default, or pass `--task t0005` when the Director names one.
2. Run `scripts/list-agent-session-paths.js`.
3. Search or read only the returned `agentSessionPaths` according to the Director's question. Do not broad-scan `.codex`, `.claude/projects`, or `.gemini` roots first.
4. Treat `unresolvedAgentSessions` as useful evidence, not a fatal helper failure. Provider transcript stores may have been moved, pruned, or created by a provider version with a different layout.

Examples:

```bash
node <this-skill>/scripts/list-agent-session-paths.js
node <this-skill>/scripts/list-agent-session-paths.js --task t0040
```

For "where did we discuss ABC?", run the helper, then search the returned `path` values for `ABC` and summarize only matching transcript snippets or records. For "give me the associated chat paths", return the helper's provider, agent, id, path, modified timestamp, and size fields.

## Capture

Task mutation helpers record provider transcript IDs automatically in `Agents.json`. `set-current-task` also records on task-selection calls, and `prepare-handoff` records when the resolved task is open. `set-current-task --clear` and closed-task `prepare-handoff` lookups do not record. A live agent does not pass its own session ID. The helpers reuse existing agent resolution and read the provider variable for that agent:

- Claude: `CLAUDE_CODE_SESSION_ID`
- Codex: `CODEX_THREAD_ID`, falling back to `CODEX_SESSION_ID`
- Antigravity: `ANTIGRAVITY_CONVERSATION_ID`

If the variable is absent, the helper skips recording silently. If provider identity markers disagree, the existing agent-resolution error surfaces unchanged.

## Resolution Notes

Claude path resolution is the strongest: transcript storage under `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/*/<session-id>.jsonl` is documented by Claude Code.

Codex path resolution is observed behavior, not a formal public contract: `${CODEX_HOME:-~/.codex}/session_index.jsonl` can confirm an ID and optional thread name, but the actual JSONL path is found by a bounded scan under `${CODEX_HOME:-~/.codex}/sessions/**/*-<id>.jsonl`.

Antigravity path resolution is best-effort against known roots under `~/.gemini/antigravity*/brain/<conversation-id>/.system_generated/logs/transcript.jsonl`.

## Non-Goals

This helper is not semantic search, not a transcript parser, not a provider archive crawler, and not a replacement for `sessions.zip`. It exists to hand the agent a task-scoped list of raw provider transcript paths so any subsequent search is narrow and intentional.
