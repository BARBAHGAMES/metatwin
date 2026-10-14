-- Which tier an individually-paying student bought (Basic/Guided/Builder).
-- Doesn't gate anything differently today — nothing differentiates the
-- tiers feature-wise yet (see pricing.ts's "proposed"/"planned" tags) —
-- it's a label for what they bought, shown back to them on PaywallGate/dashboard.
alter table public.twins
  add column plan_tier text not null default 'basic' check (plan_tier in ('basic', 'guided', 'builder'));
