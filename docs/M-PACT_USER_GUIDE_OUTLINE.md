# M-PACT User Guide - Outline

Working document. This is the plan for a rewritten user guide, not the guide itself.

**Revised 2026-08-19**, against a fresh audit of the current codebase (all 28 scripts in `scripts/`, all 25 files in `references/`, `SKILL.md`, `README.md`) run against the 2026-08-07 design discussion this outline was originally drafted from. See "What changed this pass" at the end. Most of the outline held up; a few things needed adding, and one thing needed an outright correction rather than an addition.

## Voice and scope

The reader's interface is a sentence, not a command line. Nobody using M-PACT types a script name; they tell an agent what they want. So this guide is organized around intents - what you say, what happens, what you get back - and not around helpers, flags, or files.

Out of scope, deliberately: helper script names and their flags, ZIP container internals, record numbering, member naming, sentinel files, lock behavior, refresh audit markers, project ID plumbing. The technical contract already has a home in `references/` and `full-memory-contract.md`. The guide is freed to be about use because the deep truth is documented elsewhere.

The test for including a machine detail is not whether it is internal. It is whether the reader must **see, decide, or answer** it. A few pass that test and stay: the receipt after a refresh, the approval prompts before durable writes, the adoption question for an unregistered project, and the folder that appears in the project.

Examples must be platform-neutral, or shown for both shells. The current guide has PowerShell-only examples, which makes it quietly Windows-only even though the software is not.

---

## Part 1 - Overview

### 1. What this is and who it's for

- One paragraph: agents forget; M-PACT is shared memory they read and write, so work survives a closed tab and moves between agents.
- Who benefits: anyone running more than one agent, or one agent across more than one sitting.
- What it is not: not a chat archive, not a wiki, not automatic. Nothing is written unless asked.

### 2. The mental model

Six to eight short paragraphs. This is the section that makes everything else make sense.

- Memory is shared across your agents, not per-chat.
- Two levels: what follows you everywhere, and what belongs to one project.
- Tasks are the unit of work. A task carries a definition, a design specification, and a log.
- The log is chronological events. The specification is the durable statement of what was decided and why. Users routinely confuse these; say it plainly here.
- Startup loads a snapshot, not the whole archive. The rest is fetched on demand.
- Writes are append-only. A wrong record is corrected by a later record, never erased.

### 3. What to expect from agents

The honest disclaimer. Not a shrug - a placement of trust.

- Instructions to agents are not guarantees and are not consistent. The same sentence lands differently on different agents, and on the same agent on different days.
- What is reliable: the machinery. Numbering, naming, timestamps, validation, refusals, the receipts. That is code and behaves identically every time.
- What varies: judgment. Whether it wrote at all, whether it took the handoff you meant, what it put in the body, whether it stopped where you wanted, whether it read what it says it read.
- Therefore: trust the receipts, verify the judgment.
- Practical consequences: say what you mean specifically; read what the agent claims it did; a wrong record is corrected by the next one; reopening an item is normal, not a failure.
- A workflow tuned to one agent may not transfer to another. Expect to develop your own.
- The bargain: you get work you could not otherwise get, and the verification burden does not disappear - it moves from doing to checking.

### 4. Platforms and agents

- Built to be portable: no hardcoded paths, no shell-specific commands, POSIX as the default with Windows special-cased.
- Developed and exercised on Windows. Not yet run on macOS or Linux. Treat as untested rather than unsupported, and say what to report if you are first.
- Agents, settled: **Codex CLI and Claude Code are validated. Antigravity is first-class** - same skill shape, plus its own install hook, no lingering caveat. **Copilot CLI may work through the same shims but is not yet validated as a first-class runtime** - present it as best-effort, not supported. **Gemini CLI is retired.** M-PACT no longer ships a Gemini CLI extension; no version of this guide should list it as a target. (This closes what was an open question in the 2026-08-07 draft - see "What changed this pass.")
- Requires Node.js 18 or newer and an agent with shell and filesystem access. Web-only clients cannot reach local memory.

---

## Part 2 - Getting set up

Two separate things, often confused.

### 5. Installing M-PACT (once per agent)

- What installing does and does not do.
- Repeat per agent you want to use.
- Keep this short. Setup should not make the tool look heavy.

### 6. What the first run will ask for

- Expect a prompt for access to your user memory root and a temporary folder. Both are needed and both are outside your project.
- Approve once; it should not ask again.
- **If it keeps asking, something is misconfigured** - that is the signal, and a user who was not told to expect one prompt has no way to know that ten is wrong.
- Per agent: what to allow so it stops interrupting you. This is the difference between the tool feeling smooth and feeling broken.

### 7. Setting up a project

- Distinct from installing. Installing configures the agent; this registers a project.
- Two ways: let startup notice and offer, or ask directly.
- What appears in your project, and why it looks nearly empty at first.
- The one trap: do not nest a new project inside an existing one, or it silently inherits the parent's memory.

### 8. Turning it off, back on, or removing it entirely — new section, added this pass

Three different operations. The guide has to keep them distinct, because "turn it off" is ambiguous and each of these means something different.

- **Disable**: silences the automatic startup refresh for one provider. The skill stays installed and you can still invoke it by name - it just stops running itself at the start of every session.
- **Enable**: restores automatic startup refresh after a disable.
- **Uninstall**: the actual off-ramp. Removes the installed skill copy and that provider's shim and hook entries entirely - M-PACT stops existing for that provider until reinstalled. It works even if the provider session is currently suppressed, and it refuses to run from inside a directory it would delete.
- The one fact every version of this needs to state plainly, because it's the thing a nervous user is really asking: **none of the three ever touch memory.** Uninstalling removes the tool, not your project history or your user-root memory. Deleting memory is a separate, deliberate, manual step this section should name but not walk through.
- Each of the three targets one or more providers independently - disabling Claude Code doesn't disable Codex.

---

## Part 3 - How to ask for things

The section that teaches the principle instead of a vocabulary. If this works, the rest is mostly self-service.

### 9. Say the verb, not just the ritual

- Every useful request carries three things: **which operation**, **how much authority**, and **what you want back**.
- Extra words are not politeness, they are scope. "Take handoff" grants read and report. "Take handoff and implement" grants change.
- If you leave the verb out you get the safe default - a read and a report - which is sometimes not what you wanted, and costs you a round trip.
- Being specific also gives the agent something precise to object to. Vagueness gets you silent compliance with the wrong thing.

### 10. "Handoff" means three different things

Same word, three durable outcomes, and the surrounding verb is what picks one.

- **Take** a handoff: read an existing task and report.
- **Write** a handoff: author a record into the task you are in.
- **Handoff** alone, or "hand this off": creates a brand new task from the conversation. This is the one that surprises people.
- Taking a handoff is never itself permission to change anything - not code, not the task, not the log. Reading and reporting is the whole grant. If you want more than that, say so in the same breath: "take handoff and implement," not "take handoff" and a follow-up.
- A chained instruction runs every step in order, but has to end on a giving phrase to actually write a record. A chain that ends mid-action does the work and writes nothing down.

### 11. Your words become part of the record

- What you asked for is captured into the record and read by the next agent.
- So phrasing is not disposable. Saying what you actually mean pays twice.

### 12. Examples, framed as illustrations rather than commands

- Real, terse phrasings in use. Vary them deliberately in the text so nobody reads them as a required vocabulary.
- **Open decision: do we anchor any of these in the skill, or present all of them as natural phrasing?** Listing phrases that nothing implements would promise behavior we cannot back.

---

## Part 4 - What you can ask for

One short section each, in the order a user meets them. Every section answers the same four questions: when do I want this, what do I say, what happens, what should I watch out for.

- **Starting a session / loading memory** - what the receipt means, and why the agent should not then go rummaging.
- **Saving and restoring context** - saving is something you ask for, before a compaction or restart. Restoring is not something you ask for at all: it happens automatically on your next refresh - unless the saved context has gone stale, in which case the agent stops and asks you to explicitly choose restore or discard. Belongs to the current task. What happens if no task is current. *(Corrected this pass - restore was written as symmetric to save; it isn't.)*
- **Creating a task** - when work needs continuity, review, or more than one agent.
- **Switching the current task**
- **Revising a task's definition** - added this pass. Title, priority, source, context, or acceptance criteria change after work has already started. Distinct from the item below: this is the task record itself, not the plan inside it.
- **Designing and iterating** - the brainstorm and design stage. Teach the *rhythm*, not the mechanism: you talk, the agent proposes items, you approve, items get numbered, the implementer clears them, reopening is normal. Users stumble here today and stumbling produces bad records, not just frustration.
  - Items are permanent once written, and the wording hardens later than you would guess.
- **Taking a handoff**
- **Writing a handoff**
- **Writing a task log**
- **Closing and reopening a task**
- **Rules** - durable instructions that shape future behavior.
- **Session entries** - project snapshots and notes. Explicitly *not* a way to save context; that is what save-context is for.
- **Journal entries** - notes you want kept but that are not rules, tasks, or case studies.
- **Case studies** - successes, failures, and lessons worth carrying forward.
- **Finding things** - looking up a specific artifact or searching bodies.

---

## Part 5 - Putting it together

### 13. A worked example

One real task, start to finish, across two agents. Probably teaches more than any amount of prose about what a handoff is. (Two agents here for clarity, not because two is a limit - nothing stops a third from joining the same task; see section 14.)

- Create the task from a conversation.
- Design discussion, items proposed and approved.
- Switch to the implementer: take the handoff, implement.
- Switch back: take the handoff, review the code.
- A reopened item, because that is normal and users should see it once.
- Close.

Use terse, real phrasings throughout. Show the two-tab choreography explicitly - the memory is the wire between the tabs.

### 14. When something goes wrong

- The agent did more than you wanted: changes are reviewable, records are append-only.
- The agent did less than you wanted: usually a missing verb.
- It keeps asking permission: configuration, not normal.
- A write halted: what the refusal is protecting.
- Something looks stale or wrong in a record: the fix is a new record, not an edit.
- **Two agents wrote to the same task at the same time** - added this pass. The second write is refused, not silently lost or corrupted; re-read and retry. There is no fixed limit on how many agents can work one task at once - the refusal itself is the safety net, not a seat count.

---

## Open questions

- **Where the capability list lives.** A live "what can I ask for" belongs in the agent, since the guide is not open while you work. If it is written in both places it will drift, and this project has already spent two tasks on exactly that. Decide the single source before either is written. *(Confirmed still unimplemented as of the 2026-08-19 audit - no helper currently prints one; the closest thing is `SKILL.md`'s static Dispatch table, which is a document section, not agent-invocable output.)*
- **Whether any phrasings get anchored in the skill** (section 12).
- **Whether `write-task-spec.js` is deleted or documented.** Confirmed still an unresolved tombstone as of this pass - present in `scripts/`, referenced by zero files in `references/` or `SKILL.md`, redirects callers to `write-design-spec` and exits. Doesn't block writing the guide (it's not user-facing either way) but should be decided before the guide ships, since documenting a name that's slated for deletion is wasted work.
- **Whether this outline ships.** Anything in `docs/` is distributed. Move to `dev/` or delete once the guide exists.
- **Ordering of Parts 2 and 3.** Setup first is conventional; capability first makes the tool look lighter. Currently setup first.

---

## What changed this pass (2026-08-19 audit)

A full read of `scripts/` (28 files) and `references/` (25 files) plus `SKILL.md` and `README.md`, diffed against this outline and the 2026-08-07 design discussion it came from.

**Correction, not addition** - the 2026-08-07 discussion recorded "a task supports two agents, named by its two role seats," as a documented-but-unenforced limit. That is no longer accurate: role seats are retired descriptive metadata, and no helper gates writes on them. What actually happens when two agents work one task at once is an optimistic-concurrency refusal - the second writer is bounced and re-reads - which is a stronger and simpler thing to teach than a seat count. Reflected in section 13's aside and the new bullet in section 14. This same correction applies to `USER_GUIDE_FUNCTIONS.md` category K (concurrency) and should be carried there too.

**Added** - the disable/enable/uninstall lifecycle (`install-mpact.js --disable`/`--enable`, `uninstall-mpact.js`) did not exist in the codebase this outline was drafted against. New section 8. `USER_GUIDE_FUNCTIONS.md` section A already lists `uninstall-mpact.js`, so the functional inventory was ahead of this outline on that point.

**Added** - revising a task's own definition (`revise-task.js`: title/priority/source/context/acceptance) had no slot in Part 4; only revising the design specification did. New bullet, kept distinct from the design-spec item since they're different containers.

**Resolved, not just corrected** - the "Gemini revalidation" open question from the 2026-08-07 draft is closed by the codebase itself: Gemini CLI is confirmed retired (README states it outright), Antigravity replaced it as a first-class target, and Copilot CLI is documented as best-effort/unvalidated. Section 4 now states this as settled rather than pending.

**Confirmed unchanged** - the quick-reference-as-on-demand-helper-output idea is still purely a plan; nothing in the current codebase implements it. The voice/scope framing, the disclaimer in section 3, the handoff-verb grammar in section 10 (apart from the added mutation-gate bullet), and the overall five-part structure all held up against the current code without needing correction.
