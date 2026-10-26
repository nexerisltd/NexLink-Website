# NexLink.Chat
End-to-end encrypted web messenger. Next.js + Supabase + Vercel, all on free tiers.

## Deploy
1. Supabase: new project, then Database > Extensions > enable `pg_cron`.
2. SQL Editor: run `supabase/schema.sql`.
3. Settings > API: copy Project URL + anon key. (Never use the service_role key here.)
4. Push this folder to a private GitHub repo.
5. Vercel: Add New > Project > import repo > set env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` > Deploy.
6. Supabase > Authentication > URL Configuration: set Site URL to your Vercel URL.
7. Google login: Google Cloud Console > APIs & Services > Credentials > OAuth client ID (Web). Authorized redirect URI = `https://YOUR-PROJECT.supabase.co/auth/v1/callback`; JS origin = your Vercel URL. Put Client ID/Secret in Supabase > Authentication > Sign In / Providers > Google. Publish the OAuth consent screen (basic scopes need no review) or only test users can log in.
8. Supabase > Authentication > URL Configuration: add Redirect URL `https://YOUR-APP.vercel.app/**` (and `http://localhost:3000/**`). Turn the Email provider off.
9. Temporary guest rooms: Authentication > Sign In / Providers > enable "Allow anonymous sign-ins". Guests get a throwaway account (deleted after 2 days); rooms last 1-5 hours and are protected by room code + password.
Already ran the first schema? Run only `supabase/migration-temp.sql`. Fresh project? Run `supabase/schema.sql` (it includes the migration).
Local: `cp .env.example .env.local && npm i && npm run dev`.

## How it protects you
- Private key is made in the browser, stored non-extractable in IndexedDB; a passphrase-encrypted backup lets new devices restore it.
- Each message gets a random AES-256-GCM key, wrapped per member via ephemeral ECDH P-256 + HKDF. The database holds only ciphertext.
- Free-tier safety: realtime disconnects after 2 min in background, 15 msgs/10s rate limit, messages auto-expire (60 days default), one daily keep-alive cron.

## Known limits
No Double Ratchet yet: if a user's private key leaks, their stored history is readable (use disappearing messages). The server operator can still see who talks to whom and when.

## Message history and Google Drive backup
- Messages are kept on each device (IndexedDB, still encrypted). The server only keeps a rolling cache: 60 days by default. Change it with `update public.app_settings set val='180' where key='retention_days';` (watch the 500 MB free database). Run `supabase/migration-v2.sql` once.
- Timed chats and temp rooms are never stored locally and disappear everywhere when time is up.
- Drive backup: Google Cloud Console > enable **Google Drive API**; OAuth consent screen > add scope `.../auth/drive.appdata`; OAuth client > add your Vercel URL under Authorized JavaScript origins; add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (same client ID you gave Supabase) in Vercel and redeploy.

## v3: auto-backup, files, photos
- Run `supabase/migration-v3.sql` once. It adds profile/group photos, the private `files` bucket (10 MB per file, any format, files are encrypted in the browser) and a 30 files/day/user limit.
- Vercel env vars (server only, NOT `NEXT_PUBLIC_`): `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`. The daily cron deletes expired files from Storage.
- Auto-backup runs about once a day while the app is open (browsers cannot run in the background). First time: Settings > Google Drive backup > enter key passphrase.
- Profile and group photos are small public-style images (not end-to-end encrypted).
