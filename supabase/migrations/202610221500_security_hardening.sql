-- Security hardening (from the security review, docs/SECURITY_REVIEW.md). Run in the Supabase SQL editor.
-- Safe to run once. It changes no learner data.

-- 1. Limit how fast one learner can write answers. Anonymous sign-in means anyone can make an account,
--    so without a limit a script could fill the database with attempts. 500 per hour is far above real use.
create or replace function public.limit_attempt_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.attempts a
       where a.user_id = new.user_id and a.created_at > now() - interval '1 hour') >= 500 then
    raise exception 'too many answers saved in the last hour; slow down' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists attempts_limit_rate on public.attempts;
create trigger attempts_limit_rate before insert on public.attempts
  for each row execute function public.limit_attempt_rate();

-- 2. Source links may only point to Microsoft Learn over HTTPS. The app also checks this when it draws a link;
--    the database check means a bad link cannot even be stored. NOT VALID applies the rule to new and changed
--    rows straight away, then VALIDATE checks the old rows (all 150 current rows pass).
alter table public.questions drop constraint if exists questions_source_url_learn_only;
alter table public.questions add constraint questions_source_url_learn_only
  check (source_url = '' or source_url ~ '^https://learn\.microsoft\.com/') not valid;
alter table public.notes drop constraint if exists notes_source_url_learn_only;
alter table public.notes add constraint notes_source_url_learn_only
  check (source_url = '' or source_url ~ '^https://learn\.microsoft\.com/') not valid;

alter table public.questions validate constraint questions_source_url_learn_only;
alter table public.notes validate constraint notes_source_url_learn_only;
