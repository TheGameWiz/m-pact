# M-PACT Quick Reference - current draft

Working document, validated 2026-09-13 against the current owner references. This is the capability list: a marked section of the shipped guide, extractable by delimiters, that `M-PACT help` and `M-PACT quick reference` render and open on demand instead of the agent re-reading the whole guide. It is not a second document. The text between the markers below is the guide's Quick Reference section, and the same text is what `M-PACT help` renders. One file, two consumers.

Audience filter, unchanged: user-invoked capabilities are listed, with short user-visible reminders for startup and restore. Things the system asks *you* (project adoption, the identity repair question, the orphaned-spec repair announcement) and states you do not set (suppression) are deliberately absent; the guide covers them in sections 7, 8, and 14. Pure lookup plumbing is folded into two lines under "Finding things" rather than listed per script.

Phrasing convention: where the skill anchors a guaranteed minimum (help, handoff, and save-context), the anchored form is shown in **bold italics** and is reliable as written. Every other *"say something like"* phrasing is one wording among many that works, deliberately varied so nobody reads it as a required vocabulary. The guide promises no anchored forms for other operations; if the skill ever adds some, this is the file that swaps them in.

---

<!-- BEGIN QUICK REFERENCE -->

## Quick Reference

One line each, grouped the way you'll meet them. Read this when you already know roughly what you want and just need the reminder. The main guide has the full explanation, the disclaimers, and what to watch out for. Say ***"M-PACT help"***, ***"M-PACT quick reference"***, ***"M-PACT guide"***, or ***"M-PACT reference guide"*** to have an agent open this list in your browser; the page links to the full guide.

### Getting set up

- **Install** - once per agent (Codex CLI, Claude Code, or Antigravity). *"Install M-PACT for Claude Code."* Ties M-PACT into that agent so it loads memory automatically. Writes only to that agent's user-level instructions file, between marked lines; never touches a project. Codex will also ask you to trust the startup hook through `/hooks`; that is the one manual step.
- **Set up a project** - once per project. *"Set up M-PACT here,"* or just accept the offer the first time you refresh in an unregistered folder. Creates the project's memory folder.
- **Disable** - stop automatic startup refresh for one agent, without removing anything. *"Disable M-PACT for Codex."* The skill stays invocable by name; it just stops running itself.
- **Enable** - undo a disable. *"Turn M-PACT back on for Codex."*
- **Uninstall** - remove the installed skill and that agent's integration entirely. *"Uninstall M-PACT from Claude Code."* Never touches memory. Your records stay where they are, as plain-text zip files, openable without M-PACT; deleting them is a separate, manual step, and the one thing reinstalling cannot undo.

### Every session

- **Start a session** - happens on its own, at startup and again after a clear or a compaction; you don't ask for this. Look for the receipt at the top of the reply.
- **Save context** - before a compaction, a clear, or an intentional restart. ***"Save context."*** / ***"Save my context before we compact."*** Belongs to this agent, not to a task; you don't need a current task to save. Saving again replaces the last one.
- **Restore context** - also automatic, on your next refresh, including the refresh that runs after an automatic compaction. You're only asked to choose if the saved context has gone stale; the agent will stop and ask you to restore or discard it by name. ***"Restore context"*** works if you want to say it anyway.

### Tasks

- **Create a task** - when work needs to survive a closed tab, get reviewed, or involve more than one agent. *"Make this a task."* / *"Create a task from this conversation."* A standalone handoff phrase naming no existing task, such as ***"Handoff."*** or ***"Handoff to Claude."***, asks before creating one; see "Working inside a task" below for the other meanings.
- **Switch the current task** - *"Switch to t0012."* / *"Make t0012 current."* The pointer is shared by every window; moving it here moves it for the other agent too.
- **Revise a task's definition** - title, priority, source, context, or acceptance changed after the fact. *"Revise this task; acceptance now includes X."*
- **Close a task** - *"Close this task."* Anything still open gets recorded, and the reply says so.
- **Reopen a task** - normal, not an admission anything failed. *"Reopen t0012."* Leftover items are surfaced, not reactivated; the first log after reopen says what's active again.

### Working inside a task

- **Take a handoff** - read an existing task and report; on its own this authorizes nothing beyond that. ***"Take Handoff, Discuss."*** / ***"Take Handoff, Design Review."*** / ***"Take Handoff, Implement."*** Say what you want back or you get a read-only report by default. The agent's first line names the task and purpose it resolved; check it. With two windows on two tasks, name the task: *"Take the handoff for t0045."* A bare take resolves through the shared pointer, which the other window may have moved.
- **Write a handoff** - record something into the task you're in, for the next agent. ***"Handoff, Design Review."*** asks for a review; ***"Handoff, Review Results."*** returns one. ***"Handoff, Discuss."*** asks the next agent to discuss rather than mutate. `Write`, `Save`, `Create`, or `Store` in front is optional. Full grid at the bottom.
- **Write a task log** - a checkpoint that isn't a handoff. *"Log this."* / *"Write a task log checkpoint."*
- **Add to the design** - the brainstorm-and-design rhythm: you talk, the agent proposes items, you approve, they get numbered. *"Add that to the design."* / *"Add a design item for X."* / *"Revise item 3."* Each is a log entry; that is where items are born. Adding an item is the one ask an agent must get a yes to; silence means no item.
- **Write the design spec** - gathers every item, done and active, into one place with a narrative. *"Write the design spec."* / *"Fold the review results into the spec."* Optional; a task runs fine on the item list alone.
- **Edit the specification narrative by hand** - the task folder holds a plaintext copy of the current narrative. Edit it, then: *"Fold in my edits to the specification."* This is the one memory file meant to be hand-edited.

### Memory beyond tasks

- **Write a rule** - a durable instruction that shapes future behavior. *"Add a rule: always do X."* Goes in the project unless you say *"global rule"* or *"user-level rule."*
- **Write a session entry** - a project-wide snapshot or note, not tied to one task. *"Write a session entry for this decision."* Not a way to save context; use save context for that.
- **Write a journal entry** - a reflective note worth keeping that isn't a rule or a task record. *"Write a journal entry about X."* The one record you can later ask to have edited: *"Modify that journal entry."*
- **Write a case study** - a success, failure, or lesson worth carrying forward. *"Write a case study on X."*

### Finding things

- **Look something up** - just ask the question; the agent picks the lookup. *"What did we decide about X?"* / *"Find the task where we discussed Y."* / *"List the rules."* Unscoped means this project. Say *global* for your user-level memory, *parent* for the project above, *all* or *layered* for the whole chain.
- **Recall a conversation** - what was actually said, not what was written down; searches the raw chat transcripts. *"When did we talk about X?"* / *"Did we ever discuss Y anywhere in the project?"* / *"Every time we changed Z."* Say the scope (this task, this project, every project) and the agent won't ask. "When did we" stops at the first match; "every time we" sweeps everything.

### The handoff grid

Pick one from the first column and one from the second. `<Kind>` is `Design` or `Implementation`. The verb carries direction; `Results` turns a review request into review-result delivery or evaluation. Do not mix the blocks: `Take/Get Handoff, Request <Kind> Review` is not a guaranteed form.

**Giving** (writing a record for the next agent)

| Say | Then | What happens |
| --- | --- | --- |
| ***Handoff*** / ***Write handoff*** / ***Save handoff*** / ***Create handoff*** / ***Store handoff*** | ***Request <Kind> Review*** / ***<Kind> Review*** / ***for <Kind> Review*** | A record asking the next agent to review the design or built work |
| | ***<Kind> Review Results*** / ***Review Results*** | A record returning review results |
| | ***Request Review*** | A record asking for a review; the kind resolves from current work or the agent asks |
| | ***Implement*** / ***Implement Fixes*** | A record asking the next agent to implement active approved items or fixes |
| | ***Discuss*** | A record asking the next agent to discuss only |
| ***Handoff*** alone / ***Hand this off*** / ***Handoff to <agent>***, naming no existing task | | Asks whether to create a new task from this conversation |

**Taking** (reading an existing task and acting on it)

| Say | Then | What happens |
| --- | --- | --- |
| ***Take handoff*** / ***Receive handoff*** / ***Get handoff*** | ***Review <Kind>*** / ***<Kind> Review*** / ***for <Kind> Review*** | You review the design or built work and report |
| | ***<Kind> Review Results*** / ***Review Results*** / ***Evaluate Review*** | You evaluate returned review results |
| | ***Review*** | You perform or evaluate the review named by the handoff, or the agent asks |
| | ***Implement*** / ***Implement Fixes*** | You implement active approved items or fixes |
| | ***Fold in Results*** | You fold review findings into design/spec/log state; no code |
| | ***Discuss*** | You discuss with the Director; no durable mutation |
| | (nothing) | Read and report; you are told what it was and asked nothing more |

Taking never authorizes a change by itself; the added action bounds what can change. `Discuss` changes nothing durable, `Fold in Results` changes only design/spec/log state, and `Implement` or `Implement Fixes` is the code/reference-work path. A chain such as *"Take Handoff, Evaluate Review, Fold in Results, Write Handoff"* runs every step in order and writes a record only because it ends on a giving phrase.

The full user guide is at `docs/USER_GUIDE.md`.

<!-- END QUICK REFERENCE -->

---

## Notes for review

- Current validation pass (2026-09-13): the handoff rows now match `references/take-task-handoff.md`; standalone handoff creation matches `references/create-task.md`; stale notes about unanchored `Implement Fixes` and `Fold in Results` were removed.
- The guide path on the last line names `docs/USER_GUIDE.md`, the installed skill's guide file, per t0043's design specification (record 4). `M-PACT help`, `M-PACT quick reference`, `M-PACT guide`, and `M-PACT reference guide` render this block and the full guide to two linked HTML files and open the quick-reference one. There is no print mode, so this plain path exists only for a reader who cannot follow the rendered page's own link to the full guide.
- The grid's third-column wording is a draft. Its purpose is that a reader can scan across without assembling the grammar from prose; if a cell needs a second sentence to be understood, the cell is wrong.
- `Implement Fixes`, `Fold in Results`, and `Discuss` are anchored handoff forms. `Implement Fixes` is accepted phrasing for implementation in a fix-shaped context; `Fold in Results` is design/spec/log only; `Discuss` is no-mutation discussion.
- Deliberately excluded, unchanged: `write-task-spec.js` (`[0003-decide-the-fate-of-write-task-spec]` still open); adoption; identity repair; orphaned-spec repair; suppression.
- Placement, per the spec: early in the guide, after the mental model (Part 1, section 2), before the rest of Part 1 continues into the agent disclaimer.
- Bold-italic anchored forms are the phrasings here that a reference guarantees. Plain italic examples are user-facing examples, not a promise of a new anchored vocabulary surface.
