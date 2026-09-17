# M-PACT Quick Reference

One line each, grouped the way you'll meet them. Read this when you already know roughly what you want and just need the reminder. The main guide has the full explanation, the disclaimers, and what to watch out for.

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
