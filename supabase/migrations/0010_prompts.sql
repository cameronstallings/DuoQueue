-- Hinge-style prompts: replaces the single free-text bio as the primary way a profile
-- expresses personality. profiles.bio itself is left in place (nullable, unused going
-- forward) rather than dropped, to avoid a destructive column removal.

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  question text not null unique
);

alter table public.prompts enable row level security;

create policy "prompts_select_all" on public.prompts for select using (true);
grant select on public.prompts to authenticated;

insert into public.prompts (question) values
  ('The nerdiest thing about me is'),
  ('My most controversial gaming opinion is'),
  ('I geek out on'),
  ('A game I could talk about for hours'),
  ('My ideal co-op session involves'),
  ('You should send me a request if'),
  ('My gamertag origin story is'),
  ('Two truths and a lie about my gaming history'),
  ('The last game that made me rage quit'),
  ('My most underrated pick is'),
  ('I''m looking for a duo who'),
  ('My comfort game is'),
  ('A skill I''m weirdly proud of'),
  ('My setup includes'),
  ('The game I''m embarrassed to admit I love'),
  ('My win condition in life is'),
  ('Ask me about my favorite build'),
  ('I''ll never turn down a round of');

create table public.profile_prompts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  answer text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, position),
  unique (profile_id, prompt_id),
  constraint prompt_position_range check (position between 0 and 2),
  constraint prompt_answer_length check (char_length(trim(answer)) between 1 and 150)
);

alter table public.profile_prompts enable row level security;

create policy "profile_prompts_all_own" on public.profile_prompts
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert, update, delete on public.profile_prompts to authenticated;

-- Mirrors public_profile_games/public_profile_shows: the deck/matches only ever need to
-- read OTHER users' prompt answers for active, onboarded profiles, joined with the
-- catalog question text.
create view public.public_profile_prompts as
select pp.profile_id, pp.position, pr.question, pp.answer
from public.profile_prompts pp
join public.prompts pr on pr.id = pp.prompt_id
join public.profiles p on p.id = pp.profile_id
where p.is_active = true and p.onboarding_completed = true;

grant select on public.public_profile_prompts to authenticated;
