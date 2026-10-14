create table public.payments (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.twins(id) on delete cascade,
  phone text not null,
  amount numeric not null,
  mpesa_merchant_request_id text not null,
  mpesa_checkout_request_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  mpesa_receipt_number text,
  result_desc text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;
-- RLS enabled, zero client policies — same lockdown as pitch_scores/project_grades.
-- All reads/writes go through server routes using supabaseAdmin (service
-- role), never a direct client query. No anon/authenticated grants at all.
