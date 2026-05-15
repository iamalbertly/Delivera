# README Migration Map

This map records how the previous `README.md` content was deduplicated into focused docs.

## Keep in README (Lean Index)

- Project overview and core surfaces
- Quickstart and local run commands
- Auth mode summary
- Common scripts (only commands that exist in `package.json`)
- Pointers to SSOT docs (`TESTING.md`, `public/css/README.md`, `context.md`)

## Move Out of README

- Dated reliability/UX update logs -> `docs/release-notes.md`
- Full API endpoint contracts and payloads -> `docs/api-reference.md`
- Full troubleshooting matrix -> `docs/troubleshooting.md`
- Full environment mode/variable matrix -> `docs/environment.md`
- Deployment deep details -> `docs/deployment.md`

## Remove from README (Obsolete/Redundant)

- Repeated "Latest Reliability and UX Updates" blocks
- Legacy or nonexistent test command examples
- Duplicate testing internals already owned by `TESTING.md`
- CSS build/check internals already owned by `public/css/README.md`

## Cross-Link Rules

- README links to focused docs instead of restating details.
- Testing behavior is documented once in `TESTING.md`.
- CSS source/build contract is documented once in `public/css/README.md`.
- Architecture/state and SSOT boundaries are tracked in `context.md`.
