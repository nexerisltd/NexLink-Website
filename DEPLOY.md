# NexLink.Chat deploy guide (Vercel + Supabase + Cloudflare R2, all free tiers)

## 1. Supabase (backend)
1. New project (region: Singapore). Database > Extensions > enable `pg_cron`.
2. SQL Editor: run `supabase/schema.sql` once (fresh project). Already ran older files? Run only the newest missing `migration-*.sql`.
3. Authentication > Sign In / Providers: enable **Google** and **Allow anonymous sign-ins**; turn Email off.
4. Authentication > URL Configuration: Site URL = your Vercel URL; add Redirect URL `https://YOUR-APP.vercel.app/**`.
5. Settings > API: copy Project URL, anon key and service_role key (service key stays server-only).

## 2. Google Cloud
OAuth client (Web): redirect URI `https://YOUR-PROJECT.supabase.co/auth/v1/callback`, JS origin = your Vercel URL. Publish the consent screen. For Drive backup also enable the Drive API and add scope `https://www.googleapis.com/auth/drive.appdata`.

## 3. Cloudflare R2 (file storage)
1. R2 > Create bucket `nexlink-files` (private, do not enable public access).
2. Bucket > Settings > CORS policy:
   `[{"AllowedOrigins":["https://YOUR-APP.vercel.app"],"AllowedMethods":["GET","PUT"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]`
3. Bucket > Settings > Object lifecycle rules: delete objects after 8 days (safety net for abandoned uploads).
4. R2 > Manage API tokens > create token with **Object Read & Write** for this bucket. Copy Access Key ID and Secret.
5. Your Account ID is on the R2 overview page.

## 4. Vercel (hosting)
Import the GitHub repo, then add Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (any long random string)
- `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
Deploy. Use ONE domain only (keys live per domain in the browser).

## 5. Test
Two accounts: send a text, a photo and a PDF; check `messages` holds only ciphertext and R2 holds unreadable blobs; create a temp room; wait for the daily cron or open `/api/keepalive`.
