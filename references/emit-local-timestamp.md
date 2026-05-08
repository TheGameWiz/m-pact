# Emit Local Timestamp

Use whenever a memory artifact needs a local date, filename timestamp, body timestamp, or zone label.

## Command

From the project working directory, run:

```powershell
node scripts\emit-local-timestamp.js
```

If using an installed skill copy outside the repository, pass that installed `scripts/emit-local-timestamp.js` path to Node while staying in the project working directory.

## Output Fields

The helper prints ready-to-use fields:

```text
FilenameStamp: YYYY-MM-DD-HHMMSS-local-zone
BodyTimestamp: YYYY-MM-DD HH:MM:SS LOCAL-ZONE
Date: YYYY-MM-DD
Zone: LOCAL-ZONE
FilenameZone: local-zone
```

Use the relevant fields verbatim. Do not reformat, recompute, or call the clock again for the same artifact.

If Node.js is unavailable, use the fastest trusted host-provided local system time. Do not rely on internal model time.
