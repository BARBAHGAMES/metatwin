-- Indexes for the onboarding foreign keys flagged by the performance advisor
-- (twins.city_id -> kenya_cities, twins.university_id -> universities).
create index if not exists twins_city_id_idx on public.twins (city_id);
create index if not exists twins_university_id_idx on public.twins (university_id);
