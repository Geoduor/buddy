-- Buddy: content review helpers. Run blocks ONE AT A TIME in the Supabase SQL editor.
-- Owner: Geofry. Read docs/VERIFICATION_CHECKLIST.md first.
-- Rules enforced by the database: a verified row needs a source_url, an explanation,
-- and a verified_by name that is NOT the author.

-- 1. WHAT IS WAITING FOR REVIEW (questions)
select id, objective_id, author, left(stem, 80) as stem, source_url, notes
  from public.questions
 where status = 'draft'
 order by objective_id, created_at;

-- 1b. WHAT IS WAITING FOR REVIEW (notes)
select id, objective_id, author, left(body, 80) as body, source_url, notes
  from public.notes
 where status = 'draft'
 order by objective_id, created_at;

-- 2. VERIFY ONE QUESTION  (replace the id and the reviewer name)
update public.questions
   set status = 'verified', verified_by = 'Yego', verified_at = now(), notes = null
 where id = '00000000-0000-0000-0000-000000000000';

-- 2b. VERIFY ONE NOTE
update public.notes
   set status = 'verified', verified_by = 'Yego', verified_at = now()
 where id = '00000000-0000-0000-0000-000000000000';

-- 2c. VERIFY A BATCH of questions that one reviewer has fully checked
--     (list the ids yourself; never verify "everything by author")
update public.questions
   set status = 'verified', verified_by = 'Jess', verified_at = now(), notes = null
 where id in (
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002'
 );

-- 2d. VERIFY A WHOLE FILE'S WORTH: all drafts by one author in one group, AFTER the reviewer has
--     approved that file. Rows that carry a reviewer note (anything in `notes`) are skipped.
--     Replace the author, the group pattern and the reviewer.
update public.questions
   set status = 'verified', verified_by = 'Yego', verified_at = now()
 where status = 'draft'
   and lower(author) = 'jess'
   and objective_id like 'D1.1.%'
   and coalesce(btrim(notes), '') = '';

-- 3. SEND BACK WITH A REASON (stays hidden from learners)
update public.questions
   set status = 'draft', verified_by = null, verified_at = null,
       notes = 'NEEDS CHECK: replace this with the reason'
 where id = '00000000-0000-0000-0000-000000000000';

-- 3b. SEND A NOTE BACK WITH A REASON
update public.notes
   set status = 'draft', verified_by = null, verified_at = null,
       notes = 'NEEDS CHECK: replace this with the reason'
 where id = '00000000-0000-0000-0000-000000000000';

-- 4. WHAT IS LIVE, PER OBJECTIVE GROUP (target: 6+ verified questions and 1+ verified note each)
select o.group_id,
       o.group_title,
       count(distinct q.id) filter (where q.status = 'verified') as verified_questions,
       count(distinct n.id) filter (where n.status = 'verified') as verified_notes
  from (select distinct group_id, group_title from public.objectives) o
  left join public.objectives ob on ob.group_id = o.group_id
  left join public.questions  q  on q.objective_id = ob.id
  left join public.notes      n  on n.objective_id = ob.id
 group by o.group_id, o.group_title
 order by o.group_id;

-- 5. SPOT CHECK before the demo: five random live questions with their sources
select id, objective_id, stem, source_url, author, verified_by
  from public.questions
 where status = 'verified'
 order by random()
 limit 5;

-- 6. AI QUOTA: how many Study Buddy answers were used in the last 24 hours (caps are in app_settings)
select (select count(*) from public.ai_usage where created_at > now() - interval '24 hours') as used_last_24h,
       (select value from public.app_settings where key = 'ai_global_daily_cap') as global_cap,
       (select value from public.app_settings where key = 'ai_user_daily_cap')   as per_user_cap;

-- 6b. RAISE OR LOWER A CAP (example: allow 40 answers per learner per day)
-- update public.app_settings set value = 40 where key = 'ai_user_daily_cap';
