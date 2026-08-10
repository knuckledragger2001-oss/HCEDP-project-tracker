<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Every user-facing change ships with a "What's new" entry

The in-app "What's new" popup is the only way users are told what changed, and
it is driven entirely by `src/lib/changelog.ts`. So every change a user could
notice — a new feature, a changed workflow, a visible fix — MUST add a changelog
entry as part of the same change, before it ships. This is not optional; a
user-facing change is not complete without its entry.

To add one, put a new object at the TOP of `CHANGELOG` (newest first) with a
fresh, unique `version` (we use `YYYY.MM.DD`, suffixed `-2`, `-3` for a second
release on the same day). Write each item for a non-technical reader: what
changed and why it helps them. The popup is shown to internal staff only, so
frame entries for that audience. Purely internal refactors with no visible
effect don't need an entry — when in doubt, add one.
