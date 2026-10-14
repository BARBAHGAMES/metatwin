-- Minimal stand-ins for the Supabase-managed pieces (auth, storage, vault, roles)
-- the MetaTwin migrations depend on. LOCAL VERIFICATION ONLY: loaded into a
-- throwaway in-memory PGlite database by harness.mjs, never into a real database.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;

create schema if not exists extensions;
create schema auth;
create schema storage;
create schema vault;
create schema supabase_migrations;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- Supabase's default privileges: new public tables/functions are open to the API roles.
-- (Migration 20261011072859 later revokes these defaults, exactly as on the real project.)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  aud text, role text,
  email text unique,
  phone text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- storage
create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(), metadata jsonb
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- vault
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default null)
returns uuid language sql as $$ insert into vault.secrets(name, secret) values (new_name, new_secret) returning id $$;
insert into vault.secrets(name, secret) values ('metatwin_webhook_secret', 'local-test-secret');

-- supabase_migrations
create table supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);
