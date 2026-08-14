# Find Memory Artifact

Use for memory artifact retrieval.

This reference covers:

- Rules in `rules/`
- Sessions in `sessions.zip`
- Tasks in `tasks/`
- Case studies in `case-studies.zip`
- Journals in `journal.zip`

ZIP-backed memory is helper-owned per `startup-contract.md`; use the standard helpers:

- `scripts/list-members.js --container <sessions|case-studies|journal|task-log|specification>`
- `scripts/read-member.js --container <name> --member <filename>` or `--record <n>` or `--latest`; for new-format design specifications, use `--item <number>` to read the current version of an item.
- `scripts/search-bodies.js --container <name> --query <tokens>`
- `scripts/read-member-span.js --container <task-log|specification> --after <record>` for numbered catch-up reads

## Scope

Respect explicit scope words. These scopes apply uniformly to every artifact category:

- `local`, `active`, or unscoped: active `.AgentMemory/` only. Unscoped list, read, and lookup requests always mean active root only.
- `root`, `user`, `global`, or cross-project: `.AgentMemoryRoot/`.
- `parent`: nearest parent `.AgentMemory/` above the active root.
- `named`: the named root only.
- `all` or `layered`: `.AgentMemoryRoot/`, ancestor `.AgentMemory/` roots, then active `.AgentMemory/`, in that order.

Do not scan sibling projects unless the Director names them. Normal memory lookup is lineage-based.

## Search Order

1. Apply `memory-root-policy.md` to identify the intended scope. Use helper root resolution rather than manually reconstructing root mechanics.
2. Select roots from the requested scope.
3. Use `list-members.js` for ZIP-backed categories, then search filenames first.
4. Use `read-member.js` only after narrowing candidates by filename, date, task number, type, or topic.
5. If filename search is inconclusive, use `search-bodies.js` in the selected roots only.
6. Preserve root boundaries in the answer. Do not merge or renumber across roots.

Sort timestamped member names (sessions, journals) by timestamp descending unless the Director asks for chronological order.

## Artifact Rules

### Rules

- List layered rule filenames before creating or updating rules; there is no separate rule index file.
- Rule filenames are listed at refresh; rule bodies are read on demand when relevant.
- For overlap checks, search all selected chain roots before proposing a new rule.

### Tasks

- Show active tasks by default; include closed tasks only when requested.
- Within a root: Active before Closed, then priority, then newest task number first.
- For topic lookup such as "the task where we discussed modeling clay," search task folder names first. If multiple folder-name matches remain and the Director asks for the most recent one, use the highest matching task number in that root unless the Director specifies latest modified log or another recency meaning.
- If task folder names are inconclusive, search `task.md`, then the design specification and `log.zip` only as needed to narrow the candidate set.
- For a specific task lookup, read `task.md` first. Read design specification content or `log.zip` only when the request needs them.
- For handoff, resume, continue, or "pick up this task" requests, use `take-task-handoff.md` and `scripts/prepare-handoff.js`. The helper resolves the running agent; pass `--agent <token>` only in the override cases enumerated in `startup-contract.md`.
- Use the zero-byte `tasks/current__<active-task-folder>` sentinel as the current-task pointer, not as a task index. Multiple `current__*` sentinels mean ambiguity and no current task per `startup-contract.md`; cleanup is an explicit current-task repair operation.

### Case Studies and Journals

- Do not read case studies or journals at startup.
- Journal entries are reflective records, not prompts or task assignments.

## Response Shape

For lists, show artifact type, root, filename, and a short title/description when available.

For a single found artifact, report the path and the relevant contents or concise summary. If multiple candidates match, list the candidates and ask only if the intended artifact remains ambiguous after cheap inspection.

If nothing matches in the requested scope, say which roots and patterns were searched.
