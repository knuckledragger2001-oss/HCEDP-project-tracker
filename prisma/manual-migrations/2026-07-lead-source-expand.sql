-- Lead-source enum expansion (Stage 2, 2026-07) — OPTIONAL FUTURE CLEANUP.
--
-- The `LeadSource` enum gained the 6 new DIRECT_* values. The old `DIRECT` and
-- `OTHER` values were DELIBERATELY KEPT in the schema so the deploy is purely
-- additive: `prisma db push` (the Railway preDeployCommand) applies it with no
-- data-loss flag and no manual step. Old rows keep their value and display as
-- "Direct (legacy)" / "Other (legacy)"; the two legacy values are just hidden
-- from the pick lists (see LEAD_SOURCE_LABELS in src/lib/format.ts).
--
-- You do NOT need to run anything to deploy. This script is only for LATER, if
-- you want to fully retire DIRECT/OTHER once existing rows are remapped.
--
-- To retire them:
--   1. Run the remap below against the production database.
--   2. Remove the `DIRECT` and `OTHER` members from enum LeadSource in
--      prisma/schema.prisma AND from LeadSourceEnum in src/lib/anthropic/schema.ts.
--   3. Deploy. Because rows no longer use them, they can be dropped — but plain
--      `db push` still refuses enum-value removal, so either run a one-off
--      `prisma db push --accept-data-loss` against prod, or add that flag to the
--      preDeployCommand for that single deploy.

UPDATE "Project" SET "leadSource" = 'DIRECT_COMPANY' WHERE "leadSource" = 'DIRECT';
UPDATE "Project" SET "leadSource" = 'DIRECT_OTHER'   WHERE "leadSource" = 'OTHER';
