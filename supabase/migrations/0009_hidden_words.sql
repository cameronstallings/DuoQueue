-- Hidden Words: a personal filter, not a moderation/enforcement mechanism — messages
-- matching a user's own list are just hidden behind a reveal tap on their own device.
-- No trigger/enforcement needed server-side; RLS is deny-all-but-owner like every other
-- ownership table.

create table public.hidden_words (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  word text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, word),
  constraint hidden_word_not_blank check (char_length(trim(word)) > 0)
);

alter table public.hidden_words enable row level security;

create policy "hidden_words_all_own" on public.hidden_words
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert, delete on public.hidden_words to authenticated;
