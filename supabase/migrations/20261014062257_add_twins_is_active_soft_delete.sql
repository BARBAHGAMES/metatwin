-- Soft-delete for a student profile, driven by a platform admin. Nothing is
-- destroyed — evidence/projects/competencies are untouched — so this is
-- fully reversible via reactivate_twin(). twins already carries a blanket
-- `grant select, insert, update, delete on public.twins to authenticated`
-- (no column list), so these new columns inherit it automatically — no
-- extra GRANT statement needed for check-grants.mjs to pass.
alter table public.twins
  add column is_active boolean not null default true,
  add column deactivated_at timestamptz;
