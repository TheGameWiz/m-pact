# Search Agent Sessions

Use when the Director wants to recall something discussed in a prior conversation and does not point at a specific written memory artifact — "when did we talk about turning this button into a slider," "did we ever discuss X," "find the conversation where we decided Y," "what did we say about Z last week." Task-log and design-spec records are curated summaries; the actual nuance often only exists in the raw provider transcript.

This is not a new script. It composes three things that already exist:

- `Agents.json` (task-scoped, alongside `task.md`) — which provider sessions touched a task.
- `scripts/list-agent-session-paths.js` — resolves one task's `Agents.json` entries to on-disk transcript paths. Use it exactly as it stands; do not modify its single-task, non-content-search behavior. This reference sits on top of it, not in place of it.
- `<userRoot>/projects.json` — every project the user root has adopted.

There is no helper that lists every task in a project or every project across the user root. None is needed — both are a directory listing and a small JSON read. Reading `tasks/` folder names and `projects.json` for this procedure is a deliberate, narrow exception to `memory-root-policy.md`'s "don't hand-list memory folders, use helper root resolution" default. That default targets choosing where a *write* belongs; this is a read-only recall sweep with no helper built for it, so listing directly is correct here.

**Note on the word "scope":** the task/project/global scope below is a different axis from `find-memory-artifact.md`'s local/root/parent/named/all root-chain scope words. Those govern which `.AgentMemory` root an ordinary artifact lookup uses. This scope governs how many tasks' provider transcripts get swept for a raw-conversation search. Do not conflate the two.

## Resolving scope

- If the Director's phrasing already states or clearly implies the scope ("search this task," "did we discuss this anywhere in the project," "check every project") — use it directly. Do not ask when they've already said it.
- Ask only when scope is genuinely ambiguous — a bare "when did we talk about X" with nothing narrowing it.
- Escalate narrower to broader only on a miss (task → project → global), unless resolving occurrence count below says to sweep everything up front.

## Resolving occurrence count (first vs. all)

Infer this from phrasing the same way as scope — do not default to asking, and do not default to an exhaustive sweep either.

- **Singular recall framing implies stop at the first match.** "A couple days ago we talked about X," "when did we discuss X," "do you remember when we," "the time we decided X" — this is someone reaching for one specific remembered moment. Stop as soon as you find a good match: stop iterating further tasks in the current scope, and do not escalate to a broader scope. Do not keep searching just to confirm it was the only occurrence.
- **Exhaustive framing implies sweep everything in scope.** "Every time we talked about X," "all the times," "whenever we discussed X," "each time we changed X" — these ask for a count or a full list, so a first match is not an answer. Sweep the full resolved scope and report every match.
- **Ask only when the phrasing gives neither cue** — e.g. a flat "find where we talked about X" with no singular or plural framing at all. Ask once, in the same turn as any scope question if both are unresolved.

This decision governs the "stop at first match" instructions in the Project and Global scope procedures below.

## Task scope

1. Resolve the task — current task by default (`tasks/current__<folder>` sentinel), or the one the Director names.
2. Run `scripts/list-agent-session-paths.js` (add `--task <id-or-folder>` for a non-current task) to get `agentSessionPaths`.
3. Grep the returned paths for keyword variants of the topic. If the Director's exact wording doesn't hit, try synonyms or related phrasing before concluding "not found" — transcripts are ordinary JSONL text, and matching a paraphrased topic to the words actually used is your judgment call, not a literal-string match.
4. Report which session/provider matched, with enough context (timestamp, agent) for the Director to place it, plus a short quote or summary — not the raw JSONL.

## Project scope

1. Resolve the active project root's `.AgentMemory` folder.
2. List `<project>/.AgentMemory/tasks/` directly. Folder names are `A__pN-tNNNN-slug` (open) or `C__pN-tNNNN-slug` (closed) — include both; a remembered detail can live in a finished task.
3. Order: current task first (likeliest hit), then the rest by task number descending.
4. For each task in scope, run `list-agent-session-paths.js --task <folder-name-or-id>` and apply the Task scope search step above. Stop after the first match unless occurrence-count resolution above calls for an exhaustive sweep.
5. Report which task(s) matched.

## Global scope

1. Resolve the active user root: `MPACT_USER_ROOT` env var if set, otherwise `~/.AgentMemoryRoot` (the standard location every helper already resolves to). If refresh already reported a resolved user root this session, use that value rather than recomputing.
2. Read `<userRoot>/projects.json` directly — a small flat array of `{ projectId, name, path }`. This file is meant to be read directly, unlike ZIP-backed memory.
3. Order: current project first, then the remaining entries in file order — no priority ordering is defined across projects.
4. For each project, apply the Project scope procedure above (which already covers every task within it and already stops after the first match unless an exhaustive sweep was called for).
5. If a listed project path no longer exists on disk, skip it silently — the registry self-heals on the next identity-lifecycle write, but a sweep can run in between. Mention a skipped project only if nothing else in scope answered the Director's question.

## Efficiency and semantic matching

- Do not read a whole transcript file into context. Grep first for keyword variants across the candidate paths, then read just the matching lines/records for surrounding context. Provider transcripts are JSONL — one event per line.
- A project- or global-scope sweep can touch many files; grep narrows before any full read, at every scope.
- `unresolvedAgentSessions` from `list-agent-session-paths.js` (a recorded session with no file found on disk) is expected sometimes at project/global scale — mention it only if it's relevant to the Director's question ("that conversation may exist but its transcript wasn't found on this machine"), not as an error.

## Non-Goals

- Not a transcript index or cache. Every search runs fresh against on-disk provider transcripts at request time.
- Not a replacement for `search-bodies.js`, which searches curated M-PACT memory (journal/task-log/case-study/session bodies) — this searches raw provider transcripts instead.
- Does not change `list-agent-session-paths.js`'s current single-task, path-resolution-only behavior.
