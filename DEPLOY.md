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

## No credit card? Skip section 3 (R2)
Leave all `R2_*` variables unset. The app then stores encrypted files in Supabase Storage automatically (max 20 MB per file, 1 GB total, files expire after 7 days). Run `supabase/migration-v5.sql` and make sure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel. When you get a card later, add the 4 `R2_*` variables, redeploy, and new uploads go to R2 (old files stay where they are until they expire).

## Backblaze B2 (free 10 GB, no card) instead of R2
1. Buckets > Create a Bucket: unique name, **Private**, default encryption off, Object Lock off.
2. Note the bucket **Endpoint** (e.g. `s3.us-west-004.backblazeb2.com`). Region = the part after `s3.` (`us-west-004`).
3. Application Keys > Add a New Application Key: only this bucket, **Read and Write**. Copy keyID + applicationKey (shown once). Never use the master key.
4. CORS: the web UI presets only allow downloads, not uploads. Run `scripts/b2-cors.mjs` once with your MASTER application key (instructions at the top of the file).
5. Bucket Settings > Lifecycle Settings > custom rule: days till hide = 8, days till delete = 1 (B2 only hides on delete, this frees the space).
6. Vercel env: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` (= keyID), `S3_SECRET_ACCESS_KEY` (= applicationKey), plus `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`. Redeploy.

## Troubleshooting storage
Open `https://YOUR-APP.vercel.app/api/storage-check?secret=YOUR_CRON_SECRET`. `sdkPut` tests the keys, `presignedPut` tests the exact link the browser uses. If `presignedPut` fails but `sdkPut` is ok, set `S3_SIGN_LENGTH=0` in Vercel and redeploy.

## v6 (replies, delete, group management)
Run `supabase/migration-v6.sql` once in the SQL Editor (adds add_member / remove_member / rename_chat).

## v7 (reactions, edit, pin/mute, background push)
1. Run `supabase/migration-v7.sql` once.
2. Generate push keys on your PC: `npx web-push generate-vapid-keys`. Add to Vercel: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public key), `VAPID_PRIVATE_KEY` (private key, server only), `VAPID_SUBJECT` (`mailto:your@email`). Redeploy.
3. In the app: Settings > Turn on background notifications (per device). On iPhone the app must be added to the Home Screen first.

## v8 (context menu, bulk select, forward, clear chat, history requests)
Run `supabase/migration-v8.sql` once. It adds per-user "clear chat" and shared-history grants, and changes who can read old messages. If everyone clears a chat, the messages are deleted for good (files in the bucket are removed by the lifecycle rule).
