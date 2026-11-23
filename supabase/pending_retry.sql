-- Run AFTER schema.sql, in the Supabase SQL editor.
-- Calls the app's /api/pending endpoint every minute so saved meals are retried even when no one has the app open.
-- Replace the two placeholders below before running. Do NOT commit the real secret to git.
--   YOUR_SITE_URL  e.g. https://thefoodrelationship.netlify.app   (no trailing slash)
--   YOUR_CRON_SECRET  the same value you set as CRON_SECRET in Netlify

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('retry-pending-meals')
  where exists (select 1 from cron.job where jobname = 'retry-pending-meals');

select cron.schedule('retry-pending-meals', '* * * * *', $$
  select net.http_post(
    url := 'YOUR_SITE_URL/api/pending',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    body := '{}'::jsonb
  );
$$);
