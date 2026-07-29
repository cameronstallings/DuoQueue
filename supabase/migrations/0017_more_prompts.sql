-- Double the prompt catalog (18 -> 36) so onboarding and Edit Prompts have real variety
-- to pick from, same gaming-friend tone as the original set in 0010_prompts.sql.

insert into public.prompts (question) values
  ('My go-to strategy in any game is'),
  ('I will absolutely carry you if'),
  ('The game that got me into gaming was'),
  ('My proudest gaming achievement is'),
  ('I main'),
  ('My tier list is unhinged because'),
  ('A game night with me includes'),
  ('I get weirdly competitive about'),
  ('My backlog of shame includes'),
  ('The best trash talk I''ve ever received was'),
  ('Right now I''m in my ___ era'),
  ('My friend group calls me the'),
  ('A game I''ll defend to the death is'),
  ('My ideal squad has'),
  ('I peaked in'),
  ('The genre I always come back to is'),
  ('My keybinds/loadout are cursed because'),
  ('The role I always end up playing is');
