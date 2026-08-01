# Adopt Project Identity

Use this only after refresh or a durable write helper reports `M-PACT PROJECT ADOPTION REQUIRED` and the Director answers yes.

Adoption is lazy confirmed: it applies only to the one encountered project root, and it mints identity only after the Director approves. It is not a sweep, scan, migration, or sibling-project operation.

## Procedure

1. Run `scripts/adopt-project-identity.js` from the invoked M-PACT skill folder. Pass `--root <path-to-.AgentMemory>` when the adoption notice named a target other than the current active root.
2. Verify the helper reports `OK: adopt-project-identity`, the adopted `rootPath`, and the assigned `projectId`.
3. Run refresh again so the project ID enters the receipt.
4. Retry the original durable write only after refresh supplies the project ID, passing it as `--project-id <n>`.

Do not pass a project ID into the adoption helper. The helper mints from the user-root counter and writes the sentinel under lock. If the Director answers no, do not run the helper; reads can continue, but durable writes to that root will keep halting for adoption.
