# M-PACT Functional Inventory

Working document, paired with `USER_GUIDE_OUTLINE.md`. This enumerates every distinct capability in the skill and identifies what implements it. Descriptions of how, what, and why come next; this pass establishes the complete list so nothing is missed.

Counts: 25 references, 27 scripts. Most pair one-to-one. The exceptions are listed at the end and several are worth a decision.

**Audience** is the column that matters for the guide. Only `user` entries need a section. `answer` entries are things the user responds to rather than requests. `internal` entries happen on the user's behalf. `recovery` and `plumbing` entries should probably not appear in a user guide at all.

---

## A. Getting started

| Function | Reference | Script | Audience |
|---|---|---|---|
| Install M-PACT for an agent | `install-mpact.md` | `install-mpact.js` | user |
| Uninstall M-PACT for providers | `uninstall-mpact.md` | `uninstall-mpact.js` | user |
| Set up a project | `bootstrap-project.md` | `bootstrap-project.js` | user |
| Register an existing project | `adopt-project-identity.md` | `adopt-project-identity.js` | answer |
| Where memory lives and which root a write goes to | `memory-root-policy.md` | (policy only) | internal |

Notes. Install and project setup are genuinely separate operations and users conflate them. Adoption is not something a user requests; it is a question the agent asks when a project folder exists without registration, and the user answers yes or no.

## B. Every session

| Function | Reference | Script | Audience |
|---|---|---|---|
| Load memory at startup | `refresh-memory.md` | `build-refresh-bundle.js` | user |
| Save context before a compaction or restart | `context-save-restore.md` | `save-context.js` | user or project |
| Restore context afterward | `context-save-restore.md` | (a normal refresh) | user |
| When refresh should and should not run | `startup-contract.md` | (policy only) | internal |

Notes. Save and restore are asymmetric and this confuses people: saving is an explicit request, restoring is just starting normally. Context save has no script of its own; it is a mode of the task log. Worth hiding that fact in the guide, since the user only needs the intent.

## C. Tasks

| Function | Reference | Script | Audience |
|---|---|---|---|
| Create a task | `create-task.md` | `create-task.js` | user |
| Revise a task definition | `revise-task.md` | `revise-task.js` | user |
| Coordinate task review | `take-task-handoff.md` | `prepare-handoff.js` | answer |
| Switch the current task | `set-current-task.md` | `set-current-task.js` | user |
| Close a task | `close-task.md` | `close-task.js` | user |
| Reopen a task | `reopen-task.md` | `reopen-task.js` | user |

Notes. Reopening deserves emphasis in the guide as a normal move rather than an admission of failure.

## D. Working inside a task

| Function | Reference | Script | Audience |
|---|---|---|---|
| Take a handoff | `take-task-handoff.md` | `prepare-handoff.js` | user |
| Write a task log record | `write-task-log.md` | `write-task-log.js` | user |
| Write or update a design specification | `write-design-spec.md` | `write-design-spec.js` | user |
| Read an assembled design specification | `find-memory-artifact.md` | `read-design-spec.js` | internal |
| Conventions for how bodies get passed to helpers | `helper-write-conventions.md` | (policy only) | internal |

Notes. "Write a handoff" is not a separate function; it is a task log record whose purpose is a handoff. The guide should say so, because users reasonably assume it is its own thing. Design specifications and their numbered items are the area users stumble in most.

## E. Memory beyond tasks

| Function | Reference | Script | Audience |
|---|---|---|---|
| Write or update a rule | `write-rule.md` | `write-rule.js` | user |
| Write a session entry | `write-session-entry.md` | `write-session-entry.js` | user |
| Write a journal entry | `write-journal-entry.md` | `write-journal-entry.js` | user |
| Write a case study | `write-case-study.md` | `write-case-study.js` | user |

Notes. These four overlap in the user's mind and the guide has to draw the lines: a rule changes future behavior, a case study records a lesson, a journal entry is a note worth keeping, a session entry is a point-in-time project snapshot. Session entries especially need their boundary drawn, because they were used as a context-save mechanism before saved-context files existed.

## F. Finding things

One reference covers five scripts.

| Function | Reference | Script | Audience |
|---|---|---|---|
| List what is in a container | `find-memory-artifact.md` | `list-members.js` | internal |
| Read one specific record or item | `find-memory-artifact.md` | `read-member.js` | internal |
| Read a range of records | `find-memory-artifact.md` | `read-member-span.js` | internal |
| Search inside bodies | `find-memory-artifact.md` | `search-bodies.js` | internal |
| Assemble a design specification | `find-memory-artifact.md` | `read-design-spec.js` | internal |

Notes. Users do not invoke these; they ask a question and the agent chooses. The guide needs one section on *asking for a lookup* rather than five sections on the mechanisms.

## G. Recovery

| Function | Reference | Script | Audience |
|---|---|---|---|
| Repair project identity | `repair-project-identity.md` | `repair-project-identity.js` | recovery |
| Repair a missing paired specification log | `repair-task-spec-log.md` | `repair-task-spec-log.js` | recovery |

Notes. Both are announced by the system rather than requested. The guide should mention that repairs exist and are announced, without documenting the procedures.

## H. Reference documents with no script

- `startup-contract.md` - the compact contract loaded at startup.
- `full-memory-contract.md` - the complete operating protocol.
- `memory-root-policy.md` - which root a write belongs to.
- `helper-write-conventions.md` - how bodies reach helpers.

These are the agent's rulebook. They are the reason the user guide can stay non-technical: the deep truth is documented, just not here.

## I. Scripts with no reference

Each of these is a decision, not just a gap.

- `antigravity-refresh-hook.js` - Antigravity `PreInvocation` wrapper that runs refresh through `build-refresh-bundle.js --hook` and injects the bundle as transient context. Provider-specific plumbing, configured by runtime setup rather than invoked by users.
- `write-task-spec.js` - retired. Redirects callers at runtime and is referenced by nothing. **Candidate for deletion rather than documentation.**
- `modify-journal-entry.js` - controlled journal-entry modification helper. It is the documented exception to the ordinary append-only correction model and should be used only when the Director explicitly asks to modify an existing journal entry.

---

## J. Accepted phrasings and aliases

Only one operation carries a formal alias list. `context-save-restore.md` names six - save context, save my context, save state before compaction, restore context, restore my context, resume from saved context - and states that `save-context` is the canonical term while the rest are invocation aliases only.

Everything else relies on prose. `take-task-handoff.md` distinguishes "take handoff" from a bare "handoff," "hand this off," and "handoff to <agent>," and `create-task.md` adds "make this a task," but neither presents a list.

So coverage is inconsistent: one operation is formally specified, the rest are described in passing. That is not necessarily wrong, since the guide teaches the principle rather than a vocabulary. But it does mean the guide cannot claim a phrase is *supported* unless it appears in one of those places. Anything else is natural language that happens to work.

## K. Failure and recovery surface

Seven categories, and each needs a different answer from the user. This is the raw material for a recovery section.

**1. Questions the system asks you.** Project setup required, project adoption required. Nothing is wrong; answer yes or no. These are the only halts that are part of normal operation.

**2. Refusals meaning the request was wrong.** Saving context with no current task, writing to a closed task, a missing or mismatched project ID, an unrecognized flag, a help probe. The agent adjusts and the user usually never sees them.

**3. Refusals protecting item accounting.** An omitted active-item section, an item dropped without being cleared, or clearing something that was not open. The helper now owns derives-from bookkeeping, so stale typed predecessor values are normalized rather than refused.

**4. Concurrency.** A busy ZIP lock, a stale lock that could not be removed, and a task folder renamed while a write was in flight. The last one names the remedy in its own message - re-resolve and retry - so it is self-healing. A stale lock that cannot be removed has no documented procedure.

**5. Structural drift the system reports rather than fixes.** Orphaned specification companions, which have a repair helper. Duplicate record numbers reported as collision groups. A stale or ambiguous current-task pointer. An active task folder with no `task.md`. A mixed legacy and new-format specification container, which makes close-time absorption skip rather than fail. Some have a repair path; some need a decision.

**6. Container corruption.** CRC mismatch, uncompressed size mismatch, local header mismatch, unsupported Zip64. Detected precisely and reported clearly, with **no documented recovery at all**.

**7. Environment.** A suppressed session, a refresh audit failure, and malformed shim markers - which a user can cause by hand-editing their own `CLAUDE.md`, `AGENTS.md`, or provider-global `GEMINI.md` backstop shim. That is the most likely user-caused break in the whole list.

### What this means for the guide

Categories 2 and 3 should not appear in a user guide at all; they are the machine keeping itself honest. Category 1 belongs in setup as "questions you will be asked." Categories 4 through 7 are the actual recovery section, and only some of them currently have an answer to give.

## L. Project identity, moving a project, and concurrency

### What project IDs actually buy

Each project root carries a sentinel whose *contents* are its ID and whose *filename* encodes the project's path. The user root holds a counter. Durable project writes carry the ID, so a write cannot land in the wrong project by accident even when paths look alike.

Moving, renaming, or copying a project makes the filename stop matching the path. That is the path-mismatch state: refresh reports it and durable writes halt until it is repaired. **Repair mints a new ID for that root rather than preserving the old one.**

So a copy never ends up sharing an ID with its original. The root whose path still matches keeps its number; the relocated one is re-minted on repair. A plain move behaves the same way - the folder keeps all of its memory and the project's ID number changes.

Sentinels are never hand-edited.

The honest promise for the guide is therefore: **your memory travels with the folder and nothing is lost.** The ID is a verification device, not a link. Records live inside the project, so they move with it; the number changing is bookkeeping, and the only visible consequence is that the ID an agent quotes afterward is a different one.

### Concurrency

Supported by design. `SKILL.md` states that agents share the same durable project memory "whether they run one at a time or side by side."

No reference states a concurrency *policy*. Safety comes from mechanism instead:

- ZIP appends take a container-level lock, so two writers cannot corrupt a container.
- Task-folder renames nest the parent lock then the task lock, so a rename cannot occur underneath a task-local writer.
- Record numbers are assigned by the helper at write time, so two writers cannot collide on a number.
- Active-item accounting requires `derives from` to name the current newest record. If another agent wrote while you were composing, your write is **refused** rather than silently overwriting.

That last one is optimistic concurrency control, and it is the behavior a user will actually meet. Two agents working the same task do not corrupt anything; the second writer is refused and has to re-read. That was observed live on 2026-08-06 with two agents on t0025.

**The one genuinely single piece of state is the `current__` pointer.** There is one per project. Two agents working different tasks in the same project will fight over it, because setting the current task changes it for everyone. That is the closest thing to a real concurrency limit, and it is documented nowhere.

## Open items from this pass

- `modify-journal-entry.js` is a controlled journal-entry modification helper and the exception should be explained rather than removed.
- `write-task-spec.js` is a tombstone that survives only to redirect. Deleting it would shrink the surface by one and remove a name that no longer means anything.
- Antigravity's hook wrapper is provider-specific plumbing and should stay mostly invisible outside install/setup references.
- Four capabilities are things the user *answers* rather than *asks for*: project adoption, and the two repairs, plus the setup question at first refresh. The guide should probably group these as "questions the system will ask you" rather than scattering them.
