-- P3: richer onboarding profile. New reference tables for structured
-- location/university pickers, plus new twins columns for first/last name,
-- location, education status, and a short bio. Existing free-text
-- institution/programme/name columns are kept as-is (every existing
-- consumer -- get_public_profile, profile.tsx, dashboard.tsx -- keeps
-- working unchanged); the structured FKs are additive, denormalized into
-- institution/name when set from the new onboarding picker.

create table public.kenya_cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text
);

alter table public.kenya_cities enable row level security;
alter table public.universities enable row level security;

create policy "kenya_cities: anyone can read" on public.kenya_cities for select using (true);
create policy "universities: anyone can read" on public.universities for select using (true);

grant select on public.kenya_cities, public.universities to anon, authenticated;

insert into public.kenya_cities (name) values
  ('Nairobi'), ('Mombasa'), ('Kisumu'), ('Nakuru'), ('Eldoret'), ('Thika'), ('Kiambu'),
  ('Machakos'), ('Meru'), ('Nyeri'), ('Kakamega'), ('Kisii'), ('Malindi'), ('Garissa'),
  ('Kitale'), ('Embu'), ('Migori'), ('Homa Bay'), ('Naivasha'), ('Kericho'), ('Kitui'),
  ('Bungoma'), ('Busia'), ('Nyahururu'), ('Kerugoya'), ('Kilifi'), ('Lamu'), ('Isiolo'),
  ('Wajir'), ('Marsabit'), ('Voi'), ('Mandera'), ('Narok'), ('Kapenguria'), ('Bomet'),
  ('Siaya'), ('Vihiga'), ('Nanyuki'), ('Ruiru'), ('Juja'), ('Athi River'), ('Ongata Rongai'),
  ('Limuru'), ('Kapsabet'), ('Maralal'), ('Kitengela');

-- Mount Kenya University listed first, per product requirement.
insert into public.universities (name, location) values
  ('Mount Kenya University', 'Thika'),
  ('University of Nairobi', 'Nairobi'),
  ('Kenyatta University', 'Nairobi'),
  ('Jomo Kenyatta University of Agriculture and Technology', 'Juja'),
  ('Moi University', 'Eldoret'),
  ('Egerton University', 'Njoro'),
  ('Maseno University', 'Maseno'),
  ('Strathmore University', 'Nairobi'),
  ('United States International University Africa', 'Nairobi'),
  ('Technical University of Kenya', 'Nairobi'),
  ('Technical University of Mombasa', 'Mombasa'),
  ('Multimedia University of Kenya', 'Nairobi'),
  ('Dedan Kimathi University of Technology', 'Nyeri'),
  ('Masinde Muliro University of Science and Technology', 'Kakamega'),
  ('South Eastern Kenya University', 'Kitui'),
  ('Pwani University', 'Kilifi'),
  ('Kabarak University', 'Nakuru'),
  ('Daystar University', 'Nairobi'),
  ('KCA University', 'Nairobi'),
  ('Africa Nazarene University', 'Nairobi'),
  ('Chuka University', 'Chuka'),
  ('Laikipia University', 'Nyahururu'),
  ('Karatina University', 'Karatina'),
  ('Kisii University', 'Kisii'),
  ('Rongo University', 'Rongo'),
  ('University of Eldoret', 'Eldoret'),
  ('Machakos University', 'Machakos'),
  ('Murang''a University of Technology', 'Murang''a'),
  ('Kirinyaga University', 'Kerugoya'),
  ('Meru University of Science and Technology', 'Meru'),
  ('Zetech University', 'Ruiru'),
  ('Riara University', 'Nairobi'),
  ('Catholic University of Eastern Africa', 'Nairobi'),
  ('Pan Africa Christian University', 'Nairobi'),
  ('Co-operative University of Kenya', 'Nairobi'),
  ('Jaramogi Oginga Odinga University of Science and Technology', 'Bondo');

alter table public.twins
  add column first_name text,
  add column last_name text,
  add column city_id uuid references public.kenya_cities(id),
  add column university_id uuid references public.universities(id),
  add column education_status text check (education_status in ('in_university','graduated_university','in_school','in_program')),
  add column bio text;

alter table public.twins
  add constraint twins_onboarding_text_lengths check (
    (first_name is null or char_length(first_name) <= 60)
    and (last_name is null or char_length(last_name) <= 60)
    and (bio is null or char_length(bio) <= 500)
  );
