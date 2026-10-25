# nexlink
End-to-end encrypted web messenger. Next.js + Supabase + Vercel, all on free tiers.

## Deploy
1. Supabase: new project, then Database > Extensions > enable `pg_cron`.
2. SQL Editor: run `supabase/schema.sql`.
3. Settings > API: copy Project URL + anon key. (Never use the service_role key here.)
4. Push this folder to a private GitHub repo.
5. Vercel: Add New > Project > import repo > set env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` > Deploy.
6. Supabase > Authentication > URL Configuration: set Site URL to your Vercel URL.
7. To keep it private/small: Authentication > Sign In / Providers > turn off "Allow new users to sign up", then add users in Authentication > Users.
Local: `cp .env.example .env.local && npm i && npm run dev`.

## How it protects you
- Private key is made in the browser, stored non-extractable in IndexedDB; a passphrase-encrypted backup lets new devices restore it.
- Each message gets a random AES-256-GCM key, wrapped per member via ephemeral ECDH P-256 + HKDF. The database holds only ciphertext.
- Free-tier safety: realtime disconnects after 2 min in background, 15 msgs/10s rate limit, messages auto-expire (60 days default), one daily keep-alive cron.

## Known limits
No Double Ratchet yet: if a user's private key leaks, their stored history is readable (use disappearing messages). The server operator can still see who talks to whom and when.
