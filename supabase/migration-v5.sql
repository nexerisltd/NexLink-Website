-- No-card option: files stay in Supabase Storage (1 GB free). Cap per encrypted file = 20 MB. Run once.
insert into storage.buckets(id,name,public,file_size_limit) values('files','files',false,20972544) on conflict(id) do update set file_size_limit=20972544;
