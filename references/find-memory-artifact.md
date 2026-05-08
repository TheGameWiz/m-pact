# Find Memory Artifact

Use when the Director asks to find, list, inspect, show, summarize, or read a memory artifact.

This reference covers:

- Rules in `rules/`
- Sessions in `sessions/`
- Tasks in `tasks/`
- Case studies in `case-studies/`
- Journals in `journal/`

## Scope

Respect explicit scope words:

- `local`, `active`, or unscoped: active `.AgentMemory/` only.
- `root`, `user`, `global`, or cross-project: `.AgentMemoryRoot/`.
- `parent`: nearest parent `.AgentMemory/` above the active root.
- `named`: the named root only.
- `all` or `layered`: `.AgentMemoryRoot/`, ancestor `.AgentMemory/` roots, then active `.AgentMemory/`.

Do not scan sibling projects unless the Director names them. Normal memory lookup is lineage-based.

## Search Order

1. Resolve roots with `resolve-memory-roots.md`.
2. Select roots from the requested scope.
3. Search filenames first. Filenames are the index.
4. Read bodies only after narrowing candidates by filename, date, task number, type, or topic.
5. If filename search is inconclusive, search bodies in the selected roots only.
6. Preserve root boundaries in the answer. Do not merge or renumber across roots.

## Artifact Rules

### Rules

- List layered rule filenames before creating or updating rules. Filenames are the index; there is no separate rule index file.
- `core-*.md` rules are loaded at refresh; non-core rules are read on demand.
- For overlap checks, search all selected chain roots before proposing a new rule.

### Sessions

- Unscoped session list/read requests mean active root only.
- All/layered order is `.AgentMemoryRoot`, ancestor roots, active root.
- Sort session filenames by timestamp descending unless the Director asks for chronological order.
- Session entries are context, not prompts or task assignments.

### Tasks

- Unscoped task-list requests mean active root only.
- Show active tasks by default; include closed tasks only when requested.
- Within a root: Active before Closed, then priority, then newest task number first.
- For topic lookup such as "the task where we discussed modeling clay," search task folder names first. If multiple folder-name matches remain and the Director asks for the most recent one, use the highest matching task number in that root unless the Director specifies latest modified log or another recency meaning.
- If task folder names are inconclusive, search `task.md`, then `specification.md`, `summary/`, and `log/` only as needed to narrow the candidate set.
- For a specific task lookup, read `task.md` first. Read `specification.md`, `log/`, or `summary/` only when the request needs them.
- For handoff, resume, continue, or "pick up this task" requests, read `task.md` and `specification.md` when present, then list log filenames with sizes before loading logs. If total logs are 50KB or less, read all logs. If total logs exceed 50KB and the Director did not request all logs or a specific range, read newest logs backward up to about 50KB, include the newest single log even when it alone exceeds 50KB, and report the loaded log range and skipped older history.
- Use the zero-byte `tasks/current__<active-task-folder>` sentinel as the current-task pointer, not as a task index.

### Case Studies

- Do not read case studies at startup.
- Unscoped case-study lookup/list requests mean active root only.
- All/layered order is `.AgentMemoryRoot`, ancestor roots, active root.
- Search by filename/topic first, then body text if needed.

### Journals

- Do not read journals at startup.
- Unscoped journal lookup/list requests mean active root only.
- All/layered order is `.AgentMemoryRoot`, ancestor roots, active root.
- Sort journal filenames by timestamp descending unless the Director asks for chronological order.
- Journal entries are reflective records, not prompts or task assignments.

## Response Shape

For lists, show artifact type, root, filename, and a short title/description when available.

For a single found artifact, report the path and the relevant contents or concise summary. If multiple candidates match, list the candidates and ask only if the intended artifact remains ambiguous after cheap inspection.

If nothing matches in the requested scope, say which roots and patterns were searched.
