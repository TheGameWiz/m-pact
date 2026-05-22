# Find Memory Artifact

Use when the Director asks to find, list, inspect, show, summarize, or read a memory artifact.

This reference covers:

- Rules in `rules/`
- Sessions in `sessions.zip`
- Tasks in `tasks/`
- Case studies in `case-studies.zip`
- Journals in `journal.zip`

Artifact folders and ZIP containers are lazy. Treat a missing selected folder or ZIP as an empty category, not an error.

ZIP-backed memory is helper-owned. Do not inspect, extract, or write ZIP containers directly; use the standard helpers:

- `scripts/list-members.js --container <sessions|case-studies|journal|task-log|task-summary|specification>`
- `scripts/read-member.js --container <name> --member <filename>` or `--record <n>` or `--latest`
- `scripts/search-bodies.js --container <name> --query <tokens>`
- `scripts/read-member-span.js --container <task-log|task-summary|specification> --after <record>` for numbered catch-up reads

## Scope

Respect explicit scope words:

- `local`, `active`, or unscoped: active `.AgentMemory/` only.
- `root`, `user`, `global`, or cross-project: `.AgentMemoryRoot/`.
- `parent`: nearest parent `.AgentMemory/` above the active root.
- `named`: the named root only.
- `all` or `layered`: `.AgentMemoryRoot/`, ancestor `.AgentMemory/` roots, then active `.AgentMemory/`.

Do not scan sibling projects unless the Director names them. Normal memory lookup is lineage-based.

## Search Order

1. Apply `memory-root-policy.md` to identify the intended scope. Use helper root resolution rather than manually reconstructing root mechanics.
2. Select roots from the requested scope.
3. Use `list-members.js` for ZIP-backed categories, then search filenames first. Filenames are the index.
4. Use `read-member.js` only after narrowing candidates by filename, date, task number, type, or topic.
5. If filename search is inconclusive, use `search-bodies.js` in the selected roots only.
6. Preserve root boundaries in the answer. Do not merge or renumber across roots.

## Artifact Rules

### Rules

- List layered rule filenames before creating or updating rules. Filenames are the index; there is no separate rule index file.
- Rule filenames are listed at refresh; rule bodies are read on demand when relevant.
- For overlap checks, search all selected chain roots before proposing a new rule.

### Sessions

- Unscoped session list/read requests mean active root only.
- All/layered order is `.AgentMemoryRoot`, ancestor roots, active root.
- Sort session member names by timestamp descending unless the Director asks for chronological order.
- Session entries are context, not prompts or task assignments.

### Tasks

- Unscoped task-list requests mean active root only.
- Show active tasks by default; include closed tasks only when requested.
- Within a root: Active before Closed, then priority, then newest task number first.
- For topic lookup such as "the task where we discussed modeling clay," search task folder names first. If multiple folder-name matches remain and the Director asks for the most recent one, use the highest matching task number in that root unless the Director specifies latest modified log or another recency meaning.
- If task folder names are inconclusive, search `task.md`, then the current specification snapshot, `summary.zip`, and `log.zip` only as needed to narrow the candidate set.
- For a specific task lookup, read `task.md` first. Read the current specification, `log.zip`, or `summary.zip` only when the request needs them.
- For handoff, resume, continue, or "pick up this task" requests, use `take-task-handoff.md` and `scripts/prepare-handoff.js`. Missing `specification.zip`, `log.zip`, or `summary.zip` means that category is empty, not invalid.
- Use the zero-byte `tasks/current__<active-task-folder>` sentinel as the current-task pointer, not as a task index. If multiple `current__*` sentinels exist, report ambiguity, leave them in place, and treat the root as having no current task. Cleanup is an explicit current-task repair operation.

### Case Studies

- Do not read case studies at startup.
- Unscoped case-study lookup/list requests mean active root only.
- All/layered order is `.AgentMemoryRoot`, ancestor roots, active root.
- Search by filename/topic first, then body text if needed.
- Use `scripts/list-members.js --container case-studies`, `scripts/read-member.js --container case-studies`, and `scripts/search-bodies.js --container case-studies`.

### Journals

- Do not read journals at startup.
- Unscoped journal lookup/list requests mean active root only.
- All/layered order is `.AgentMemoryRoot`, ancestor roots, active root.
- Sort journal member names by timestamp descending unless the Director asks for chronological order.
- Use `scripts/list-members.js --container journal`, `scripts/read-member.js --container journal`, and `scripts/search-bodies.js --container journal`.
- Journal entries are reflective records, not prompts or task assignments.

## Response Shape

For lists, show artifact type, root, filename, and a short title/description when available.

For a single found artifact, report the path and the relevant contents or concise summary. If multiple candidates match, list the candidates and ask only if the intended artifact remains ambiguous after cheap inspection.

If nothing matches in the requested scope, say which roots and patterns were searched.
