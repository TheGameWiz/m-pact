# M-PACT User Guide - Outline

Working document. This is the plan for a rewritten user guide, not the guide itself.

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
- Agents: Codex CLI and Claude Code are validated; Antigravity support uses the local skill and hook surfaces. Do not document a runtime as validated until it has been checked recently.
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

---

## Part 3 - How to ask for things

The section that teaches the principle instead of a vocabulary. If this works, the rest is mostly self-service.

### 8. Say the verb, not just the ritual

- Every useful request carries three things: **which operation**, **how much authority**, and **what you want back**.
- Extra words are not politeness, they are scope. "Take handoff" grants read and report. "Take handoff and implement" grants change.
- If you leave the verb out you get the safe default - a read and a report - which is sometimes not what you wanted, and costs you a round trip.
- Being specific also gives the agent something precise to object to. Vagueness gets you silent compliance with the wrong thing.

### 9. "Handoff" means three different things

Same word, three durable outcomes, and the surrounding verb is what picks one.

- **Take** a handoff: read an existing task and report.
- **Write** a handoff: author a record into the task you are in.
- **Handoff** alone, or "hand this off": creates a brand new task from the conversation. This is the one that surprises people.

### 10. Your words become part of the record

- What you asked for is captured into the record and read by the next agent.
- So phrasing is not disposable. Saying what you actually mean pays twice.

### 11. Examples, framed as illustrations rather than commands

- Real, terse phrasings in use. Vary them deliberately in the text so nobody reads them as a required vocabulary.
- **Open decision: do we anchor any of these in the skill, or present all of them as natural phrasing?** Listing phrases that nothing implements would promise behavior we cannot back.

---

## Part 4 - What you can ask for

One short section each, in the order a user meets them. Every section answers the same four questions: when do I want this, what do I say, what happens, what should I watch out for.

- **Starting a session / loading memory** - what the receipt means, and why the agent should not then go rummaging.
- **Saving and restoring context** - before a compaction or restart. Belongs to the current task. What happens if no task is current.
- **Creating a task** - when work needs continuity, review, or more than one agent.
- **Switching the current task**
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

### 12. A worked example

One real task, start to finish, across two agents. Probably teaches more than any amount of prose about what a handoff is.

- Create the task from a conversation.
- Design discussion, items proposed and approved.
- Switch to the implementer: take the handoff, implement.
- Switch back: take the handoff, review the code.
- A reopened item, because that is normal and users should see it once.
- Close.

Use terse, real phrasings throughout. Show the two-tab choreography explicitly - the memory is the wire between the tabs.

### 13. When something goes wrong

- The agent did more than you wanted: changes are reviewable, records are append-only.
- The agent did less than you wanted: usually a missing verb.
- It keeps asking permission: configuration, not normal.
- A write halted: what the refusal is protecting.
- Something looks stale or wrong in a record: the fix is a new record, not an edit.

---

## Open questions

- **Where the capability list lives.** A live "what can I ask for" belongs in the agent, since the guide is not open while you work. If it is written in both places it will drift, and this project has already spent two tasks on exactly that. Decide the single source before either is written.
- **Whether any phrasings get anchored in the skill** (section 11).
- **Gemini revalidation** before section 4 claims support.
- **Whether this outline ships.** Anything in `docs/` is distributed. Move to `dev/` or delete once the guide exists.
- **Ordering of Parts 2 and 3.** Setup first is conventional; capability first makes the tool look lighter. Currently setup first.
