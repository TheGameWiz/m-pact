# Repair Project Identity

Use after a helper prints `M-PACT PROJECT IDENTITY REQUIRED` for a path mismatch or multiple project identity sentinels.

Repair is approval-gated when the notice asks a question. Ask the Director the question from stdout and stop until they answer yes. If they answer no, do not run repair.

Run:

```bash
node <this-skill>/scripts/repair-project-identity.js --root <project-or-.AgentMemory-root> --user-root <user-root>
```

Do not pass a project ID into the repair helper. The helper owns sentinel cleanup and ID minting under lock.

For a path mismatch, repair assigns a new project ID and writes the sentinel name for the current root. This is expected after a rename, and can also be appropriate after a move or copy.

For multiple sentinels, repair has two mechanical branches:

- If one sentinel name already matches the current root and its project ID is valid within the counter high-water mark, repair keeps that identity and removes the stray sentinels.
- If none matches the current root, repair removes the foreign sentinels and assigns a new project identity after Director approval.

The original location cannot be reconstructed from the sentinel name. The slug is lossy: it folds case and collapses non-alphanumeric runs. A human answer is required when the notice asks whether the current location is intended.
