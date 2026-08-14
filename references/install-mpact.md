# Install M-PACT

Use this reference when the Director asks to install or configure M-PACT runtime setup.

Installing M-PACT is a user-level runtime setup operation for one provider at a time. It is separate from provider skill placement and project bootstrap.

Place the M-PACT folder in each provider's own skill root first, then run this helper from that provider's installed copy. The helper does not copy this package into Codex, Claude, Antigravity, or other provider roots.

Run from the M-PACT package root:

```bash
node scripts/install-mpact.js
```

By default, the helper:

- creates or preserves `.AgentMemoryRoot/`;
- creates or preserves the zero-byte `.AgentMemoryRoot/project-count__<n>` identity counter, starting at `project-count__0` on fresh installs;
- installs bundled starter core rules into `.AgentMemoryRoot/rules/` without overwriting existing rule files;
- installs only the current provider's global startup shim when the provider can be inferred from the installed skill location;
- for Codex installs, merges a `SessionStart` hook into `~/.codex/hooks.json` (matcher `startup|clear|compact`) that runs `build-refresh-bundle.js --hook` from the installed skill and injects its stdout as startup context. The hook write is blocked when the installed refresh script is missing at `~/.codex/skills/m-pact/scripts/build-refresh-bundle.js`, so a source checkout without an installed copy never writes a dead hook. Codex may load other user, project, config, or plugin hooks beside this one; M-PACT manages only its user-level `hooks.json` entry. Codex requires non-managed command hooks to be reviewed and trusted through `/hooks`, and the install receipt surfaces that step.
- for Claude installs, merges a `SessionStart` hook into `~/.claude/settings.json` (matcher `startup|clear|compact`) that runs `build-refresh-bundle.js --hook` from the installed skill and injects its stdout as startup context, and grants read access to the user root through `permissions.additionalDirectories`. The hook write is blocked when the installed refresh script is missing at `~/.claude/skills/m-pact/scripts/build-refresh-bundle.js`, so a source checkout without an installed copy never writes a dead hook.
- for Antigravity installs, merges a named `PreInvocation` hook into `~/.gemini/config/hooks.json` that runs `antigravity-refresh-hook.js` from the installed skill and injects refresh output as transient context, writes the backstop shim to `~/.gemini/GEMINI.md`, and grants read/write access to the user root through `~/.gemini/antigravity-cli/settings.json` when that settings file is absent or has the documented shape. The hook write is blocked when the installed wrapper script is missing at `~/.gemini/config/skills/m-pact/scripts/antigravity-refresh-hook.js`.

User-root creation has three entry points that must stay consistent: this helper, `bootstrap-project.js --init-user-root`, and refresh's provider runtime setup mechanics.

Provider shim targets:

- Codex: `~/.codex/AGENTS.md`
- Claude: `~/.claude/CLAUDE.md`
- Antigravity: `~/.gemini/GEMINI.md`

Optional flags:

- `--provider codex|claude|antigravity` installs one provider-global shim when provider inference is not available or when an explicit provider is needed.
- `--providers codex,claude,antigravity` is accepted for explicit multi-provider shim setup, but normal provider installs should use a single provider.
- `--skip-starter-rules true` creates `.AgentMemoryRoot/` without starter rules.
- `--disable` removes the marked M-PACT shim block and M-PACT-owned hook entry from the detected or requested provider without touching installed skill directories or memory. For Codex and Claude, it removes the M-PACT `SessionStart` hook entry identified by its `build-refresh-bundle.js` command. For Antigravity, it removes only the named `m-pact-refresh` hook entry from the provider hooks file.
- `--enable` restores the shim and hook entries after a disable. It uses the same setup path as install.
- `--home <path>` targets provider files under a non-default user home when explicitly needed. It wins over provider environment variables for every selected provider. It does not isolate the M-PACT user root; pass `--user-root <path>` too when testing or installing against a non-default memory root.
- `--user-root <path>` targets a non-default M-PACT user root when explicitly needed.

Provider root resolution is per provider:

- Codex: `--home <path>/.codex`, then `CODEX_HOME`, then the default home `.codex`.
- Claude: `--home <path>/.claude`, then `CLAUDE_CONFIG_DIR`, then the default home `.claude`.
- Antigravity: `--home <path>/.gemini`, then the default home `.gemini`.

The receipt names each resolved provider root, the source that supplied it, and the concrete shim, hook or settings, and installed skill targets. The user root is named where setup touches it.

Do not create a project `.AgentMemory/` during install. Project setup is a separate operation handled by `references/bootstrap-project.md`.

Provider-global shims are written inside literal `BEGIN M-PACT SHIM` / `END M-PACT SHIM` markers. If a provider-global file already exists and has no marked M-PACT block, the helper appends the marked shim while preserving existing content. If exactly one marked block exists, the helper replaces only that block. If markers are malformed or duplicated, the helper reports the shim write as blocked instead of guessing.

The helper prints a short activation note. The installing agent should treat M-PACT runtime setup as complete immediately in the current session. Other already-open sessions may still need a provider-specific reload or a new session before they see shim changes.

`MPACT_SUPPRESS` remains a harness and launcher compatibility guard, not the ordinary user off switch. It is for hosts whose own memory or context machinery would conflict with M-PACT. Disable and enable run through this setup helper, so they keep the suppression gate and require that `MPACT_SUPPRESS` be unset. To remove M-PACT from a suppressed session, use `scripts/uninstall-mpact.js`; uninstall is deliberately exempt because it reads and writes no memory.

Uninstall also revokes the Claude and Antigravity provider permission entries that install added for the resolved M-PACT user root. When removing a non-default user root install, pass the same `--user-root <path>` or set `MPACT_USER_ROOT` so uninstall can identify the provider permission entries to remove.
