# M-PACT User Guide - Outline

Working document. This is the plan for a rewritten user guide, not the guide itself. It does not ship; once the guide exists this file moves out of `docs/` *(decided 2026-09-06, walk)*.

**Revised 2026-09-06**, twice. First against a reference audit (all 27 files in `references/`, plus `SKILL.md` and `README.md`; findings in `M-PACT_REFERENCE_AUDIT.md`). Then in a walk discussion the same day, which reframed Part 1, resolved five open questions, and surfaced four skill changes the guide could not describe until they existed. **Updated 2026-09-14** to retire the browser help entry after cross-provider browser launch proved unreliable. Earlier passes are kept below so the history is in one file.

## Voice and scope

The reader's interface is a sentence, not a command line. Nobody using M-PACT types a script name; they tell an agent what they want. So this guide is organized around intents - what you say, what happens, what you get back - and not around helpers, flags, or files.

Out of scope, deliberately: helper script names and their flags, ZIP container internals, record numbering, member naming, sentinel files, lock behavior, refresh audit markers, project ID plumbing. The technical contract already has a home in `references/` and `full-memory-contract.md`. The guide is freed to be about use because the deep truth is documented elsewhere.

The test for including a machine detail is not whether it is internal. It is whether the reader must **see, decide, or answer** it. A few pass that test and stay: the receipt after a refresh, the approval prompts before durable writes, the adoption question for an unregistered project, the identity question after a rename or move, and the folders and files that appear in the project.

Examples must be platform-neutral, or shown for both shells. The current guide has PowerShell-only examples, which makes it quietly Windows-only even though the software is not.

**Words** *(walk)*. In the guide's own voice M-PACT is a "coding tool," matching the overview. Not a "skill," not a "harness." Those words are true and belong in the references; to a reader they describe plumbing, not what the thing is for. Likewise "a written record of the actions you took," not "source of truth."

**Form** *(walk; updated 2026-09-14)*. Markdown only, in `docs/`. A linkable table of contents at the top, using GitHub's heading anchors, so the guide source is navigable without maintaining hand-written HTML. There is no generated browser-help surface for agents to open.

**Section shape** *(decided 2026-09-06)*. Every section in Parts 2 through 4 has the same shape: prose first, giving the rhythm and the why; then each reference term the section covers, with its example directly beneath it. One list, not two. Terms and examples are the same thought, and splitting them into a terms block and an examples block creates two lists that say the same thing and drift apart. No per-section lookup block. *(walk)* The shape stays scoped to Parts 2 through 4. Parts 1 and 5 have no reference terms to intersperse, so the question of extending it is closed; there is nothing to extend it to.

**The overview is a contract** *(walk)*. The guide is not organized by the overview's eight bullets; the bullet order is a sales order, leading with the payoff, and a guide must run in learning order. But every bullet has a home section, and that section opens by echoing the bullet's own words, so a reader who arrived from the overview finds the promise being kept. The mapping:

| Overview bullet | Home in the guide |
| --- | --- |
| Two agents, two perspectives | Section 1. This is the leading claim and stays there; it has no separate teaching section. |
| Persistent memory across agents and sessions | Splits. The memory half is section 2; the "search back through the actual conversation" half is "Recalling a prior conversation" in Part 4. |
| Save context whenever you want, and it restores automatically | "Saving and restoring context" in Part 4. The restore half needs the startup hook explained, because "automatically" only works because refresh re-runs after compaction. |
| Work organized as tasks, each with its own blueprint | Section 2 for the concept; "Creating a task" and "Designing and iterating" in Part 4 for the doing. |
| One list, from design to done | "Designing and iterating" in Part 4. |
| Handoff seamlessly between agents | "Taking a handoff" and "Writing a handoff" in Part 4. The guide has more to say than the pitch: "context comes with it" is machinery, but whether the agent took the handoff you meant is judgment. |
| One set of rules, every agent follows | "Rules" in Part 4. |
| Also capture everything that isn't a task | "Journal entries" and "Case studies" in Part 4. |

The overview itself gets one change *(walk)*: the save-context bullet moves from sixth to third, directly behind persistent memory, so the two memory promises sit together. They stay two bullets. One is the written record surviving, the other is the unwritten conversation surviving, and teaching that distinction is a large part of what the guide is for.

---

## Part 1 - Overview

### 1. What this is and who it's for *(reframed, walk)*

This section is the overview document (`mpact-guide-overview.md`), copied into the guide verbatim. Not summarized, not paraphrased, not trimmed. The same text opens the repository README, so it has to stand alone in both places; it is one file, copied into both at assembly, never retyped. The full text follows, with the save-context bullet already in third position.

> M-PACT is a multi-provider coding tool. Built for a world where you're not limited to one AI agent, it lets you orchestrate several, even across different providers, so they remember your work, hand it off to each other, and catch each other's mistakes instead of you starting over every time.
>
> Here's what that looks like in practice:
>
> **Two agents, two perspectives** - Assign different AI providers to review each other's work. Because they're trained differently, they catch different kinds of mistakes, giving you a second opinion no single agent could offer alone.
>
> **Persistent memory across agents and sessions** - Work continues seamlessly across a fresh session, whether that's a new tab, a cleared context, or switching to a different agent entirely. And when a quick summary doesn't have the detail you need, you can search back through the actual conversation to find it.
>
> **Save context whenever you want, and it restores automatically** - Compaction eats the conversation, not just the record. Everything you talked through, the options you ruled out and why, is gone the moment the context resets. Ask once and it's saved to disk, and the next session picks up where you left off automatically.
>
> **Work organized as tasks, each with its own blueprint** - A project breaks down into tasks, and each task carries its own design spec alongside the implementation, so agents build against something you've already agreed on rather than improvising as they go.
>
> **One list, from design to done** - Every item moves through the same tracked path, from design through implementation to final verification, with agents doing the back and forth and flagging anything that still needs your call.
>
> **Handoff seamlessly between agents** - Use it to hand off a design review, code review, implementation, or verification to another agent, or back to a fresh session of the same one, and the full context, what's decided, what's pending, comes with it.
>
> **One set of rules, every agent follows** - Your preferences, standards, and lessons learned, written once, followed by every agent.
>
> **Also capture everything that isn't a task** - Not every thought fits neatly into a task, so journals and case studies give you a place to capture insights, decisions, and lessons that would otherwise just get lost.
>
> None of this requires a rigid structure. Run M-PACT with a single agent if that's your preference, or bring in a second agent, which is a common pattern, one as your design partner, the other for implementation, each circling back to check the other's work. Beyond that, the door's open too, however many agents fit the way you work.

It leads with the multi-provider case: several agents, across providers, catching each other's mistakes. Memory is what makes that possible, not the product. The earlier framing here ("agents forget; M-PACT is shared memory") was inherited from the older *Two Agents, One Memory* article and made memory the headline. It is the wrong way round.

Additions the overview does not carry. These are written for the guide only and do not go into the README:

- **Windows are the unit.** Multi-provider means two windows, whether CLIs or editor extensions. Two is the recommended shape. Three or four also work: the composing agent writes a design-review handoff, each other agent takes it, reviews, and writes its results, and the lead agent takes a handoff on the review results. One agent in one window works and gives you the flow, but you are not using the tool as intended; it gets one sentence, not a walkthrough.
- **Origin, two or three sentences.** M-PACT came out of running two agents on the same code and finding that each one alone failed differently. The disagreement between them was the signal. The earlier systems described in the four articles were replaced; they are provenance, linked from here, not instruction. Filter for any backstory sentence: does it change what the reader does?
- What it is not: not a chat archive, not a wiki, not automatic. Nothing is written unless asked.

### 2. The mental model *(reordered, walk)*

Six to eight short paragraphs. This is the section that makes everything else make sense. Order it so memory arrives as the thing that enables multi-provider work, not as the headline.

- Two or more agents, in separate windows, working one project. They cannot see each other's conversations. What they share is what gets written down.
- So: memory is shared across your agents, not per-chat. That is the enabling fact.
- Two levels: what follows you everywhere, and what belongs to one project. Projects can nest; a child project reads its ancestors' memory and writes only to its own.
- Tasks are the unit of work. A task carries a definition, a design specification, and a log.
- The log is chronological events. The specification is the durable statement of what was decided and why. Users routinely confuse these; say it plainly here. *(walk)* And say the mechanical relationship once, because it explains the whole design rhythm: design items are born in the log, and the specification assembles them.
- Startup loads a snapshot, not the whole archive. The rest is fetched on demand.
- Writes are append-only. A wrong record is corrected by a later record, never erased. The one exception is the journal, which you can ask the agent to edit in place; logs and specifications are never edited.
- There are two kinds of memory of a conversation: the record an agent wrote, and the transcript of what was actually said. M-PACT keeps the first and knows where to find the second.

The capability overview sits directly after this section, so the reader sees the whole shape before reaching setup. That is why Part 2 can be setup and Part 3 can be asking, in that order, without the tool looking heavy. *(Ordering question closed on that basis, walk.)*

### 3. What to expect from agents *(expanded, walk)*

The honest disclaimer. Not a shrug - a placement of trust. Sits right after the overview and mental model because the reader needs it before they trust anything the rest of the guide describes.

- **The bargain, stated first.** The tool adds structure and evidence. It does not add control. We do not control the agents; we build structure that makes them more dependable, and there are no guarantees. If you tell an agent to delete a drive, that can happen, and nothing here prevents it. The guardrails are yours. Say plainly that mistakes made through the agents are the user's responsibility.
- **The deal-with-the-devil analogy** *(David's, keep it)*. You can make the cleverest deal you like and there is always a reading you did not anticipate. The agent is not gaming you; it does not know what you left unsaid, and it does not know all the implicit relationships in your context. The analogy is for the reader; the plain description underneath is what they act on.
- **Literal compliance** *(walk, David's observation)*. An explicit prohibition is obeyed to the letter and the intent routed around: the agent does the next closest thing. Worse, naming a specific forbidden move raises its salience, so the region around it gets explored. Practical advice: state the goal and the boundary, not the specific move you fear. Present this as months of observation, not measurement.
- **Rare is not safe.** The frequency is low. The cost is not proportional to the frequency, so no frequency above zero is acceptable, and the verification burden stays with you.
- **The trust failure, one paragraph** *(walk, salvaged from the articles)*. The failure that produced this tool was not forgetting. It was narration: an agent describing work in confident, specific detail, work that never happened. You read it as a report, build on it, and find out later the foundation was fiction. That is why receipts exist: evidence on disk instead of the agent's word. Link the article; do not retell it.
- Instructions to agents are not guarantees and are not consistent. The same sentence lands differently on different agents, and on the same agent on different days.
- What is reliable: the machinery. Numbering, naming, timestamps, validation, refusals, the receipts. That is code and behaves identically every time.
- What varies: judgment. Whether it wrote at all, whether it took the handoff you meant, what it put in the body, whether it stopped where you wanted, whether it read what it says it read.
- Therefore: trust the receipts, verify the judgment.
- Practical consequences: say what you mean specifically; read what the agent claims it did; a wrong record is corrected by the next one; reopening an item is normal, not a failure.
- A workflow tuned to one agent may not transfer to another. Expect to develop your own.

### 4. Platforms and agents

- Built to be portable: no hardcoded paths, no shell-specific commands, POSIX as the default with Windows special-cased.
- Developed and exercised on Windows. Not yet run on macOS or Linux. Treat as untested rather than unsupported, and say what to report if you are first.
- Agents, settled: **Codex CLI and Claude Code are validated. Antigravity is first-class** - same shape, plus its own install hook, no lingering caveat. **Copilot CLI may work through the same shims but is not yet validated as a first-class runtime** - present it as best-effort, not supported. **Gemini CLI is retired.** M-PACT no longer ships a Gemini CLI extension; no version of this guide should list it as a target.
- Requires Node.js 18 or newer and an agent with shell and filesystem access. Web-only clients cannot reach local memory.

---

## Part 2 - Getting set up

Two separate things, often confused. Installing ties M-PACT into an agent. Setting up a project associates a workspace. Say this distinction in the first sentence of the Part.

### 5. Installing M-PACT (once per agent) *(expanded, walk)*

- What installing does. It is not just activating a skill; it ties M-PACT into the agent so the agent sees it and acts on it at every startup. Repeat per agent you want to use.
- **What it does not do: touch any project.** This is the thing a user actually fears, so be concrete. The only files install writes outside its own folders are user-global: `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md` (or the provider's equivalent). No file inside any project is touched.
- **How it writes those files.** A short block between literal `BEGIN M-PACT SHIM` and `END M-PACT SHIM` markers. Existing content is preserved. A second install replaces only that block. Malformed markers cause a refusal rather than a guess.
- What else it puts in place, because you will see these: a startup hook for that agent, so refresh runs on its own; a user memory root outside any project; and a set of starter rules in that root. The starter rules are editable defaults. Read them, change them, delete them.
- Codex asks you to review and trust the hook through its `/hooks` command before it will run. The install receipt says so. This is the one manual step, and a user who skips it gets no automatic refresh and no error.
- Keep this short. Setup should not make the tool look heavy.

### 6. What happens on its own, and what the first run will ask for

- Refresh runs at session start, after a clear, and after a compaction, without you asking. The receipt at the top of the reply is how you know it ran. The receipt names the project so you can check the agent is in the right one.
- The first time, expect a prompt for access to your user memory root and a temporary folder. Both are needed and both are outside your project.
- Approve once; it should not ask again.
- **If it keeps asking, something is misconfigured** - that is the signal, and a user who was not told to expect one prompt has no way to know that ten is wrong.
- Per agent: what to allow so it stops interrupting you. This is the difference between the tool feeling smooth and feeling broken.
- When a hook ran refresh for you, the reply carries a short note saying so. That is normal and means the agent is reminding itself that you have not seen the receipt yet.

### 7. Setting up a project

- Distinct from installing. Installing configures the agent; this registers a project.
- Two ways: let startup notice and offer, or ask directly.
- A third case, for projects that already have memory from an earlier M-PACT: startup loads the memory, emits the receipt, and then asks whether to adopt this project. Yes registers it. No leaves reading working and every write halting until you say yes. This is a one-project question, not a sweep.
- What appears in your project, and why it looks nearly empty at first. Name the folder and the two things that show up inside it as you work: a scratch folder (self-gitignored; holds temporary input and your saved context) and, per task, a plaintext copy of the design specification you can edit by hand (see "Designing and iterating").
- Nesting: a project inside another project's tree inherits the parent's memory by design, reading the parent's rules and history and writing only to its own. That is what you want when the child is part of the parent. It is a trap when an unrelated project happens to live in the parent's folder. Say which you have before you set up.

### 8. Turning it off, back on, or removing it entirely *(expanded, walk)*

Three different operations, and one state you do not set yourself. The guide has to keep them distinct, because "turn it off" is ambiguous and each of these means something different. *(walk)* There is no "remove" operation that pulls memory out of projects. Say so, because a user will look for one.

- **Disable**: silences the automatic startup refresh for one provider. The skill stays installed and you can still invoke it by name - it just stops running itself at the start of every session.
- **Enable**: restores automatic startup refresh after a disable.
- **Uninstall**: the actual off-ramp. Removes the shims, the M-PACT-owned hooks, the provider permission entries, and the installed skill directories - M-PACT stops existing for that provider until reinstalled. It works even if the provider session is currently suppressed, and it refuses to run from inside a directory it would delete.
- Each of the three targets one or more providers independently - disabling Claude Code doesn't disable Codex.
- **None of the three ever touch memory.** State it plainly, then explain why before how *(walk)*:
  - Why: your records were left because they may still be worth having. They are a written record of the actions you took. They are standard zip files containing plain text (markdown, JSON, and similar), and any unzip tool opens them without M-PACT installed.
  - How, if you want them gone: `.AgentMemoryRoot/` in your home directory, and `.AgentMemory/` in each project. Both are safe to delete by hand.
  - **This is the one irreversible action in the guide.** Everything else can be undone by reinstalling. Say that in plain words next to the paths.
- **Suppressed**: if you see `M-PACT SUPPRESSED` in a reply, another program that launched the agent (ConflabCode is the case it was built for) has told M-PACT to stand down because it manages context itself. Nothing is broken and nothing was refreshed. You did not set this and you do not clear it from inside the session; it is an environment setting the launcher owns. Disable and enable are also blocked while suppressed; uninstall is not.

---

## Part 3 - How to ask for things

The section that teaches the principle instead of a vocabulary. If this works, the rest is mostly self-service.

### 9. Say the verb, not just the ritual

- Every useful request carries three things: **which operation**, **how much authority**, and **what you want back**.
- Extra words are not politeness, they are scope. "Take handoff" grants read and report. "Take handoff and implement" grants change.
- If you leave the verb out you get the safe default - a read and a report - which is sometimes not what you wanted, and costs you a round trip.
- Being specific also gives the agent something precise to object to. Vagueness gets you silent compliance with the wrong thing.
- The verbs mean what they say across the whole tool: **write** appends a record, **create** starts a new container, **revise** changes a definition, **modify** edits in place (journal only), **save** snapshots state for restore, **set** moves a pointer. "Update" is the one word that routes by target, and is worth avoiding for that reason.

### 10. "Handoff" means three different things *(expanded, walk)*

Same word, three durable outcomes, and the surrounding verb is what picks one.

- **Take** a handoff: read an existing task and report.
- **Write** a handoff: author a record into the task you are in.
- **Handoff** alone, "hand this off," or "handoff to <agent>": asks whether to create a brand new task from the conversation. This is confirmation-gated because it is the one that surprises people.
- Taking a handoff is never itself permission to change anything - not code, not the task, not the log. Reading and reporting is the whole grant. If you want more than that, say so in the same breath: "take handoff and implement," not "take handoff" and a follow-up.
- A chained instruction runs every step in order, but has to end on a giving phrase to actually write a record. A chain that ends mid-action does the work and writes nothing down.
- **The direction is in the verb, not the object** *(walk)*. A handoff is the act of giving, so the bare word already names the giving side. Take (or Receive, or Get) names the receiving side, and every receiving phrase is an instruction to act. So "Take Handoff, Design Review" and "Take Handoff, Review Design" resolve the same way: you review. Word order on the object does not matter.
- **Outgoing phrases carry the kind; returning phrases do not** *(walk)*. A request has to say what it is asking for: "Handoff, Request Design Review" or "Handoff, Request Implementation Review." Handing a review back is "Handoff, Review Results," with no kind, because the record and the span already say which review it was. "Request" and "Results" are the two words doing real work on the giving side; a bare "Handoff, Design Review" is the one phrase not to lean on, since it could mean please review my design or here are my results.
- **The current-task pointer is a fallback, not the authority** *(walk)*. You can name the task in a take ("take the handoff for task 7"). When you do not, the agent resolves against the current-task pointer, and the pointer follows whatever task was last created, revised, or set, in any window. With two windows on two tasks, a bare "take handoff" can silently land on the other window's task. The agent's first line names the task it resolved; that line exists for exactly this case. See also the skill change under "Pending skill changes" below.

### 11. Your words become part of the record

- What you asked for is captured into the record and read by the next agent.
- So phrasing is not disposable. Saying what you actually mean pays twice.

### 12. How a request is built, with samples *(resolved, walk)*

Replaces the earlier "examples framed as illustrations" framing, which was prose about phrasing and left the reader assembling the grammar themselves. Structure first, then samples, then a pointer.

- **The structure.** A request is a verb (which direction, how much authority), an object (what kind of work), and an outcome. Present it as ordinary English, verb plus noun, because that is what it is.
- **The samples.** The round trip a user does all day, three lines, verbatim: *"Handoff, Request Design Review"* going out; *"Take Handoff, Design Review"* to act on it; *"Handoff, Review Results"* coming back. Then the same three with Implementation in place of Design. That is the whole pattern; the reader has it after six lines.
- **The pointer.** For the complete set, link to the handoff grid where it lives in the guide. Do not repeat the grid here; the section is the structure and the samples, the grid is the reference.
- **What is guaranteed and what resolves.** Two operations have an anchored minimum in the skill: handoff (the forms above) and save context ("save context," "restore context," and a few siblings). Those are shown as reliable as written. Everything else resolves by meaning, and the guide varies its phrasings deliberately so nobody reads them as a required vocabulary. The guide promises no anchored forms for any other operation, because nothing implements them. Whether the skill should grow more anchored sets is a skill decision, not a guide one; it is recorded under "Pending skill changes," not as an open question here.

---

## Part 4 - What you can ask for

One short section each, in the order a user meets them. Every section answers the same four questions: when do I want this, what do I say, what happens, what should I watch out for. Where a section is the home of an overview bullet, it opens by echoing that bullet.

- **Starting a session / loading memory** - what the receipt means, and why the agent should not then go rummaging. The receipt also reports how many task-log records on the current task you have not read yet; the agent is told not to open them on its own, so if you want them read, say so.
- **Saving and restoring context** *(home of "Save context whenever you want, and it restores automatically")* - saving is something you ask for, before a compaction, a clear, or a restart. Restoring is not something you ask for at all: the next refresh, including the one a hook runs after an automatic compaction, picks it up and the file is consumed. That hook is why "automatically" is true; say so. If the saved context has gone stale, the agent stops and asks you to restore or discard it by name. Saved context belongs to the agent that saved it, for that agent after it loses context. It is not tied to a task; you may well have been mid-task when you saved, so the task will dominate the content, but that is content, not ownership. It is not a handoff to another agent; that is a task log. One saved context per agent: saving again replaces the last one.
- **Creating a task** *(home, with the next item, of "Work organized as tasks, each with its own blueprint")* - when work needs continuity, review, or more than one agent.
- **Switching the current task** - and a sentence on what the pointer does and does not do for a second window (section 10).
- **Revising a task's definition** - title, priority, source, context, or acceptance criteria change after work has already started. Distinct from the item below: this is the task record itself, not the plan inside it.
- **Designing and iterating** *(home of "One list, from design to done"; rewritten as a workflow, walk)* - the brainstorm and design stage. This was a capability list; it needs to be the rhythm, because the rhythm is the actual product and nothing else in the guide teaches it. The shape, from David's own practice:
  1. **Brainstorm with one agent.** Pick the agent you want as design lead (David uses Claude; it holds the bigger picture). Talk, by dictation if you like; multiple rounds; then ask for a summary and read it.
  2. **Items are born in the log.** "Add that to the design" appends a log entry with new numbered items. That is the whole mechanism: adding a numbered item to the active list is how a design item comes into existence. The number is its identity from then on. Adding an item is the one ask an agent must get a yes to; silence means no item. The agent must also name the item in its reply, not only in the log.
  3. **The specification assembles them.** "Write the design spec" is a separate step that gathers every item into the specification alongside a narrative, done and active together, in one place. You can run an entire task without ever writing a spec; the active list is the same list either way. The spec earns its place when you want the fuller description, and David's preference is to have one.
  4. **The design loop.** "Handoff, Request Design Review" to the second window. The reviewer takes it and writes back "Handoff, Review Results." Back in the lead window, "Take Handoff, fold in results," discuss, and by then you usually agree the reviewer's gaps are real. Repeat until the reviewer stops complaining and calls it implementable; two or three rounds is normal.
  5. **Implement.** In the reviewer's window, "implement" instead of handing back. The implementer works against the agreed spec.
  6. **The implementation loop.** "Handoff, Request Implementation Review" back to the lead. The lead finds gaps, writes "Handoff, Review Results." The implementer verifies they are real, "Take Handoff, implement fixes," hands back for review again. Same loop as design, until everybody is happy.
  - Items are permanent once written, and the wording hardens later than you would guess.
  - Reopening an item is normal.
  - The narrative half of the specification has a plaintext copy in the task folder. You can edit that file directly and tell the agent to fold it in. It is the one memory file meant to be edited by hand; the agent regenerates it after every specification write, so edits go in before you ask, not after.
- **Taking a handoff** *(home, with the next item, of "Handoff seamlessly between agents")* - the agent's first line names the task it resolved and the purpose it is applying, so a wrong task or wrong review kind is visible before the deliverable. Say what you want back or you get a read-only report. A handoff on a closed task stops in one sentence: nothing to pick up. *(walk)* Name the task when two windows are on two tasks; a bare take resolves through the pointer, which the other window may have moved.
- **Writing a handoff** - the outgoing forms carry the kind; the returning form does not (section 10).
- **Writing a task log**
- **Closing and reopening a task** - close records whatever was still open at the time, and the agent's reply says so if there was any. Reopen surfaces that list but does not put it back into play; the first log entry after reopen has to say what is active again. Reopening is normal, not an admission anything failed.
- **Rules** *(home of "One set of rules, every agent follows")* - durable instructions that shape future behavior. A rule goes in the project unless you say global or user-level. The agent checks for an existing rule on the topic and merges rather than duplicates. The filename is the rule's one-line form and is read at every startup; the body is read when the rule applies.
- **Journal entries** - notes you want kept but that are not rules, tasks, or case studies. The one record you can ask to have edited after the fact.
- **Case studies** - successes, failures, and lessons worth carrying forward.
- **Finding things** - looking up a specific artifact or searching bodies. Unscoped means this project. Say global (or user, or root) for your user-level memory, parent for the project above, all or layered for everything in the chain. Sibling projects are never searched unless you name them.
- **Recalling a prior conversation** *(home of the second half of "Persistent memory across agents and sessions")* - "when did we talk about X," "did we ever discuss Y," "find the conversation where we decided Z." This searches the actual provider transcripts, not the records agents wrote, so it finds the nuance the record left out. Three scopes: this task, this project, every project; the agent uses the one you stated and asks only if you gave none. Phrasing decides how far it looks: "when did we" stops at the first match, "every time we" sweeps everything. The narrower form, "where did we discuss X on this task" or "give me the chat paths for this task," is the same thing scoped to one task.

---

## Part 5 - Putting it together

### 13. A worked example *(decided, walk)*

Constructed, not a real session. David's call. A real session would carry domain noise the reader has to see past; a constructed one can be checked line by line against the references so it cannot show anything the software would not produce. Guardrails:

- **Multi-window by default.** Two windows, two providers, every turn labeled with which agent said it, so the switching is visible. The switching is the content. Single-agent use gets one sentence in section 1 and no walkthrough.
- **A small, dull task.** A config change or similar, so nothing hinges on the domain and the reader watches the choreography, not the code.
- **One moment of friction.** The reviewer catches something real. That is the thesis of the tool; an example where both agents agree on everything teaches nothing.
- **Checked against the references** before it is called finished.

The illustration is the article's beginner flow table, reused, with a vocabulary pass: the choreography (create task, hand off, review, implement, cross-review, verify, close) is unchanged since the article; what changed is the dialogue lines and the design-item mechanics. Swap in the anchored phrasings from section 12 and update the design-item portion to match "Designing and iterating." The article's second table (two tasks in flight, filling gaps) stays in the article; that is an article argument, not a first-time reader's need. The same vocabulary pass serves the article rewrite, so do the guide's version first.

Beats, unchanged: create the task from a conversation; design discussion, items proposed and approved; switch windows, take the handoff, implement; switch back, take the handoff, review; a reopened item, because that is normal and users should see it once; close.

### 14. When something goes wrong

- The agent did more than you wanted: changes are reviewable, records are append-only.
- The agent did less than you wanted: usually a missing verb.
- It keeps asking permission: configuration, not normal.
- A write halted: what the refusal is protecting.
- Something looks stale or wrong in a record: the fix is a new record, not an edit.
- **Two agents wrote to the same task at the same time** - the second write is refused, not silently lost or corrupted; re-read and retry. There is no fixed limit on how many agents can work one task at once - the refusal itself is the safety net, not a seat count.
- **The take landed on the wrong task** *(walk)* - two windows, two tasks, and a bare "take handoff" resolved through the pointer the other window moved. The first line of the reply is where you catch it. Name the task and take again.
- **Refresh failed.** The agent must say what failed and must not carry on with half-loaded memory. Usual causes: Node missing or too old, output cut off, the agent ran refresh from the wrong folder. `M-PACT: no memory root here; refresh skipped` is not a failure; it is what you get after declining project setup.
- **You moved, renamed, or copied the project.** The next write stops and asks whether this location is intended. The old location cannot be recovered from what is on disk, so this is a question only you can answer. Yes gives the project a fresh identity in its new home.
- **Saved context could not be handled.** Refresh fails outright rather than skip a saved context silently when it cannot tell which agent is starting. Rare; the fix is on the agent side, and the failure message names it.
- **The agent announced a repair you did not ask for.** A specification member had lost its paired log record and the agent wrote a derived one. This is announced, not asked, because there is nothing to approve; it is the tool making a gap visible.

---

## Pending skill changes surfaced by the guide *(new, walk; updated 2026-09-07)*

Writing the guide keeps finding places where the references are correct but the behavior has a gap or the text is unreadable. These are skill work, not guide work, and the guide cannot describe the unresolved ones until they exist. Each unresolved one wants a design item on the M-PACT project.

1. **Prompt on a pointer mismatch, take side only.** Today a bare "take handoff" resolves silently through the current-task pointer, and with two windows on two tasks the pointer may have been moved by the other window. Nothing compares the task the agent has been working in against the pointer. Change: on an unnamed take, when the agent has a working task in context that differs from the pointer, ask one line ("you've been on t0045, the pointer says t0046, which did you want?") before resolving. A named take never asks. Writes never ask; the agent's context already fixes the task and there is nothing to disambiguate. The requesting instruction may or may not name a task, so the guard keys off the absence.
2. **The handoff vocabulary as a grid.** `take-task-handoff.md` bakes the anchored forms into full phrases in one table cell, so the grammar underneath is invisible; you cannot see that the verb carries direction and the object carries kind. Rewrite as a pick-one-from-each grid, three columns (phrase, object, what happens), in two blocks (giving, taking) because the second columns are not interchangeable between them.
3. **Whether other operations get anchored phrasings.** Moved here from the open questions. The guide promises none; adding any is a skill decision. `[0002-decide-whether-phrasings-are-anchored]`.

Retired 2026-09-14, for the record:

- **The browser `help` entry.** The `M-PACT help` / quick-reference renderer was removed after cross-provider browser launch behavior proved unreliable and too distracting for the value it provided.

---

## Open questions

- **Whether `write-task-spec.js` is deleted or documented.** Still an unresolved tombstone - present in `scripts/`, referenced by zero files in `references/` or `SKILL.md`, redirects callers to `write-design-spec` and exits. Doesn't block writing the guide (it's not user-facing either way) but should be decided before the guide ships, since documenting a name that's slated for deletion is wasted work. `[0003-decide-the-fate-of-write-task-spec]`.

Closed 2026-09-06 (walk), for the record:

- **Where the capability list lives.** In the guide source, not in a generated browser-help surface.
- **Whether operations other than handoff and save-context get anchored phrasings.** Not a guide question. (Pending skill change 3.)
- **Whether this outline ships.** No.
- **Ordering of Parts 2 and 3.** Setup first stands; the capability overview after section 2 already gives the reader the capability view before setup.
- **Whether the section shape extends to Parts 1 and 5.** Nothing there to intersperse; stays scoped.

---

## What changed this pass (2026-09-06 walk discussion)

Dictated, after the reference audit the same day. Nothing here came from reading references; it came from checking the outline against the overview, the four articles, and David's actual working pattern.

**Reframed** - section 1 leads with the multi-provider case; memory is the enabler, not the product. The overview document becomes section 1 verbatim, and its full text is now built into this outline so the outline carries the words rather than pointing at the file. The same text opens the repo README; one file, copied into both. Section 2 reordered to match. Windows named as the unit, multi-provider as the intended shape.

**Added** - the overview-as-contract table: all eight bullets mapped to home sections, each section to echo its bullet. The eighth bullet ("Also capture everything that isn't a task") was unreadable during the walk and confirmed at the desk. Overview bullet reorder: save-context moves from sixth to third.

**Added** - backstory budget: two or three sentences of origin in section 1, one paragraph on the trust failure in section 3; everything else links out. Section 3 also gains the bargain-first disclaimer, the deal-with-the-devil analogy, the literal-compliance and salience observation, and rare-is-not-safe.

**Expanded** - section 5 with the user-global shim paths, the marked-block behavior, and the install-versus-setup distinction. Section 8 with why-then-how on retained memory, the zip-and-plain-text framing, the deletion paths, the irreversibility warning, and the fact that there is no "remove" operation.

**Expanded** - section 10 with the verb-carries-direction rule, outgoing-carries-kind rule, and the pointer-as-fallback rule. Section 12 rewritten as structure, samples, pointer. "Designing and iterating" rewritten as the six-step workflow.

**Decided** - the worked example is constructed, multi-window with agent labels, small dull task, one friction moment, checked against references; the article's beginner table reused with a vocabulary pass.

**Decided** - words: "coding tool," not "skill" or "harness." Form: markdown only, linkable table of contents, lives in `docs/`.

**Closed** - five open questions (capability list, anchoring, outline shipping, Parts 2/3 order, section-shape extension). One remains.

**Surfaced** - four skill changes, in their own section, so the guide does not describe behavior that does not exist yet. The browser help entry later landed and was retired; the other three remain pending.

---

## What changed on the help retirement (2026-09-14)

**Retired** - the browser help entry is no longer part of M-PACT. Agents should not advertise `M-PACT help`, `M-PACT quick reference`, `M-PACT guide`, or `M-PACT reference guide` as commands that render and open HTML.

**Corrected** - the anchoring paragraph in section 12 now names only handoff and save-context as implemented anchored surfaces.

**Clarified** - the Markdown-only form decision governs the guide source. There is no generated HTML guide to maintain or launch.

---

## What changed on the earlier pass (2026-09-06 reference audit)

A read of every file in `references/` (27), plus `SKILL.md` and `README.md`, checked against this outline. Scripts were not read; the references are the behavior contract. Full findings in `M-PACT_REFERENCE_AUDIT.md`.

**Corrected** - saved context does not belong to a task. `context-save-restore.md` says it lives in the root scratch folder, is not tied to a task, and needs no current task. Part 4 bullet rewritten.

**Corrected** - the mental model's "never erased" now names the journal as the one editable record, per `write-journal-entry.md`.

**Corrected** - section 12's anchoring question was stale. `take-task-handoff.md` and `context-save-restore.md` already anchor a guaranteed minimum. The question now applies only to the other operations.

**Added** - "Recalling a prior conversation" as a Part 4 section. `search-agent-sessions.md` and `list-agent-session-paths.md` had no home in the outline at all.

**Added** - adoption (section 7) and identity repair (section 14). Both are questions the user must answer, which the guide cannot skip.

**Added** - startup hooks and what they mean for the user: refresh on its own, restore after automatic compaction, the Codex `/hooks` trust step, and the hook output label. Sections 5, 6, and the save/restore bullet.

**Added** - suppression as a fourth state in section 8; refresh failure, unhandled saved context, and repair announcements in section 14; lookup scope words in "Finding things" and "Rules"; close and reopen consequences; the editable `specification.md` mirror; the design-item approval rule; provider transcript trailhead behavior; starter rules and the scratch folder among things that appear.

**Reframed** - section 7's nesting "trap." Nesting is the memory chain working as designed; the trap is an unrelated project inside another's tree.

**Decided** - the per-section shape: prose, then each reference term interspersed with its own example. Recorded under "Voice and scope."

**Confirmed unchanged** - sections 1, 3, 4, 9 through 11, 13, and the five-part structure. The disable/enable/uninstall content in section 8 matched `install-mpact.md` and `uninstall-mpact.md` exactly. The concurrency correction from 2026-08-19 still holds.

---

## What changed on the previous pass (2026-08-19 audit)

Kept for history. A full read of `scripts/` (28 files) and `references/` (25 files) plus `SKILL.md` and `README.md`, diffed against this outline and the 2026-08-07 design discussion it came from.

**Correction, not addition** - the 2026-08-07 discussion recorded "a task supports two agents, named by its two role seats," as a documented-but-unenforced limit. That is no longer accurate: role seats are retired descriptive metadata, and no helper gates writes on them. What actually happens when two agents work one task at once is an optimistic-concurrency refusal - the second writer is bounced and re-reads - which is a stronger and simpler thing to teach than a seat count. Reflected in section 13's aside and the bullet in section 14. This same correction applies to `USER_GUIDE_FUNCTIONS.md` category K (concurrency) and should be carried there too.

**Added** - the disable/enable/uninstall lifecycle (`install-mpact.js --disable`/`--enable`, `uninstall-mpact.js`) did not exist in the codebase this outline was drafted against. Section 8. `USER_GUIDE_FUNCTIONS.md` section A already lists `uninstall-mpact.js`, so the functional inventory was ahead of this outline on that point.

**Added** - revising a task's own definition (`revise-task.js`: title/priority/source/context/acceptance) had no slot in Part 4; only revising the design specification did. New bullet, kept distinct from the design-spec item since they're different containers.

**Resolved, not just corrected** - the "Gemini revalidation" open question from the 2026-08-07 draft is closed by the codebase itself: Gemini CLI is confirmed retired (README states it outright), Antigravity replaced it as a first-class target, and Copilot CLI is documented as best-effort/unvalidated. Section 4 states this as settled.

**Confirmed unchanged at the time** - the quick-reference-as-on-demand-helper-output idea was still purely a plan; nothing in that codebase implemented it. It was later implemented, then retired on 2026-09-14. The voice/scope framing, the disclaimer in section 3, the handoff-verb grammar in section 10 (apart from the added mutation-gate bullet), and the overall five-part structure all held up against the current code without needing correction.
