-- P2-8: backfill skills.slug (explicit values so the two skills whose names
-- differ from the sample slugs still line up). Run between the part 1 and part 2
-- migrations; applied live via execute_sql and registered in history by hand.
update public.skills set slug = case name
  when '3D Modelling' then '3d-modelling'
  when 'React App Development' then 'react-development'
  when 'User Research' then 'user-research'
  when 'Visual & Interface Design' then 'visual-design'
  when 'Systems Thinking' then 'systems-thinking'
  when 'Team Facilitation' then 'team-facilitation'
  when 'Technical Writing' then 'technical-writing'
  when 'Sustainable Materials' then 'sustainable-materials'
  else lower(regexp_replace(btrim(name), '[^a-zA-Z0-9]+', '-', 'g'))
end
where slug is null;
