-- Use this ONLY if the main schema already ran and just the last line failed.
create extension if not exists pg_cron;
select cron.schedule('purge-expired','*/15 * * * *','delete from public.messages where expires_at<now()');
