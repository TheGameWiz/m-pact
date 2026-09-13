# M-PACT Reference Audit against the User Guide Outline

Working document, 2026-09-06 (Walk 38). Companion to `M-PACT_USER_GUIDE_OUTLINE.md`.

Updated 2026-09-07 for the help/quick-reference entry point and its aliases.

## What this is

A pass over every file in `references/` (27 files as of this audit; the 2026-08-19 outline revision counted 25), plus `SKILL.md`, `README.md`, and the help-facing quick-reference surface in `docs/M-PACT_USER_GUIDE_QUICK_REFERENCE.md`, checking two things against the outline:

1. Does every user-facing operation the references describe have a home in the outline?
2. Where the outline makes a claim about behavior, does the reference agree?

Scripts are out of scope. The references are what describe behavior; the scripts are what back it. If a reference says a helper does X, the outline is checked against the reference, not the script. Narrow exception: `scripts/help.js` is checked only for the user-facing help aliases and render target, because that is the entry point users invoke directly.

The filter is the one the outline already states: a detail belongs in the guide only if the reader must **see, decide, or answer** it. Agent-only procedure (scratch file conventions, receipt field names, ZIP mechanics) is noted as correctly excluded, not as a gap.

## Findings, in order of weight

### 1. Saved context is not tied to a task (correction)

Outline Part 4, "Saving and restoring context," says saved context "belongs to the current task" and asks "what happens if no task is current." `context-save-restore.md` says the opposite in plain terms: the file lives in the root's `.tmp`, it is "not tied to a task," and "save-context requires no current task." Saved context belongs to the agent that saved it, after that agent loses context. It is not for a different agent, and task handoff remains a task-log operation.

The quick reference repeats the error: "Save context - before a compaction or an intentional restart, on the current task."

Fix: drop "belongs to the current task" and the no-current-task question from the outline; drop "on the current task" from the quick reference. State ownership as: yours, for this agent, after a compaction or restart. You may well have been mid-task when you saved, so the task will dominate the content, but that is content, not ownership.

Two related facts the reference states that the outline does not, both of which the user sees:

- One saved context per agent. Saving again replaces the previous one for that agent. Refresh also silently discards older duplicates and keeps the newest.
- If refresh cannot tell which agent is starting and a saved context exists, refresh fails outright rather than skip the saved context silently. The user sees `AUDIT: FAIL` and `M-PACT SAVED CONTEXT UNHANDLED`. This belongs in section 14.

### 2. Recalling a prior conversation is missing entirely (addition)

Two references have no home in the outline:

- `search-agent-sessions.md` - "when did we talk about turning this button into a slider," "did we ever discuss X," "find the conversation where we decided Y." Searches the raw provider transcripts, not the curated memory records, at task, project, or global scope. The reference is explicit that this is a different axis from the artifact-lookup scope words.
- `list-agent-session-paths.md` - the task-scoped version: "where did we discuss X on this task," "give me the chat paths for this task."

The outline's "Finding things" bullet covers looking up a memory artifact or searching record bodies. Neither of those is this. The distinction matters to the user because the answer comes from a different place: the memory record is the summary the agent wrote, the transcript is what was actually said.

Two user-visible behaviors from the reference:

- Scope: the agent uses the scope you stated and asks only if you gave none. "This task," "anywhere in the project," and "every project" are the three.
- First match versus all matches: "when did we talk about X" stops at the first hit; "every time we talked about X" sweeps everything in scope. Phrase it the way you mean it.

Fix: add a "Recalling a prior conversation" section to Part 4, separate from "Finding things."

### 3. Adoption and identity repair are questions the user must answer (addition)

`adopt-project-identity.md` and `repair-project-identity.md` were excluded from the quick reference as "things the system asks you." That is the right call for the quick reference, which lists what you can ask for. It is the wrong call for the guide, because both pass the see-decide-answer test: the agent stops and asks a yes/no question, and a user who has never heard of adoption has no basis for the answer.

When each happens:

- **Adoption**: a project has an `.AgentMemory` folder from before project identity existed. Refresh still loads memory and emits the receipt, then asks whether to adopt this one root. Yes mints identity and refresh runs again. No leaves reads working and every durable write halting until you say yes.
- **Repair**: you renamed, moved, or copied the project folder, or two identity sentinels ended up in one root. A helper prints `M-PACT PROJECT IDENTITY REQUIRED` and asks whether the current location is intended. The reference notes the original location cannot be reconstructed from the sentinel, so a human answer is required.

Fix: section 7 gets adoption as the second way an existing project enters M-PACT; section 14 gets "you moved or renamed the project" as a new bullet.

### 4. Startup hooks change what "starting a session" looks like (correction to emphasis)

`install-mpact.md` says install merges a `SessionStart` hook for Codex and Claude Code (matcher `startup|clear|compact`) and a `PreInvocation` hook for Antigravity. The consequences the user sees:

- Refresh runs on its own at session start, after `/clear`, and after compaction. The receipt appears without being asked for. The quick reference already says "happens on its own"; the outline's section 6 is still written as if the first prompt is the main event.
- After an automatic compaction, the hook re-runs refresh, which is what restores saved context without the user asking. This is the mechanism behind the overview bullet "restores automatically," and the outline does not connect the two.
- Codex requires the user to review and trust non-managed hooks through `/hooks`. The install receipt says so. This is a step the user must take, and section 5 does not mention it.
- Hook-injected stdout carries an `M-PACT HOOK NOTE` because the user has not seen the receipt. Users will see this line and wonder what it is.

Fix: section 5 gains the `/hooks` step for Codex; section 6 is reframed around what you will see happen on its own; Part 4's "Saving and restoring context" names compaction-triggered refresh as the restore path.

### 5. The journal is the one editable record (correction)

Section 2, mental model: "Writes are append-only. A wrong record is corrected by a later record, never erased." `write-journal-entry.md` and the full contract both name journal modification as "the controlled exception to the ordinary append-only correction model." Task logs and design specifications are never edited; journal entries can be, on explicit ask.

Fix: one clause in section 2, one line in the journal bullet in Part 4. Small, but the mental model section is the one place the guide should not be wrong.

### 6. Some phrasings are already anchored (open question is partly stale)

Section 12 and the open questions list ask whether any phrasings get anchored in the skill. Two references already anchor phrasings:

- `take-task-handoff.md` has an invocation vocabulary table it calls "a guaranteed minimum, not an exhaustive command reference": `Handoff, Request Design Review`, `Take Handoff, Implement`, and so on. An unlisted verb resolves by direction, not by string match.
- `context-save-restore.md` lists accepted phrases for save and restore.

So the answer for handoffs and save-context is "anchored minimum, plus natural language resolves." The open question remains open only for the other operations. Section 12 should say this rather than treat the whole set as undecided.

### 7. Lookup scope words are user vocabulary (addition)

`find-memory-artifact.md` defines scope words the user says and the agent obeys: unscoped or `local` means this project only; `global`, `user`, or `root` means the user root; `parent`, `named`, and `all` or `layered` widen. The same rule governs where a rule, journal entry, or case study is written: project by default, user root only when you say global or user-level.

The outline's "Finding things" bullet and the "Rules" bullet do not mention this. A user who asks "what rules do we have" gets the project's rules only and may think the global ones are missing.

Fix: add the scope words to "Finding things" and to the Rules bullet.

### 8. Close and reopen have consequences the user should expect (addition)

`close-task.md` and `reopen-task.md`:

- Close records unfinished and cleared-but-unresolved items in a close log record. The agent's one-line reply mentions if there was remaining work.
- Reopen surfaces those items but does not put them back on the active list. The first task log after reopen must seed the list deliberately. The full contract names "assuming reopen restores the pre-close active-item list" as the likeliest mistake.

The outline's "Closing and reopening a task" is a bare heading. Fix: two lines under it.

### 9. The specification mirror is the user's editing surface (addition)

`write-design-spec.md`: new-format tasks have a plaintext `specification.md` mirror of the current narrative. Editing that file and asking the agent to fold it in is the supported path for narrative edits. The ZIP is the source of truth; the mirror is regenerated after every write.

This is the one place a user can edit a memory file by hand and have it count. The "Designing and iterating" bullet should say so, and section 7 ("what appears in your project") should list `specification.md` among the things that show up.

### 10. Suppression is a fourth state, distinct from disable (addition)

`SKILL.md` and `README.md`: `MPACT_SUPPRESS` is a harness compatibility guard, not a user off switch. ConflabCode is the motivating case. When set, helpers print `M-PACT SUPPRESSED`, refresh does not run, and disable/enable are also blocked. Uninstall still works.

Section 8 lists three operations and says "turn it off" is ambiguous. A ConflabCode user will see `M-PACT SUPPRESSED` and not find it in the guide. Fix: one bullet in section 8 saying what the notice means and that it is not something you set by hand.

### 11. Refresh failure and "no memory root here" belong in section 14 (addition)

`refresh-memory.md` lists the user-visible failure outcomes: `AUDIT: FAIL`, Node missing or too old, truncated output, and the reply `M-PACT: no memory root here; refresh skipped` after declining project setup. The reference is firm that the agent must not load partial context and continue. Section 14 has no "refresh failed" bullet.

### 12. Smaller items

- **`.tmp` appears in the project.** `helper-write-conventions.md` and `context-save-restore.md`: `.AgentMemory/.tmp` is created on demand, self-gitignored, and holds scratch input and saved context. Section 7's "what appears in your project" should name it so it is not mistaken for junk.
- **Starter rules appear at install.** `install-mpact.md` and `bootstrap-project.md`: install drops starter rules into the user root; they are editable defaults. Section 5 should say they exist and can be edited or deleted.
- **Taking a handoff on a closed task stops.** `take-task-handoff.md`: a handoff resolved onto a closed task has no work to pick up; the agent says so in one sentence. Worth one line under "Taking a handoff."
- **The agent names the task and purpose it resolved.** Same reference: the first line of a handoff response names the task and the purpose applied, so a wrong task is visible before the deliverable. Worth one line, because it tells the user what to check.
- **Nested projects.** Section 7 calls nesting "the one trap" and says a nested project "silently inherits the parent's memory." `memory-root-policy.md` and `startup-contract.md` describe the chain (user root, ancestor roots, nearest root) as the design, with inherited roots read-only by default. Inheritance is a feature when the child is part of the parent; it is a trap only when the child is an unrelated project that happens to live in the parent's tree. The wording should say which.
- **Session entries and refresh.** `write-session-entry.md`: refresh reads only the newest session entry, capped at 25KB, and task state wins on disagreement. The user should know that a session entry is startup orientation, not authority. One line under "Session entries."
- **Help aliases are now a checked surface.** `SKILL.md`, `docs/M-PACT_USER_GUIDE_QUICK_REFERENCE.md`, and `scripts/help.js` agree on the user-facing invocation set: `M-PACT help`, `M-PACT quick reference`, `M-PACT guide`, and `M-PACT reference guide`. The renderer also accepts `quick`, `quick-reference`, and `reference-guide` as parser conveniences, but the guide only needs to teach the four natural phrases.

## Reference by reference

| Reference | User-facing intent | Outline home | Verdict |
| --- | --- | --- | --- |
| `startup-contract.md` | What refresh does, when it runs, what the receipt is | Part 4 "Starting a session"; section 6 | Covered. Hook-triggered refresh underweighted (finding 4). |
| `refresh-memory.md` | Same, plus failure modes and saved-context edge cases | Part 4; section 14 | Failure modes missing from 14 (finding 11). Saved-context unhandled failure missing (finding 1). |
| `memory-root-policy.md` | Which memory root a request lands in; global versus project | Section 2; Part 4 Rules, Finding things | Scope words missing (finding 7). Nesting framing (finding 12). |
| `install-mpact.md` | Install, disable, enable; hooks; starter rules | Sections 5, 8 | Covered. `/hooks` step and starter rules missing (findings 4, 12). |
| `uninstall-mpact.md` | Uninstall; memory untouched | Section 8 | Covered accurately. |
| `bootstrap-project.md` | Project setup; the offer at refresh | Section 7 | Covered. `.tmp` not listed among what appears (finding 12). |
| `adopt-project-identity.md` | Adoption question on a pre-identity root | None | Missing (finding 3). |
| `repair-project-identity.md` | Identity question after rename or move | None | Missing (finding 3). |
| `context-save-restore.md` | Save context; automatic restore; stale decision | Part 4 "Saving and restoring context" | Wrong on task ownership (finding 1). Restore mechanism not tied to hooks (finding 4). |
| `create-task.md` | Create a task; bare "handoff" | Part 4 "Creating a task"; section 10 | Covered. |
| `revise-task.md` | Change title, priority, context, acceptance | Part 4 "Revising a task's definition" | Covered. |
| `set-current-task.md` | Switch current task | Part 4 "Switching the current task" | Covered; bare heading is enough. |
| `close-task.md` | Close; unfinished items recorded | Part 4 "Closing and reopening" | Consequences missing (finding 8). |
| `reopen-task.md` | Reopen; active list not restored | Part 4 "Closing and reopening" | Consequences missing (finding 8). |
| `take-task-handoff.md` | Take a handoff; mutation gate; anchored vocabulary; review-purpose ladder | Sections 9, 10; Part 4 "Taking a handoff" | Covered. Anchored forms not acknowledged in section 12 (finding 6). Closed-task stop and resolution line missing (finding 12). |
| `write-task-log.md` | Write a log or handoff; active items; item birth needs approval | Part 4 "Writing a handoff," "Writing a task log," "Designing and iterating" | Covered. Item birth approval gate is implicit in "you approve"; fine. |
| `write-design-spec.md` | Design items; revisions; `specification.md` mirror | Part 4 "Designing and iterating" | Mirror missing (finding 9). |
| `repair-task-spec-log.md` | Orphaned spec member repair; announced, not asked | None | Correctly excluded from Part 4 (nothing to ask for). The announcement is user-visible; one line in section 14 is enough. |
| `write-rule.md` | Rules; project versus global; merge over duplicate | Part 4 "Rules" | Thin. Scope and filename-as-rule missing (finding 7). |
| `write-session-entry.md` | Session entry; not a save-context substitute | Part 4 "Session entries" | Covered. Refresh-reads-newest-only missing (finding 12). |
| `write-journal-entry.md` | Journal entry; the editable exception | Part 4 "Journal entries"; section 2 | Editable exception missing (finding 5). |
| `write-case-study.md` | Case study | Part 4 "Case studies" | Covered. |
| `find-memory-artifact.md` | Look up an artifact; scope words; task list ordering | Part 4 "Finding things" | Scope words missing (finding 7). |
| `list-agent-session-paths.md` | Chat paths for this task; "where did we discuss X on this task" | None | Missing (finding 2). |
| `search-agent-sessions.md` | Recall a prior conversation at task, project, or global scope | None | Missing (finding 2). |
| `helper-write-conventions.md` | Agent procedure for delivering body text to helpers | None | Correctly excluded. `.tmp` side effect noted (finding 12). |
| `full-memory-contract.md` | Full protocol | None as a unit | Correctly excluded. Its verb grammar (`write` appends, `create` births, `revise` changes a definition, `modify` edits in place, `save` snapshots, `set` moves a pointer) is a useful skeleton for Part 3 and is not currently used there. |
| `docs/M-PACT_USER_GUIDE_QUICK_REFERENCE.md` | Shipped quick-reference block and help text source | Quick Reference; Part 4 capability list | Checked as the help reference. It now names the help aliases and still has the save-context and recall-conversation drift noted below. |
| `scripts/help.js` | Browser help renderer and accepted help aliases | Quick Reference entry point | Checked only for alias/render behavior. It renders the quick reference and full guide, opens the quick-reference page, and accepts the four natural aliases plus short/hyphenated parser variants. |
| `SKILL.md` | Dispatch; suppression; web-only limit | Sections 4, 8 | Suppression missing (finding 10). |
| `README.md` | Install targets; requirements; suppression | Sections 4, 5, 8 | Same. README's install path list (`~/.codex/skills/m-pact/` etc.) is a see-it detail section 5 could show. |

## Correctly excluded

These are in the references and should stay out of the guide, per the outline's own scope rule:

- Project ID plumbing (`--project-id`, `--cross-project`, `projectPath` in receipts). The user sees `projectPath` in a receipt; that is enough for section 6 to say "the receipt names the project so you can check it."
- Agent identity overrides (`--agent`, `MPACT_AGENT`). Source-checkout and test cases only.
- Scratch file naming, stdin versus file delivery, pruning.
- ZIP member naming, record numbering, `Agents.json` structure, `projects.json` structure.
- The review-purpose resolution ladders in `take-task-handoff.md`. The user-facing residue is "say the review kind if you care which one you get," and section 9 already says that.
- Receipt field names (`readCursor`, `orphanedSpecMembers`, `closeUnfinished`). What the user sees is the agent's one-sentence reply, which the references require to be user-level.

## Quick reference drift

Two lines in `M-PACT_USER_GUIDE_QUICK_REFERENCE.md` need to change to match the references:

- "Save context - before a compaction or an intentional restart, on the current task." Drop "on the current task."
- The "Finding things" group has one line. It needs a second: "Recall a conversation - what was actually said, not what was written down. *'When did we talk about X?' / 'Did we ever discuss Y anywhere in the project?'*"

The quick reference's note that adoption and the two repairs are "deliberately absent" remains correct for the quick reference. The guide is where they go.

No help-alias drift found: `SKILL.md`, the quick-reference text, and `scripts/help.js` all support `M-PACT help`, `M-PACT quick reference`, `M-PACT guide`, and `M-PACT reference guide`. The script also accepts `quick`, `quick-reference`, and `reference-guide`; those are implementation conveniences, not additional guide vocabulary.

## Open questions this audit touches

- `write-task-spec.js` is still referenced by zero files in `references/`. Unchanged from 2026-08-19. Not a reference-audit matter.
- The section 12 anchoring question is partly answered by the references and help surface themselves (finding 6 and finding 12). Handoff, save-context, and help now have anchored minimum phrasing. What remains open is whether operations other than those get an anchored minimum.
