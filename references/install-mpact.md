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
- `--force-shims true` replaces provider-global startup shims instead of preserving existing M-PACT shims.
- `--home <path>` targets a non-default user home when explicitly needed.
- `--user-root <path>` targets a non-default M-PACT user root when explicitly needed.

Do not create a project `.AgentMemory/` during install. Project setup is a separate operation handled by `references/bootstrap-project.md`.

If a provider-global shim already exists and does not mention M-PACT, the helper appends the M-PACT shim while preserving existing content. If it already mentions M-PACT, the helper leaves it unchanged unless `--force-shims true` is supplied.

The helper prints a short activation note. The installing agent should treat M-PACT runtime setup as complete immediately in the current session. Other already-open sessions may still need a provider-specific reload or a new session before they see shim changes.
