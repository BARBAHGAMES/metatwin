-- P2-8 (part 2, reconstruction): backfill public.skills.slug for the 8 seeded
-- skills, ahead of skill_slugs_constraints making the column required+unique.
-- NOTE: this file is a reconstruction. The original statement was applied
-- live via execute_sql (not apply_migration) by a separate session without
-- local disk access, so the exact original SQL text was never captured --
-- supabase_migrations.schema_migrations only stored a placeholder note for
-- this version. The UPDATE below reproduces the resulting state exactly as
-- verified against the live skills table (name -> slug for all 8 rows), and
-- is idempotent (WHERE slug IS NULL), so applying it is a safe no-op against
-- the already-backfilled live database.
update public.skills set slug = 'react-development' where name = 'React App Development' and slug is null;
update public.skills set slug = 'visual-design' where name = 'Visual & Interface Design' and slug is null;
update public.skills set slug = '3d-modelling' where name = '3D Modelling' and slug is null;
update public.skills set slug = 'sustainable-materials' where name = 'Sustainable Materials' and slug is null;
update public.skills set slug = 'systems-thinking' where name = 'Systems Thinking' and slug is null;
update public.skills set slug = 'team-facilitation' where name = 'Team Facilitation' and slug is null;
update public.skills set slug = 'technical-writing' where name = 'Technical Writing' and slug is null;
update public.skills set slug = 'user-research' where name = 'User Research' and slug is null;
