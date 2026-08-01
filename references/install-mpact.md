# Install M-PACT

Use this reference when the Director asks to install or configure M-PACT runtime setup.

Installing M-PACT is a user-level runtime setup operation for one provider at a time. It is separate from provider skill placement and project bootstrap.

Install or place the M-PACT folder separately for each provider you want to use. Then run this helper from that provider's installed M-PACT copy.

Run from the M-PACT package root:

```bash
node scripts/install-mpact.js
```

By default, the helper:

- creates or preserves `.AgentMemoryRoot/`;
- creates or preserves the zero-byte `.AgentMemoryRoot/project-count__<n>` identity counter, starting at `project-count__0` on fresh installs;
- installs bundled starter core rules into `.AgentMemoryRoot/rules/` without overwriting existing rule files;
- installs only the current provider's global startup shim when the provider can be inferred from the installed skill location.

Normal skill installation should place the M-PACT folder in the provider's own skill or extension root before this helper runs. The helper does not copy this package into Codex, Claude, Gemini, or other provider roots.

Provider shim targets:

- Codex: `~/.codex/AGENTS.md`
- Claude: `~/.claude/CLAUDE.md`
- Gemini: `~/.gemini/GEMINI.md`

Optional flags:

- `--provider codex|claude|gemini` installs one provider-global shim when provider inference is not available or when an explicit provider is needed.
- `--providers codex,claude,gemini` is accepted for explicit multi-provider shim setup, but normal provider installs should use a single provider.
- `--skip-starter-rules true` creates `.AgentMemoryRoot/` without starter rules.
- `--remove-shims` removes the marked M-PACT shim block from the detected or requested provider config without touching other content. With no `--provider`, removal targets only the detected installed provider; from a source checkout, detection normally finds no provider and removes nothing.
- `--home <path>` targets provider shim files under a non-default home when explicitly needed. It does not isolate the M-PACT user root; pass `--user-root <path>` too when testing or installing against a non-default memory root.
- `--user-root <path>` targets a non-default M-PACT user root when explicitly needed.

Do not create a project `.AgentMemory/` during install. Project setup is a separate operation handled by `references/bootstrap-project.md`.

Provider-global shims are written inside literal `BEGIN M-PACT SHIM` / `END M-PACT SHIM` markers. If a provider-global file already exists and has no marked M-PACT block, the helper appends the marked shim while preserving existing content. If exactly one marked block exists, the helper replaces only that block. If markers are malformed or duplicated, the helper reports the shim write as blocked instead of guessing.

The helper prints a short activation note. The installing agent should treat M-PACT runtime setup as complete immediately in the current session. Other already-open sessions may still need a provider-specific reload or a new session before they see shim changes.
