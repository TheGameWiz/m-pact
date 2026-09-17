# M-PACT User Guide

## Table of contents

- [Part 1 - Overview](#part-1---overview)
  - [What this is and who it's for](#what-this-is-and-who-its-for)
  - [The mental model](#the-mental-model)
  - [What to expect from agents](#what-to-expect-from-agents)
  - [Platforms and agents](#platforms-and-agents)
- [Part 2 - Getting set up](#part-2---getting-set-up)
  - [Installing M-PACT (once per agent)](#installing-m-pact-once-per-agent)
  - [What happens on its own, and what the first run will ask for](#what-happens-on-its-own-and-what-the-first-run-will-ask-for)
  - [Setting up a project](#setting-up-a-project)
  - [Turning it off, back on, or removing it entirely](#turning-it-off-back-on-or-removing-it-entirely)
- [Part 3 - How to ask for things](#part-3---how-to-ask-for-things)
  - [Say the verb, not just the ritual](#say-the-verb-not-just-the-ritual)
  - ["Handoff" means three different things](#handoff-means-three-different-things)
  - [Your words become part of the record](#your-words-become-part-of-the-record)
  - [How a request is built, with samples](#how-a-request-is-built-with-samples)
- [Part 4 - What you can ask for](#part-4---what-you-can-ask-for)
  - [Starting a session](#starting-a-session)
  - [Saving and restoring context](#saving-and-restoring-context)
  - [Creating a task](#creating-a-task)
  - [Switching the current task](#switching-the-current-task)
  - [Revising a task's definition](#revising-a-tasks-definition)
  - [Designing and iterating](#designing-and-iterating)
  - [Taking a handoff](#taking-a-handoff)
  - [Writing a handoff](#writing-a-handoff)
  - [Writing a task log](#writing-a-task-log)
  - [Closing and reopening a task](#closing-and-reopening-a-task)
  - [Rules](#rules)
  - [Journal entries](#journal-entries)
  - [Case studies](#case-studies)
  - [Finding things](#finding-things)
  - [Recalling a prior conversation](#recalling-a-prior-conversation)
- [Part 5 - Putting it together](#part-5---putting-it-together)
  - [A worked example](#a-worked-example)
  - [When something goes wrong](#when-something-goes-wrong)

## Part 1 - Overview

### What this is and who it's for

M-PACT is a multi-provider coding tool. Built for a world where you're not limited to one AI agent, it lets you orchestrate several, even across different providers, so they remember your work, hand it off to each other, and catch each other's mistakes instead of you starting over every time.

Here's what that looks like in practice:

**Two agents, two perspectives** - Assign different AI providers to review each other's work. Because they're trained differently, they catch different kinds of mistakes, giving you a second opinion no single agent could offer alone.

**Persistent memory across agents and sessions** - Work continues seamlessly across a fresh session, whether that's a new tab, a cleared context, or switching to a different agent entirely. And when a quick summary doesn't have the detail you need, you can search back through the actual conversation to find it.

**Save context whenever you want, and it restores automatically** - Compaction eats the conversation, not just the record. Everything you talked through, the options you ruled out and why, is gone the moment the context resets. Ask once and it's saved to disk, and the next session picks up where you left off automatically.

**Work organized as tasks, each with its own blueprint** - A project breaks down into tasks, and each task carries its own design spec alongside the implementation, so agents build against something you've already agreed on rather than improvising as they go.

**One list, from design to done** - Every item moves through the same tracked path, from design through implementation to final verification, with agents doing the back and forth and flagging anything that still needs your call.

**Handoff seamlessly between agents** - Use it to hand off a design review, code review, implementation, or verification to another agent, or back to a fresh session of the same one, and the full context, what's decided, what's pending, comes with it.

**One set of rules, every agent follows** - Your preferences, standards, and lessons learned, written once, followed by every agent.

**Also capture everything that isn't a task** - Not every thought fits neatly into a task, so journals and case studies give you a place to capture insights, decisions, and lessons that would otherwise just get lost.

None of this requires a rigid structure. Run M-PACT with a single agent if that's your preference, or bring in a second agent, which is a common pattern, one as your design partner, the other for implementation, each circling back to check the other's work. Beyond that, the door's open too, however many agents fit the way you work.

#### How you talk to M-PACT

You use M-PACT by talking to your agent. You say things like "save where we are," "write this up for Codex," or "have Claude review the design." There is no command line to learn.

A small set of handoff phrases is guaranteed to resolve exactly as written. You'll meet them in Part 3. They are the floor, the thing you fall back on when you are being terse and precision matters, especially when work crosses from one agent to another. They are not the normal voice of the tool. Part 5 has a worked example of what a session actually sounds like. It is full sentences and back and forth. Nothing in it resembles typing a command.

#### Three things the overview leaves out

**Windows are the unit.** Multi-provider means two windows open on the same project, whether those are terminal sessions or editor panels. Two is the recommended shape. Three or four also work. The agent leading the design writes a review handoff, each of the other agents takes it and writes back its findings, and the lead takes a handoff on the results. One agent in one window works too, and you still get tasks, memory, and pick-up-where-you-left-off. You are just not getting the second opinion the tool was built around.

**Where this came from.** M-PACT came out of running two agents on the same code and finding that each one alone failed in its own way. The disagreement between them turned out to be the useful part. Earlier systems worked the same problem before this one. They are history, not instruction, and nothing in this guide depends on knowing them.

**What it is not.** It is not a chat archive. It is not a wiki. It is not automatic. Records are written when you ask for them. The one thing the tool writes on its own is a small repair record when it finds a gap in a task's history, and it announces that when it happens.

### The mental model

Two or more agents, in separate windows, working one project. They cannot see each other's conversations. What they share is what gets written down.

That is the fact underneath everything else in this guide. Memory is shared across your agents. It is not tied to one chat.

There are two levels of memory. One follows you everywhere, across every project you work in. The other belongs to a single project. Projects can nest. A project that lives inside another project's folder inherits its parent's memory, reading the parent's rules and history and writing only to its own.

Tasks are the unit of work. A task carries a definition, a design specification, and a log. The log is the chronological record, one entry after another as things happen. The specification is the current statement of what was decided and why. People confuse the two all the time, so here it is plainly: the log is history, the spec is the plan as it stands right now.

One mechanical fact explains the whole design rhythm you'll meet in Part 4. Design items are born in the log, one entry at a time, and the specification is assembled from them when you ask for it. The list of items is the real thing. The specification is a snapshot of that list with a narrative wrapped around it.

Starting a session loads a compact snapshot, not the whole archive. Everything else is fetched when you or the agent actually need it.

Writes are append-only. A record that turns out to be wrong is corrected by a later record. It is never erased. The one exception is the journal, which you can ask an agent to edit in place. Task logs and specification records only ever grow. The plain-text copy of a specification's narrative that you can edit by hand is a working copy, and folding your edits in appends a new record rather than rewriting an old one.

There are two different memories of any conversation: the record an agent chose to write down, and the transcript of what was actually said. M-PACT keeps the first on hand and knows where to find the second when the record isn't enough.

That is the whole shape. Part 2 is setup and Part 3 is how to ask for things. Both will make more sense now that you have seen the picture whole.

### What to expect from agents

Before you trust anything the rest of this guide describes, it is worth being honest about what M-PACT changes and what it does not.

**The bargain, stated first.** The tool adds structure and evidence. It does not add control. Nobody controls the agents. M-PACT builds structure that makes them more dependable, and there are no guarantees underneath that. If you tell an agent to delete a drive, that can happen, and nothing here prevents it. The guardrails are yours. A mistake made through an agent is your responsibility, not the tool's.

Think of it as a deal with the devil. You can write the cleverest instruction you like, and there is always a reading you did not anticipate. The agent is not gaming you. It does not know what you left unsaid, and it does not know the relationships sitting in your head that never made it into the conversation.

A close cousin of that is literal compliance. Tell an agent not to do a specific thing, and it will often obey that instruction to the letter while finding the nearest path to the exact outcome you were trying to prevent. Naming the move you are afraid of can make it worse, because now that move is on the table. This comes from months of watching it happen, not from measuring it. The practical advice is to state the goal and the boundary, and leave the specific move you fear unnamed.

None of this is common. Rare is not the same as safe. The cost of a rare failure is not proportional to how often it happens, so no frequency above zero is really acceptable, and the burden of checking stays with you.

The failure that produced this tool in the first place was not forgetting. It was narration. An agent described work in confident, specific detail, and the work had never happened. You read it as a report, you build on top of it, and you find out later the foundation was fiction. That is why M-PACT puts evidence on disk instead of taking the agent's word for it. The full story is in the ["Trust, Yet Verify" section](https://github.com/TheGameWiz/Measure-Twice-Cut-Once/blob/main/Articles/Dont-Make-Me-Come-Back-There.md#trust-yet-verify) of *Don't Make Me Come Back There*. It is worth reading once in full rather than summarized here.

Instructions to agents are not guarantees, and they are not consistent. The same sentence lands differently on different agents, and differently on the same agent on different days. What is reliable is the machinery underneath: numbering, naming, timestamps, validation, refusals, the receipt after a refresh. That is code, and it behaves the same way every time. What varies is judgment. Whether the agent wrote anything at all. Whether it took the handoff you meant. What it put in the body. Whether it stopped where you wanted. Whether it actually read what it says it read.

So the working rule is this. Trust the machinery, verify the judgment. Say what you mean, specifically. Read what an agent claims it did. A wrong record gets corrected by the next one. Reopening something is normal, not a failure of the earlier work.

Expect, too, that a workflow tuned to one agent will not transfer cleanly to another. You will develop your own feel for each one.

### Platforms and agents

M-PACT is built to be portable. No hardcoded paths, no shell-specific commands, POSIX behavior as the default with Windows handled as its own case.

In practice it has been developed and exercised on Windows, and it has since been run on macOS and confirmed working. Linux has not yet been tried. Treat that as untested rather than unsupported. If you are the first to try it there, what you find is worth reporting.

Codex CLI and Claude Code are validated. Antigravity is a full target alongside them, same shape plus its own startup hook. Copilot CLI may work through the same shims but has not been validated as a first-class runtime. Treat it as best-effort. Gemini CLI is retired. M-PACT no longer ships a Gemini CLI extension, and no agent should list it as a target.

M-PACT needs Node.js 18 or newer and an agent with shell and filesystem access. Web-only clients cannot reach local memory at all.

---

## Part 2 - Getting set up

Two separate things get confused here. Installing ties M-PACT into an agent. Setting up a project tells M-PACT that a workspace has memory. They are different steps, done at different times, for different reasons.

### Installing M-PACT (once per agent)

Installing is more than dropping a folder in place. It ties M-PACT into the agent so the agent sees it and acts on it every time it starts, not only when you remember to ask. You repeat this once for each agent you want to use.

What installing does not do is touch any project. That is the thing people actually worry about, so here it is concretely. The only files an install writes outside its own folders are user-global: the agent's own instruction file at the user level, its hook settings, and a permission entry so the agent can read your user memory root. No file inside any of your projects is touched.

Where it does write to the instruction file, it writes carefully. It adds a short block between two marker lines. Existing content in that file is preserved. A second install replaces only the marked block. If the markers are malformed, it refuses rather than guessing.

Installing also puts a few things in place that you will actually see later. A startup hook for that agent, so refresh runs on its own. A user memory root in your home folder, outside any project. And a set of starter rules in that root. The starter rules are editable defaults. Read them, change them, delete the ones that don't fit the way you work. Adding rules of your own later is covered under "Rules" in Part 4.

Codex asks you to review and trust the startup hook through its own hooks command before it will run. The install's output tells you so. That is the one manual step in the whole process. If you skip it, you get no automatic refresh and no error explaining why.

None of this should feel heavy. It is a few minutes per agent, once.

### What happens on its own, and what the first run will ask for

Refresh runs at session start, after a clear, and after a compaction. You do not ask for it. You know it ran because of the short receipt at the top of the agent's first reply. The receipt names the project it loaded, which is your chance to confirm the agent landed in the right place.

Refresh also tells the agent whether the current task has log entries it hasn't read yet, and who wrote them. The agent is told not to go read those on its own. They may be work another agent left mid-flight that hasn't been routed to you. If you want them read, say so.

The first time an agent refreshes, expect a permission prompt or two. It needs to run the refresh helper and to read your user memory root, which lives outside the project. Approve it once and it should not ask again.

If it keeps asking, that is a signal, not something to live with. Someone who wasn't told to expect one prompt has no way of knowing that ten prompts means something is wrong. So here it is plainly: one approval per agent should be the whole story. Permissions are set per agent, not per machine, so a second agent means the same one-time prompt for that one. Getting this right the first time is the difference between the tool feeling smooth and feeling like it interrupts you constantly.

### Setting up a project

Setting up a project is separate from installing. Installing configures the agent. This gives a workspace its own memory folder so the agent has somewhere project-specific to write.

There are two ordinary ways this happens. Startup notices you are in a folder with no memory and offers to set it up, or you ask for it directly.

```text
Set up M-PACT here.
```

There is a third case worth knowing about. A project that already has memory from an earlier version of M-PACT loads normally, shows you the receipt, and then asks whether to adopt this project. Yes registers it. No leaves reading working, and every write halts until you say yes later. This is a one-project question. It never sweeps across your machine.

A freshly set up project looks nearly empty, and that is expected. Two things show up as you work. A scratch folder, kept out of version control on its own, holds temporary input and any context you have asked to save. And each task gets a plain-text copy of its current design narrative that you are free to edit by hand. More on that under "Designing and iterating" in Part 4.

One more thing to know before you set up. A project inside another project's folder inherits the parent's memory by design. It reads the parent's rules and history and writes only to its own. That is exactly what you want when the child really is part of the parent. It is a trap when an unrelated project happens to live inside another one's folder. Know which situation you are in before you set up.

Finally, a word about switching projects, because there is no command for it. M-PACT has no current-project pointer. The project is wherever your agent was launched from, whether that is the folder your editor has open or the directory you were sitting in when you started the CLI. From there the agent walks up and uses the first memory root it finds. A session stays bound to that project for its whole life. To work on a different project, start a session there. There is no switching mid-session, and no command for it, because nothing the agent runs can move the runtime it is running inside. Tasks have an explicit pointer you move on purpose. Projects do not. Launch location is the pointer.

### Turning it off, back on, or removing it entirely

There are three operations here, and a fourth state you do not set yourself. They are worth keeping apart, because "turn it off" means something different depending on which one you actually want.

**Disable** silences the automatic startup refresh for one agent. The skill stays installed, and you can still invoke it by name. It just stops running itself at the start of every session.

```text
Disable M-PACT for Codex.
```

**Enable** undoes a disable.

```text
Turn M-PACT back on for Codex.
```

**Uninstall** is the actual off-ramp. It removes the instruction block, the hooks M-PACT owns, the permission entries, and the installed skill folders. M-PACT stops existing for that agent until you reinstall it. It works even when the session is suppressed, and it refuses to run from inside a folder it would have to delete.

```text
Uninstall M-PACT from Claude Code.
```

Each of these targets one agent at a time. Disabling Claude Code does not touch Codex.

None of the three ever touch memory. Here is why before how. Your records are left in place because they may still be worth having. They are a written record of the actions you took. They are stored as ordinary zip files full of plain text, markdown and JSON and the like, and any unzip tool opens them whether or not M-PACT is installed. If you do want them gone, the memory lives in two places: a memory root in your home folder, and a memory folder inside each project. Both are safe to delete by hand.

That deletion is the one irreversible action anywhere in this guide. Everything else, disabling, uninstalling, walking away for months, can be undone by reinstalling. Deleting the memory folders cannot.

The fourth state is **suppressed**. If a reply shows `M-PACT SUPPRESSED`, some other program that launched the agent has told M-PACT to stand down because it manages context itself. ConflabCode is the case this was built for. Nothing is broken and nothing was refreshed. You did not set this, and you do not clear it from inside the session. It is an environment setting owned by whatever launched the agent. Disable and enable are blocked while suppressed, because both run through the same setup path install uses. Uninstall is not blocked, because it never reads or writes memory.

---

## Part 3 - How to ask for things

This part teaches a principle, not a vocabulary. If it lands, most of the rest of this guide is self-service.

### Say the verb, not just the ritual

Every useful request carries three things: which operation you want, how much authority you are granting, and what you want back.

The extra words in a request are not politeness. They are scope. "Take handoff" grants a read and a report. "Take handoff and implement" grants a change. Leave the verb out and you get the safe default, a read and a report. Sometimes that is not what you wanted, and now it costs you a round trip.

Being specific also gives the agent something precise to push back on. Vague requests get silent compliance with the wrong thing, because there was nothing concrete enough to object to. Vagueness is not safer. It just delays the disagreement.

The verbs mean the same thing everywhere in the tool. **Write** appends a record. **Create** starts a new container. **Revise** changes a definition. **Modify** edits in place, and only journal entries allow it. **Save** saves your context so it can be restored. **Set** sets the current task, and that is the only pointer there is to set. "Update" is the one word that means something different depending on what you point it at, so it is worth avoiding for that reason alone.

### "Handoff" means three different things

Same word, three durable outcomes. The surrounding verb picks which one you mean.

**Take** a handoff, and you are reading an existing task and reporting on it, and the report is a chat response, an opinionated evaluation with a recommendation, not a document. **Write** a handoff, and you are authoring a record into the task you are already in. **Handoff** on its own, or "hand this off," or "handoff to Codex," without naming a task, asks whether to create a brand-new task from the conversation you are having. That one is confirmation-gated on purpose. It is the phrasing most likely to surprise someone.

Taking a handoff is never itself permission to change anything. Not code, not the task, not the log. Reading and reporting is the whole grant. If you want more, say so in the same breath: "take handoff and implement," not "take handoff" followed by a separate ask later.

A chained instruction runs every step in the order you gave it. It only writes a durable record if it ends on a giving phrase. A chain that ends mid-action does the work and writes nothing down about it.

The direction lives in the verb, not in the object after it. A handoff is an act of giving, so the bare word already names the giving side. "Take," "receive," or "get" name the receiving side, and any receiving phrase is an instruction to act. That means "Take Handoff, Design Review" and "Take Handoff, Review Design" resolve the same way. You review. Word order on the object does not matter.

On the giving side, one word does the real work: **Results**. Without it, you are asking for a review. "Handoff, Design Review" and "Handoff, Request Design Review" both mean "please review my design." With it, you are handing a review back. "Handoff, Review Results" means "here is what I found." The returning phrase does not need to say which kind of review it was. The record it is answering already says.

Last, the current-task pointer is a fallback, not an authority. You can name the task directly: "take the handoff for task 7." If you don't, the agent resolves against whichever task was last created, revised, or set as current, in any window. With two windows open on two different tasks, a bare "take handoff" can land on the other window's task. That is exactly why the agent's first line always names the task it resolved. It is your chance to catch it before anything else happens.

### Your words become part of the record

What you ask for gets captured into the task's record. The next agent reads exactly that phrasing. That agent may be a different provider, or it may be you in a future session.

So the words you choose are not disposable. Vague phrasing gets written down exactly as vague as it sounded, and it travels forward that way with none of your tone or context to fill the gap. Precise phrasing travels forward precise. Saying what you mean pays twice: once when the current agent acts on it, and again when someone else has to reconstruct your intent from it.

### How a request is built, with samples

A request is a verb, an object, and an outcome. The verb carries direction and how much authority you are granting. The object says what kind of work. The outcome is what you want handed back. Presented that way it is just ordinary English, verb plus noun, because that is what it is.

Here is the round trip you will do all day, three lines, verbatim. *"Handoff, Request Design Review"* going out to the other window. *"Take Handoff, Design Review"* on the other end, to act on it. *"Handoff, Review Results"* coming back. The same three lines work with "Implementation" in place of "Design." That is the whole pattern. You have it after six lines.

For the complete set of phrasings, see the handoff grid in the [Quick Reference](USER_GUIDE_QUICK_REFERENCE.md). It is not repeated here. This section is the structure and the samples. The grid is a lookup table for when you already know roughly what you want.

Two operations are guaranteed to resolve exactly as written: handoff, in the forms above, and saving or restoring context. Those are reliable because the tool checks for them by name. Everything else resolves by meaning. This guide deliberately varies its own phrasing for everything else so nothing here reads as a required vocabulary. If you say it in plain English and it is clear what you want, it should work.

---

## Part 4 - What you can ask for

One short section for each thing you can ask an agent to do, in roughly the order you will meet them. Each section answers the same four questions: when you'd want this, what to say, what happens, and what to watch for.

### Starting a session

You don't ask for this one. It happens on its own at the start of a session, after a clear, and after a compaction. What you see is a short receipt at the top of the reply confirming which project the agent loaded.

The agent also knows, from that load, whether the current task has log entries it hasn't read yet. It is told not to go read them just because it noticed them. If you want them read, say so.

```text
Catch me up on what I've missed on the current task.
```

Otherwise, treat the receipt as confirmation that the agent is grounded and in the right place, and get on with whatever you came to do.

### Saving and restoring context

Saving is something you ask for, typically right before a compaction, a clear, or a restart you know is coming.

```text
Save context before we compact.
```

Restoring is not something you ask for in the normal case. The next refresh picks the saved context up and folds it in. That includes the refresh a hook runs automatically after a compaction, which is what makes "it restores automatically" true. A save from the last ten minutes is picked up without asking. Anything older makes the agent stop and ask you, by filename, whether to restore it or discard it. It never guesses.

```text
Restore context.
```

That works if you want to say it anyway, but you rarely need to.

Saved context belongs to the agent that saved it, for that same agent after it loses its own context. It is not tied to a task. You were probably mid-task when you saved, so the content will lean heavily on that task, but that is just what was in it. It is not a handoff to another agent either. A handoff is a task log entry. This is same-agent continuity. There is one saved context per agent per project at a time. Saving again replaces the last one.

If you never asked for a save and lose context anyway, refresh builds a fallback. With a current task open, it pulls the recent task log and adds a small slice of the current transcript for nuance. Without a task, it reads a slice of the transcript directly. It is a floor, not a replacement for saving. Keeping an eye on your context still matters.

### Creating a task

Ask for a task when work needs to survive a closed tab, get reviewed by someone else, or involve more than one agent.

```text
Create a p2 task for documenting the new onboarding flow.
```

Or, from a conversation already in progress:

```text
Make this a task.
```

For a task built from conversation, the agent derives a title from what you have been discussing and writes an opening log entry with enough detail for someone else, or you in a future session, to pick it up cold. The new task becomes the current task. Task creation only happens when you ask for it. An agent should never decide on its own that a conversation deserves to become one.

### Switching the current task

```text
Switch to the onboarding-flow task.
```

This moves a pointer that is shared by every window on the project, not just the one you typed it into. With two windows open on two different tasks, moving the pointer in one changes what a bare "take handoff" resolves to in the other. See ["Handoff" means three different things](#handoff-means-three-different-things). When that matters, name the task instead of relying on the pointer.

### Revising a task's definition

Use this when the task's own definition, its title, priority, source, context, or acceptance criteria, needs to change after work has started.

```text
Revise this task: acceptance now includes handling the empty-state case.
```

This is distinct from revising the design inside the task, covered next. The task's definition is the container. The design specification is the plan living inside it.

### Designing and iterating

This is the rhythm at the center of the tool. It is worth walking through as a sequence rather than a list of features.

1. **Brainstorm with one agent.** Pick whichever agent you want as design lead for this task and talk it through, by dictation if that is easier, for as many rounds as it takes. Nobody has to say the word "item" for any of this to count. You are just talking. When you feel close, ask for a summary and read it.

2. **Items are born in the log.** When something is worth keeping, say so.

   ```text
   Add that to the design.
   ```

   That appends a log entry containing a new, numbered item. That is the entire mechanism. A numbered item exists because it was added to the active list, and the number is its identity from then on. Adding an item is the one ask an agent has to get an explicit yes on. Silence means no item was created. The agent should also name the item back to you in its reply, not just file it quietly.

3. **The specification assembles them.** This is a separate step that gathers the items into one document alongside a narrative.

   ```text
   Write the design spec.
   ```

   You can run an entire task on the item list alone and never write a spec. The spec is a checkpoint you reach for when you want to see the whole shape of the design in one place. It is not a required step.

4. **The design loop.** Hand it to the second window for review.

   ```text
   Handoff, Request Design Review.
   ```

   The reviewer takes it and finds the things that looked fine in conversation but don't hold up against how it thinks about implementation. It writes back "Handoff, Review Results." In the lead window, "Take Handoff, Fold in Results" pulls those findings into the design. Two or three rounds of this is normal. By the second round the reviewer's gaps are usually real ones.

5. **Implement.** When the design is settled, send it over for building.

   ```text
   Handoff, Implement.
   ```

   In the other window, "Take Handoff, Implement" moves that agent into building against the agreed items. The list stops being a design artifact and becomes the thing implementation is measured against.

6. **The implementation loop.** The implementer hands back "Handoff, Request Implementation Review." The lead takes it, finds what doesn't match the agreed items, and writes "Handoff, Review Results." The implementer takes those results, checks whether they are real, fixes them with "Take Handoff, Implement Fixes," and hands back for review again. Same shape as the design loop, repeated until you are satisfied.

A few things to know about this rhythm. Items are permanent once written, and their wording tends to harden later than you'd expect, so it is worth getting it close to right the first time. Reopening an item later is completely normal. A bug in work an item already covers keeps that item open. Only a genuine gap, scope the list does not cover, earns a new item.

And the narrative half of the specification has a plain-text copy sitting in the task's folder. You can open it and edit it directly.

```text
Fold in my edits to the specification.
```

That file is regenerated after every specification write, so your edits go in before you ask for the next write, not after.

### Taking a handoff

```text
Take Handoff, Design Review.
```

The agent's first line names the task it resolved and the purpose it is applying. A wrong task or the wrong kind of review is visible immediately, before it produces anything you'd have to throw away. Say what you want back, or you get the read-only default: a chat response that evaluates what it read, flags risks, and recommends a next step, then stops and waits for you. Taking a handoff on a closed task stops in one sentence. There is nothing to pick up.

```text
Take Handoff, Discuss.
```

That one asks the agent to read the handoff and talk it through with you. No code, no design changes, no log writes until you say so. It is a useful pause when you want to think before anything happens. In practice the bare take already behaves this way; "Discuss" just makes the posture explicit.

With two windows on two different tasks, name the task. A bare take resolves through the shared pointer, and the other window may have moved it more recently than you think.

### Writing a handoff

```text
Handoff, Request Implementation Review.
```

The outgoing phrase carries the kind of work being requested. The returning phrase does not need to, because the record already says which review it was answering. ["Handoff" means three different things](#handoff-means-three-different-things) has the full grammar.

The agent writes a handoff when you ask for one, not when the work feels finished. That extra round trip is deliberate. A handoff written before the discussion that would have improved it is stale on arrival, and append-only storage keeps it that way.

### Writing a task log

Use this for a checkpoint that isn't a handoff. A decision, a test result, a correction worth recording.

```text
Log this decision before we move on.
```

The agent fills in the record's place in the sequence. You never track or supply a number yourself. The phrasing above is an example, not a command to match. Only the handoff grid and the save-context phrases are anchored word for word; everything else, this included, resolves by what you mean.

### Closing and reopening a task

```text
Close this task.
```

Closing records whatever was still open at the time, and the reply tells you if anything was. Nothing on the list disappears without your knowing.

```text
Reopen the onboarding-flow task, there's follow-up work.
```

Reopening surfaces that leftover list without automatically putting it back into play. The first log entry after a reopen says plainly what is active again. The usual reason to reopen is not unfinished leftovers at all; it is that you have new design items to add, and the new work belongs with the task's existing record. Reopening is a normal part of the workflow, not an admission that the earlier close was a mistake.

### Rules

Rules are durable instructions that shape how agents behave going forward.

```text
Add a rule: always confirm before deleting a file outside the project.
```

A rule lands in the project by default. Say "global" or "user-level" to put it in the memory root that follows you across projects. The agent checks whether an existing rule already covers the same ground and merges into it rather than creating a near-duplicate. The rule's filename is its one-line summary, and every agent reads that filename at every startup. The fuller body is read only when the rule turns out to apply to the work at hand.

There is no vocabulary for deleting a rule, and that is deliberate, to keep an agent from ever removing one by accident. Rules are plain files in the memory root's rules folder. To delete one, delete the file yourself. The same goes for the starter rules that install put in your user root.

### Journal entries

Journal entries hold notes worth keeping that are not rules or tasks. Reflections, context, things you want on record in your own voice. In practice it works like a project diary.

```text
Write a journal entry about why we chose this approach over the alternative.
```

Journal entries are the one kind of record you can ask to have edited after the fact.

```text
Modify that journal entry, I want to add a caveat.
```

### Case studies

Case studies capture successes, failures, and lessons worth carrying forward as a narrative rather than a one-line rule.

```text
Write a case study on the refresh failure we debugged this morning.
```

A rule says what to do. A case study explains why the rule exists and how the lesson was actually learned. That matters when the rule alone does not convey the stakes.

### Finding things

Ask the question directly and let the agent choose the right kind of lookup.

```text
What did we decide about the retry logic?
Find the task where we discussed rate limits.
List the active rules.
```

Left unscoped, a lookup searches the current project. Say "global" or "user" for your user-level memory, "parent" for the project above this one, or "all" for the whole chain. Sibling projects are never searched unless you name them.

### Recalling a prior conversation

This searches the actual transcripts of what was said, not the records an agent chose to write down. It can surface nuance a summary left out. One caveat: there is no guarantee those transcripts still exist. Providers do not keep sessions forever, and a cleared session is gone. When they do exist, this is how you search them.

```text
When did we talk about switching providers for this task?
Every time we discussed the pricing model, on any task.
```

There are three scopes: this task, this project, or every project. The agent uses whichever one you stated and only asks if you gave none. Phrasing also decides how far it looks. "When did we" stops at the first match. "Every time we" sweeps everything.

---

## Part 5 - Putting it together

### A worked example

This is a constructed session, not a transcript of a real one. A real session carries domain noise the reader has to see past. A constructed one can be checked line by line against how the tool actually behaves. Two windows, two providers, every line labeled with who is speaking, because the switching between them is the whole point.

The task: add a configuration flag to quiet a noisy log line in an existing service. Small and dull on purpose, so you watch the choreography, not the code.

**Worked example, one task, two windows**

| Window 1 - Claude (design lead) | Window 2 - Codex (reviewer, then implementer) |
|---|---|
| **Task Setup** | |
| **Director:** "I want to add a flag to quiet down that noisy debug log in the ingest service. Make this a task." | |
| **Claude:** Created task 12, quiet the ingest debug log, and made it current. The first log entry has what we just said. What should the flag be called, and does it default on or off? | |
| **Design** | |
| **Director:** "Call it `QUIET_INGEST_LOG`, default off, so nothing changes unless someone opts in." | |
| **Claude:** Add that to the design? | |
| **Director:** "Yes." | |
| **Claude:** Item 1 added: introduce `QUIET_INGEST_LOG`, default off, suppresses the ingest debug line when set. Anything else before this goes out for review? | |
| **Director:** "That's the whole thing. Handoff, Request Design Review." | |
| **Claude:** Written. Codex can take it whenever you're ready. | |
| | **Design Review** |
| | *Director switches to Window 2* |
| | **Director:** "Take Handoff, Design Review." |
| | **Codex:** Task 12 from the current pointer, resolving this as a design review. One item: `QUIET_INGEST_LOG`, default off. The gap I'd flag: the item doesn't say whether the flag is read once at startup or checked on every request. Per-request means an environment lookup on the hot path. Startup-only means a running process can't be quieted without a restart. Worth deciding before it gets built. |
| | **Director:** "Good catch. Startup-only. It's a debug flag, nobody needs to flip it live." |
| | **Codex:** Handoff, Review Results. Recorded the startup-only decision as the one finding. |
| **Fold In Results** | |
| *Director switches to Window 1* | |
| **Director:** "Take Handoff, Fold in Results." | |
| **Claude:** Task 12, folding in Codex's design review. One finding, startup-only. Revising item 1 to say the flag is read once at process start, not per request. That was a real gap. Ready to send for implementation? | |
| **Director:** "Handoff, Implement." | |
| **Claude:** Written. | |
| | **Implementation** |
| | *Director switches to Window 2* |
| | **Director:** "Take Handoff, Implement." |
| | **Codex:** Task 12, resolving this as implementation. Done. The flag is read at startup and gates the one debug line. Tests pass. Handoff, Request Implementation Review. |
| **Implementation Review** | |
| *Director switches to Window 1* | |
| **Director:** "Take Handoff, Implementation Review." | |
| **Claude:** Task 12, reviewing the implementation against item 1. It matches: startup-only, default off, gates exactly one line. One thing worth reopening. Item 1 never says what happens when the value is something other than a clean true or false, an empty string or a typo. Small, but worth deciding before this ships. | |
| **Director:** "Anything that isn't exactly "true" means off. Add that to item 1." | |
| **Claude:** Revising item 1 to say non-"true" values fall through to off. Handoff, Review Results. | |
| | **Fixes and Verification** |
| | *Director switches to Window 2* |
| | **Director:** "Take Handoff, Implement Fixes." |
| | **Codex:** Task 12, resolving this as implementation of the review findings. Done. Non-"true" values now fall through to off, with a test for the empty-string case. Handoff, Request Implementation Review. |
| | ***Director runs the service with the flag set to "yes", confirms the log line still appears, sets it to "true", confirms it is gone.*** |
| | **Director:** "Close this task." |
| | **Codex:** Closed task 12. Nothing was left open. |

Nothing here required memorizing phrases beyond the handoff grid, and everything else was an ordinary sentence carrying a clear verb. The one moment of friction, Codex catching the startup-versus-per-request question, is what the two-window shape is for. It was a gap the design lead didn't see, caught before it became code. And the Director checked the running service before closing, rather than taking either agent's word for it.

### When something goes wrong

| Problem | What to do |
|---|---|
| **The agent did more than you wanted.** | Every change is reviewable and every record is append-only, so nothing here is silent or unrecoverable. You can always see what happened and correct it with a new record. |
| **The agent did less than you wanted.** | Usually a missing verb. See ["Say the verb, not just the ritual"](#say-the-verb-not-just-the-ritual). Say what you want back rather than relying on the default. |
| **It keeps asking for permission on every session.** | That is a configuration issue on that agent, not normal behavior. See ["What happens on its own, and what the first run will ask for"](#what-happens-on-its-own-and-what-the-first-run-will-ask-for). |
| **A write halted unexpectedly.** | Read what it is protecting before retrying. The halt is usually there for a specific reason, like a project identity mismatch or a stale saved context. |
| **Something in a record looks stale or wrong.** | The fix is a new record, not an edit. Ask for the correction directly and let the next entry supersede it. |
| **Two agents wrote to the same task at the same time.** | The second write is refused outright, not silently lost or corrupted. Re-read the task and retry. There is no fixed limit on how many agents can work one task. The refusal is the safety net, not a working style. Deliberately pointing two agents at the same task at the same time, both implementing, both writing, is asking for trouble. Be deliberate about which window is acting before you act. |
| **The take landed on the wrong task.** | Two windows, two tasks, and a bare "take handoff" resolved through the pointer the other window had moved. The agent's first line is where you catch this. If it names the wrong task, name the right one and take again. |
| **Refresh failed.** | The agent should tell you exactly what failed and should not carry on with half-loaded memory. Common causes are a missing or too-old Node.js, output getting cut off, or the agent running refresh from the wrong folder. A message saying there is no memory root here is not a failure by itself. It is what you get after declining project setup. |
| **You moved, renamed, or copied the project.** | The next write stops and asks whether this location is intended. The old location can't be recovered from what is on disk, so only you can answer. Saying yes gives the project a fresh identity in its new home. |
| **Saved context couldn't be handled.** | Refresh fails outright rather than silently skip a saved context it can't match to the agent starting up. The failure message names what went wrong, and the fix is on the agent side. This is rare. |
| **The agent announced a repair you didn't ask for.** | Occasionally a specification item loses its paired log record, and the agent writes a derived one to fill the gap. This is announced rather than asked, because there is nothing for you to approve. The tool is making a gap visible instead of hiding it. |
