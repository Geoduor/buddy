-- Buddy: initial schema (AZ-900 study tool)
-- Owner: Geofry. Run once in the Supabase SQL editor, then run supabase/seed/objectives_seed.sql.
-- Never edit this file after it is merged; add a new timestamped migration instead.

-- ---------------------------------------------------------------------------
-- Reference data: exam domains and objectives (seeded from content/objectives.json)
-- ---------------------------------------------------------------------------
create table public.domains (
  id          text primary key,                 -- 'D1', 'D2', 'D3'
  title       text not null,
  weight_min  smallint not null check (weight_min between 0 and 100),
  weight_max  smallint not null check (weight_max between 0 and 100),
  check (weight_min <= weight_max)
);

create table public.objectives (
  id          text primary key,                 -- 'D1.1.2' = group D1.1, second official bullet
  domain_id   text not null references public.domains (id),
  group_id    text not null,                    -- 'D1.1'
  group_title text not null,
  position    smallint not null,
  text        text not null
);
create index objectives_group_idx on public.objectives (group_id);
create index objectives_domain_idx on public.objectives (domain_id);

-- ---------------------------------------------------------------------------
-- Questions: only status = 'verified' is ever visible to learners
-- ---------------------------------------------------------------------------
create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  objective_id   text not null references public.objectives (id),
  stem           text not null,
  options        jsonb not null,                -- JSON array of exactly 4 strings
  correct_index  smallint not null check (correct_index between 0 and 3),
  explanation    text not null default '',      -- why the correct answer is right
  why_wrong      jsonb,                         -- optional JSON array of 4 (null for the correct option)
  source_url     text not null default '',      -- the real Microsoft Learn page that was checked
  author         text,
  status         text not null default 'draft' check (status in ('draft', 'verified')),
  notes          text,                          -- e.g. 'NEEDS CHECK'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  fts            tsvector generated always as (
                   to_tsvector('english', coalesce(stem, '') || ' ' || coalesce(explanation, ''))
                 ) stored,
  constraint questions_options_is_4_array
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  -- Protocol from PROJECT_BRIEF.md: no source URL / no explanation = cannot be verified
  constraint questions_verified_needs_source
    check (status <> 'verified' or (length(btrim(source_url)) > 0 and length(btrim(explanation)) > 0)),
  constraint questions_stem_unique unique (stem)
);
create index questions_objective_idx on public.questions (objective_id) where status = 'verified';
create index questions_fts_idx on public.questions using gin (fts);

-- ---------------------------------------------------------------------------
-- Notes: our own-words study notes, the retrieval corpus for Study Buddy
-- ---------------------------------------------------------------------------
create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  objective_id  text not null references public.objectives (id),
  body          text not null,
  source_url    text not null default '',
  author        text,
  status        text not null default 'draft' check (status in ('draft', 'verified')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  fts           tsvector generated always as (to_tsvector('english', coalesce(body, ''))) stored,
  constraint notes_verified_needs_source
    check (status <> 'verified' or length(btrim(source_url)) > 0)
);
create index notes_objective_idx on public.notes (objective_id) where status = 'verified';
create index notes_fts_idx on public.notes using gin (fts);

-- ---------------------------------------------------------------------------
-- Attempts: one row each time a learner answers a question
-- ---------------------------------------------------------------------------
create table public.attempts (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id     uuid not null references public.questions (id) on delete cascade,
  selected_index  smallint not null check (selected_index between 0 and 3),
  is_correct      boolean not null default false,  -- always overwritten by the trigger below
  created_at      timestamptz not null default now()
);
create index attempts_user_idx on public.attempts (user_id, created_at desc);
create index attempts_question_idx on public.attempts (question_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- is_correct is computed on the server so a learner cannot fake their own score
create function public.set_attempt_correctness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select (q.correct_index = new.selected_index)
    into new.is_correct
    from public.questions q
   where q.id = new.question_id and q.status = 'verified';

  if new.is_correct is null then
    raise exception 'question not found or not verified';
  end if;
  return new;
end;
$$;

create trigger attempts_set_correctness before insert on public.attempts
  for each row execute function public.set_attempt_correctness();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Learners (including anonymous sign-ins, which use the 'authenticated' role) can:
--   read domains, objectives, verified questions, verified notes
--   insert and read ONLY their own attempts
-- Everything else (importing, verifying) is done with the service role key, server-side only.
-- ---------------------------------------------------------------------------
alter table public.domains    enable row level security;
alter table public.objectives enable row level security;
alter table public.questions  enable row level security;
alter table public.notes      enable row level security;
alter table public.attempts   enable row level security;

create policy "domains are public"    on public.domains
  for select to anon, authenticated using (true);
create policy "objectives are public" on public.objectives
  for select to anon, authenticated using (true);
create policy "verified questions are public" on public.questions
  for select to anon, authenticated using (status = 'verified');
create policy "verified notes are public" on public.notes
  for select to anon, authenticated using (status = 'verified');

create policy "learners insert own attempts" on public.attempts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "learners read own attempts" on public.attempts
  for select to authenticated using (user_id = (select auth.uid()));

-- Explicit table privileges (RLS above still applies on top of these)
grant select on public.domains, public.objectives, public.questions, public.notes
  to anon, authenticated;
grant select, insert on public.attempts to authenticated;
