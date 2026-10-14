-- MetaTwin Basic paywall (KES 2,000/yr via M-Pesa). 'grandfathered' never
-- expires and is set once, below, for every twin that exists at the moment
-- this ships (the pilot cohort) — every signup after this point defaults to
-- 'unpaid' via the column default, no date-comparison logic needed anywhere
-- to tell "pilot" from "new."
alter table public.twins
  add column plan_status text not null default 'unpaid' check (plan_status in ('grandfathered', 'unpaid', 'paid')),
  add column plan_paid_until timestamptz;

update public.twins set plan_status = 'grandfathered';
