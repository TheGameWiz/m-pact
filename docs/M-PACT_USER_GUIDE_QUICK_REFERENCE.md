# M-PACT Quick Reference - first draft

Working document, first draft, 2026-08-19. This is the capability list described in the design specification's "The quick reference" section: a marked section of the shipped guide, extractable by delimiters, that a helper prints on demand instead of the agent re-reading the whole guide. It is not meant to be a second document - once the guide exists, the text between the markers below becomes that guide's Quick Reference section, verbatim or close to it.

**Two open items on this task bear on this draft directly:**

- `[0002-decide-whether-phrasings-are-anchored]` is still undecided. Until it's resolved, every *"say something like"* line below is one illustrative phrasing among many that happen to work - not a command a helper checks for. Wording is deliberately varied entry to entry so it doesn't read as a required vocabulary. If phrasings do get anchored later, this is the file that will need the anchored ones swapped in.
- `[0001-revalidate-gemini-before-claiming-support]` - this draft assumes Gemini CLI is not a target, per the 2026-08-19 audit finding recorded in `USER_GUIDE_OUTLINE.md`. Flagged there for your confirmation; not re-litigated here.

Audience filter applied, per `USER_GUIDE_FUNCTIONS.md`: only capabilities a user actually asks for are listed. Things the system asks *you* (project adoption, the two repairs) are deliberately absent - you don't request those. Pure lookup plumbing (the five internal search/read scripts) is folded into one "look something up" line rather than listed separately.

---

<!-- BEGIN QUICK REFERENCE -->

## Quick Reference

One line each, grouped the way you'll meet them. Read this when you already know roughly what you want and just need the reminder - the main guide has the full explanation, the disclaimers, and what to watch out for.

### Getting set up

- **Install** - once per agent (Codex CLI, Claude Code, or Antigravity). *"Install M-PACT for Claude Code."* Configures that agent to load memory automatically; doesn't touch any project.
- **Set up a project** - once per project. *"Set up M-PACT here,"* or just accept the offer the first time you refresh in an unregistered folder. Creates the project's memory folder.
- **Disable** - stop automatic startup refresh for one agent, without removing anything. *"Disable M-PACT for Codex."* The skill stays invocable by name; it just stops running itself.
- **Enable** - undo a disable. *"Turn M-PACT back on for Codex."*
- **Uninstall** - remove the installed skill and that agent's integration entirely. *"Uninstall M-PACT from Claude Code."* Never touches memory - your projects and your user-root memory are untouched either way; that's a separate, manual step if you ever want it.

### Every session

- **Start a session** - happens on its own; you don't ask for this. Look for the receipt at the top of the reply.
- **Save context** - before a compaction or an intentional restart, on the current task. *"Save context." / "Save my context before we compact."*
- **Restore context** - also automatic, on your next refresh. You're only asked to choose if the saved context has gone stale - the agent will stop and ask you directly when that happens.

### Tasks

- **Create a task** - when work needs to survive a closed tab, get reviewed, or involve more than one agent. *"Make this a task." / "Handoff."* (A bare "handoff" naming no existing task creates a new one - see "Working inside a task" below for the other two meanings.)
- **Switch the current task** - *"Switch to t0012." / "Make t0012 current."*
- **Revise a task's definition** - title, priority, context, or acceptance changed after the fact. *"Revise this task - acceptance now includes X."*
- **Close a task** - *"Close this task."*
- **Reopen a task** - normal, not an admission anything failed. *"Reopen t0012."*

### Working inside a task

- **Take a handoff** - read an existing task and report; on its own this authorizes nothing beyond that. *"Take handoff, review." / "Take handoff and implement."* Say what you want back or you get a read-only report by default.
- **Write a handoff** - record something into the task you're in, for the next agent. *"Write a handoff." / "Handoff to Codex - ready for implementation."*
- **Write a task log** - a checkpoint that isn't a handoff. *"Log this."*
- **Propose or revise a design item** - the brainstorm-and-design rhythm: you talk, the agent proposes items, you approve, they get numbered, reopening one later is normal. *"Add a design item for X." / "Revise item 3."*

### Memory beyond tasks

- **Write a rule** - a durable instruction that shapes future behavior. *"Add a rule - always do X."*
- **Write a session entry** - a project-wide snapshot or note, not tied to one task. *"Log a session entry."*
- **Write a journal entry** - a reflective note worth keeping that isn't a rule or a task record. *"Write a journal entry about X."*
- **Write a case study** - a success, failure, or lesson worth carrying forward. *"Write a case study on X."*

### Finding things

- **Look something up** - just ask the question; the agent picks the lookup. *"What did we decide about X?" / "Find the task where we discussed Y."*

<!-- END QUICK REFERENCE -->

---

## Notes for review

- New-this-pass capabilities are folded in here too: disable/enable/uninstall, and revising a task's own definition. Both were missing from the outline until the 2026-08-19 audit; this draft and the outline now agree.
- Deliberately excluded: `write-task-spec.js`. Item `[0003-decide-the-fate-of-write-task-spec]` is still open - nothing should document that name until its fate is decided.
- The extraction mechanism (a helper that prints just the delimited block on demand) does not exist yet. This file is the content half of that plan; the helper is still just the idea recorded in the spec.
- Placement, per the spec: early in the guide, after the mental model (Part 1, section 2), before the rest of Part 1 continues into the agent disclaimer.
- Every phrasing above is a draft. Expect the exact words to change once item 2 is decided and once real usage tells us which ones people actually reach for.
