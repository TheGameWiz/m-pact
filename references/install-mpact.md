# Install M-PACT

Use this reference when the Director asks to install or sync M-PACT globally.

Installing M-PACT is a user-level provider setup operation. It is separate from project bootstrap.

Run from the M-PACT package root:

```bash
node scripts/install-mpact.js
```

By default, the helper:

- creates or preserves `.AgentMemoryRoot/`;
- installs bundled starter core rules into `.AgentMemoryRoot/rules/` without overwriting existing rule files;
- syncs the package to provider install targets:
  - `~/.codex/skills/m-pact/`
  - `~/.claude/skills/m-pact/`
  - `~/.gemini/extensions/m-pact/`
- installs provider-global startup shims:
  - `~/.codex/AGENTS.md`
  - `~/.claude/CLAUDE.md`
  - `~/.gemini/GEMINI.md`

Optional flags:

- `--providers codex,claude,gemini` limits provider targets.
- `--skip-starter-rules true` creates `.AgentMemoryRoot/` without starter rules.
- `--force-shims true` replaces provider-global startup shims instead of preserving existing M-PACT shims.
- `--home <path>` targets a non-default user home when explicitly needed.
- `--user-root <path>` targets a non-default M-PACT user root when explicitly needed.

Do not create a project `.AgentMemory/` during install. Project setup is a separate operation handled by `references/bootstrap-project.md`.

If a provider-global shim already exists and does not mention M-PACT, the helper appends the M-PACT shim while preserving existing content. If it already mentions M-PACT, the helper leaves it unchanged unless `--force-shims true` is supplied.

The helper prints a short activation note. The installing agent should treat M-PACT as globally installed immediately in the current session. Other already-open sessions may still need a provider-specific reload or a new session before they see the global shim.
