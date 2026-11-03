# NexLink.Chat
End-to-end encrypted web messenger with a Telegram-grade feature set. Next.js + Supabase + Vercel, all on free tiers.

## Deploy
1. Supabase: new project, then Database > Extensions > enable `pg_cron`.
2. SQL Editor: run `supabase/schema.sql`.
3. Settings > API: copy Project URL + anon key. (Never use the service_role key here.)
4. Push this folder to a private GitHub repo.
5. Vercel: Add New > Project > import repo > set env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` > Deploy.
6. Supabase > Authentication > URL Configuration: set Site URL to your Vercel URL.
7. Google login: Google Cloud Console > APIs & Services > Credentials > OAuth client ID (Web). Authorized redirect URI = `https://YOUR-PROJECT.supabase.co/auth/v1/callback`; JS origin = your Vercel URL. Put Client ID/Secret in Supabase > Authentication > Sign In / Providers > Google. Publish the OAuth consent screen (basic scopes need no review) or only test users can log in.
8. Supabase > Authentication > URL Configuration: add Redirect URL `https://YOUR-APP.vercel.app/**` (and `http://localhost:3000/**`). Turn the Email provider off.
9. Temporary guest rooms: Authentication > Sign In / Providers > enable **"Allow anonymous sign-ins"**. Guests get a throwaway account (deleted after 2 days); rooms last 1-5 hours and are protected by room code + password.
Already ran the first schema? Run only `supabase/migration-temp.sql`. Fresh project? Run `supabase/schema.sql` (it includes all migrations).
Local: `cp .env.example .env.local && npm i && npm run dev`.

## v10 — Telegram-grade features (run `supabase/migration-v10.sql` once on an existing project)
Everything stays zero-knowledge: the server only ever stores ciphertext, public keys and plain metadata.

- **Presence & receipts** — typing indicators (Realtime broadcast, no DB writes), online / last seen (with a "hide from everyone" setting), read ticks ✓✓ via `chat_members.last_read_at`.
- **Saved Messages** — a private DM with yourself, pinned first in the list.
- **Voice messages** — hold the mic button, release to send, slide up to cancel; waveform + 1x/1.5x/2x playback.
- **Emoji & stickers** — full categorized picker with search and recents; a bundled sticker pack (only the sticker id travels).
- **Global search** — chats, people, and your messages (searched in a device-local plaintext index; the server learns nothing).
- **Media gallery** — chat menu > "Media, files and voice".
- **Pinned messages** — context menu > Pin; banner with jump; one pin per chat.
- **Archive & folders** — archive chats out of the main list; filter tabs (All / Direct / Groups / Channels / Unread).
- **Groups** — owner/admin/member roles, promote/demote, ownership transfer, "who can send" permission.
- **Channels** — broadcast chats, admin-only posting, invite links `yourapp/c/CODE`, up to 500 subscribers.
- **Scheduled messages** — clock button next to Send; delivered at the chosen time (RLS hides them from recipients until due).
- **Polls** — attach menu > Poll; votes are encrypted messages tallied client-side.
- **Calls** — 1:1 voice & video over WebRTC (media is DTLS-encrypted end-to-end; signaling is E2EE too). STUN only — strict NATs may fail; add TURN via `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USER`, `NEXT_PUBLIC_TURN_CRED` env vars.
- **Live location** — attach menu > Location; one-shot or live for 15m/1h/8h (updates every 30s while the tab is open); OpenStreetMap viewer, no API key.
- **Wallpapers & accounts** — per-chat wallpapers; "Switch / add Google account" re-runs OAuth with account chooser.

New RPCs added by v10: `touch_presence`, `set_read`, `create_saved`, `pin_msg`, `unpin_msg`, `promote`, `demote`, `transfer_owner`, `set_group_perms`, `create_channel`, `join_channel`.

## How it protects you
- Private key is made in the browser, stored non-extractable in IndexedDB; a passphrase-encrypted backup lets new devices restore it.
- Each message (and every call-signaling payload) gets a random AES-256-GCM key, wrapped per member via ephemeral ECDH P-256 + HKDF. The database holds only ciphertext.
- Free-tier safety: realtime disconnects after 2 min in background, 15 msgs/10s rate limit, messages auto-expire (60 days default), one daily keep-alive cron, typing/presence ride broadcast channels (no postgres_changes quota).

## Known limits
No Double Ratchet yet: if a user's private key leaks, their stored history is readable (use disappearing messages). The server operator can still see who talks to whom and when. Calls need a TURN relay for strict NATs (bring your own via env vars). Scheduled messages and live location only send while the app is open in a tab (browser limitation).

## Message history and Google Drive backup
- Messages are kept on each device (IndexedDB, still encrypted). The server only keeps a rolling cache: 60 days by default. Change it with `update public.app_settings set val='180' where key='retention_days';` (watch the 500 MB free database). Run `supabase/migration-v2.sql` once.
- Timed chats and temp rooms are never stored locally and disappear everywhere when time is up.
- Drive backup: Google Cloud Console > enable **Google Drive API**; OAuth consent screen > add scope `.../auth/drive.appdata`; OAuth client > add your Vercel URL under Authorized JavaScript origins; add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (same client ID you gave Supabase) in Vercel and redeploy.

## Roadmap
Bots (impossible under zero-knowledge E2EE by design), stories, QR login, channel reactions/comments, group calls.
