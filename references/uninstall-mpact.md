# Uninstall M-PACT

Use this reference when the Director asks to uninstall M-PACT runtime integration.

Uninstall removes provider startup integration and installed M-PACT skill directories. It never deletes memory.

Run from outside any installed M-PACT skill directory:

```bash
node scripts/uninstall-mpact.js
```

By default, the helper targets Codex, Claude, and Antigravity. Use `--provider codex|claude|antigravity` or `--providers codex,claude,antigravity` only when deliberately narrowing the uninstall.

The helper removes:

- the marked M-PACT shim block from the provider-global instruction file;
- the M-PACT-owned hook entry from the provider hook or settings file;
- the Claude `permissions.additionalDirectories` entry and Antigravity `permissions.allow` read/write rules that name the resolved M-PACT user root;
- the installed provider skill directory.

Provider targets:

- Codex: shim `AGENTS.md`, hook `hooks.json`, skill `skills/m-pact` under the resolved Codex root.
- Claude: shim `CLAUDE.md`, hook and permissions `settings.json`, skill `skills/m-pact` under the resolved Claude config root.
- Antigravity: shim `GEMINI.md`, hook `config/hooks.json`, permissions `antigravity-cli/settings.json`, skill `config/skills/m-pact` under the resolved `.gemini` root.

Provider root resolution is the same seam used by install, disable, and enable:

- Codex: `--home <path>/.codex`, then `CODEX_HOME`, then the default home `.codex`.
- Claude: `--home <path>/.claude`, then `CLAUDE_CONFIG_DIR`, then the default home `.claude`.
- Antigravity: `--home <path>/.gemini`, then the default home `.gemini`.

The receipt names each resolved provider root, the source that supplied it, and the concrete targets acted on. It also states that memory was not touched.

Permission revocation uses the resolved M-PACT user root. Pass `--user-root <path>` when uninstalling an install that used a non-default user root. Without `--user-root`, uninstall uses the shared default user-root resolver: `MPACT_USER_ROOT` when set, otherwise the default home `.AgentMemoryRoot`. The receipt names the resolved user root and whether it came from `--user-root`, `MPACT_USER_ROOT`, or the default.

Uninstall preserves unrelated provider settings. It is idempotent when the M-PACT permission entries are absent. If a provider settings file exists but the relevant JSON shape is malformed, uninstall reports the provider cleanup as blocked and does not delete that provider's installed skill directory until the settings file is repaired.

The uninstaller refuses to run when the process working directory is the same as or inside any installed skill directory it would delete. Move to another directory and rerun the command.

`MPACT_SUPPRESS` does not block uninstall. Suppression is a harness and launcher compatibility guard for sessions where another host owns context; uninstall reads and writes no memory and remains available as an off-ramp.

Deleting memory is separate and manual. To delete M-PACT data, remove `.AgentMemoryRoot/` and any project `.AgentMemory/` folders yourself. Leave provider homes such as `.codex/`, `.claude/`, and `.gemini/` alone unless you intend to remove other provider configuration too.
