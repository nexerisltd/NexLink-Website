# NexLink.Chat – Product Requirements Document

**Version 1.0 · October 26, 2026 · Status: Draft for review** **Owner:** Product / Engineering · **Stack:** Next.js, Supabase, Vercel (free tiers)

## 1. Overview

NexLink.Chat is a web-based, Telegram-style messenger where every message is end-to-end encrypted (E2EE) in the browser. People sign in with Google for a permanent account, or skip sign-up entirely and use a **temporary room** (1 to 5 hours) protected only by a room code and password. The whole product is designed to run on free hosting tiers without hitting their limits.

**Vision:** the fastest way to start a private conversation, with nothing to install and nothing the server can read.

## 2. Problem and Opportunity

- Mainstream messengers need phone numbers or heavy sign-up, and many chats are not end-to-end encrypted by default.
- People often need a quick, throwaway private channel (a project call, an event, a one-off group) that disappears on its own.
- Small teams and developers want a self-deployable, auditable chat they can host for free.

## 3. Goals and Non-Goals

### Goals

1. Private by default: the server stores only ciphertext and public keys.
2. Zero-friction guest chat: create or join a temp room in under 30 seconds with no account.
3. Telegram-like usability: chat list, groups, unread badges, notifications, installable PWA.
4. Run entirely on free tiers (Vercel Hobby, Supabase Free) with built-in protection against quota exhaustion.

### Non-Goals (v1)

- Voice/video calls, public channels, bots, stickers.
- Native iOS/Android apps (PWA only).
- Phone-number identity or contact syncing.
- Protection against a fully compromised device or browser.

## 4. Target Users

| Persona | Need | Primary flow |
| --- | --- | --- |
| **Privacy-minded individual** | Talk privately with friends | Google sign-in, direct messages |
| **Small group / team lead** | Quick private group, no admin overhead | Create group, add by username |
| **Guest / one-off participant** | Join a chat without an account | Temp room code + password |
| **Developer / self-hoster** | Deploy and audit for free | Fork repo, run SQL, deploy to Vercel |

## 5. Scope

### 5.1 Shipped in v1 (implemented, pending full end-to-end testing)

- Google sign-in only (email/password removed).
- One-time key setup: username, display name, key passphrase; encrypted key backup for new devices.
- Direct messages and groups (up to 30 members).
- Temporary rooms for guests and members, 1 to 5 hours.
- Safety-number verification for direct chats.
- Disappearing messages (1 hour, 1 day, 7 days, default 60 days).
- Realtime delivery, unread badges, browser notifications, tab-title unread count.
- PWA (installable), light/dark theme, responsive mobile layout.
- Automated cleanup (expired messages, expired rooms, old guest accounts) and daily keep-alive.

### 5.2 Out of scope for v1

File and image sharing, voice notes, reactions, replies, push notifications, message search, forward secrecy via Double Ratchet, multi-device key separation, group key rotation on member removal.

## 6. Functional Requirements

### 6.1 Authentication and identity

| ID | Requirement | Priority |
| --- | --- | --- |
| AUTH-1 | Users sign in with Google OAuth via Supabase Auth. | Must |
| AUTH-2 | First-time users create a unique username (a-z, 0-9, underscore, 3 to 20 chars) and display name (up to 40 chars). | Must |
| AUTH-3 | Display name is pre-filled from the Google profile when available. | Should |
| AUTH-4 | Guests use Supabase anonymous sign-in; no email or password is collected. | Must |
| AUTH-5 | Guest accounts cannot use DMs, groups, or user search and cannot see registered users. | Must |

### 6.2 Keys and devices

| ID | Requirement | Priority |
| --- | --- | --- |
| KEY-1 | An ECDH P-256 identity key pair is generated in the browser at setup. | Must |
| KEY-2 | The private key is stored non-extractable in IndexedDB and never sent to the server in plaintext. | Must |
| KEY-3 | A passphrase-encrypted backup (PBKDF2, AES-GCM) is stored so a new device can restore the key. | Must |
| KEY-4 | If no local key exists, the app asks for the passphrase before showing any chat. | Must |
| KEY-5 | Users can compare a safety number with a contact to detect interception. | Should |

### 6.3 Messaging

| ID | Requirement | Priority |
| --- | --- | --- |
| MSG-1 | Each message uses a fresh random AES-256-GCM key, wrapped separately for every current member via ephemeral ECDH + HKDF. | Must |
| MSG-2 | The server stores only ciphertext, IV, wrapped keys, sender and timestamps. | Must |
| MSG-3 | Messages appear in realtime for all members and load the latest 80 on open. | Must |
| MSG-4 | Max message length is 4,000 characters; Enter sends, Shift+Enter adds a new line. | Must |
| MSG-5 | Rate limit: no more than 15 messages per user per 10 seconds, enforced in the database. | Must |
| MSG-6 | Messages expire automatically (default 60 days, or the chat's disappearing setting). | Must |
| MSG-7 | A message that cannot be decrypted shows a clear placeholder instead of failing silently. | Should |

### 6.4 Direct messages and groups

| ID | Requirement | Priority |
| --- | --- | --- |
| CHT-1 | Users find others by username prefix and start a DM; one DM per pair. | Must |
| CHT-2 | Users create groups of up to 30 members by entering usernames. | Must |
| CHT-3 | Members can leave a group; any member can set the disappearing timer. | Should |
| CHT-4 | Chat list supports filters (All, People, Groups, Temp) and unread counts. | Should |

### 6.5 Temporary rooms

| ID | Requirement | Priority |
| --- | --- | --- |
| TMP-1 | A creator picks a duration of 1 to 5 hours; the app generates an 8-character room code. | Must |
| TMP-2 | Joining requires the room code and password. The password never leaves the browser. | Must |
| TMP-3 | Two values are derived from the password with different salts: a message key (client only) and a verifier (checked by the server). | Must |
| TMP-4 | After 8 wrong attempts the room locks for 10 minutes. | Must |
| TMP-5 | A user may have at most 3 active temp rooms; a room holds at most 30 people. | Must |
| TMP-6 | At expiry the room, its members and messages become inaccessible immediately and are deleted within 15 minutes. | Must |
| TMP-7 | The header shows code, time left (warning under 10 minutes) and a button to copy an invite that excludes the password. | Should |
| TMP-8 | Guests who reload the page must re-enter the room password to unlock it. | Must |

### 6.6 Experience

- Responsive two-pane layout (single pane on mobile), light and dark themes, reduced-motion support, keyboard focus styles.
- Toast notifications for errors and confirmations; Esc closes dialogs.
- Installable PWA with app icons derived from the NexLink.Chat logo.

## 7. Security and Privacy Requirements

- **Zero-knowledge content:** the database and hosting provider never receive plaintext messages, private keys or temp-room passwords.
- **Row-level security** is enabled on every table; the public (anon) key is safe only because of these policies. The service-role key is never used in the client.
- **Authenticated encryption:** AES-GCM with the chat ID bound as additional data to prevent moving ciphertext between chats.
- **Guest isolation:** anonymous users cannot enumerate registered users.
- **Data minimisation:** guest accounts are deleted after 2 days; expired content is purged on a schedule.

### Known limitations (to be disclosed to users)

1. No forward secrecy for recipients: if a user's private key leaks, stored history addressed to them can be read. Mitigation: disappearing messages.
2. Server operator can see metadata: who talks to whom, when, and message sizes.
3. Removing a group member does not re-encrypt past messages they already received.
4. Temp-room security depends on password strength; short passwords are guessable offline if the database leaks.
5. A forgotten key passphrase means history cannot be restored on a new device.
6. The web app is delivered by the host; a malicious deploy could ship altered code (standard web E2EE trade-off).

## 8. Non-Functional Requirements

| Area | Target |
| --- | --- |
| Message latency | Under 1 second delivery for online recipients |
| Initial load | Under 3 seconds on a mid-range phone over 4G |
| Setup | Key setup under 1 minute; temp-room join under 30 seconds |
| Browsers | Current Chrome, Edge, Safari, Firefox (WebCrypto and IndexedDB required) |
| Accessibility | Keyboard operable, labelled controls, sufficient contrast, reduced-motion respected |
| Availability | Best effort on free tiers |

## 9. Architecture

- **Frontend:** Next.js 15 (App Router) and React 19, client-rendered chat UI, PWA manifest and service worker.
- **Backend:** Supabase Postgres, Auth (Google + anonymous), Realtime (Postgres changes) and `pg_cron`.
- **Hosting:** Vercel Hobby; one API route (`/api/keepalive`) triggered daily by Vercel Cron.
- **Crypto:** browser WebCrypto only (ECDH P-256, HKDF-SHA256, AES-256-GCM, PBKDF2-SHA256); no third-party crypto libraries.

### Data model

| Table | Purpose |
| --- | --- |
| `profiles` | Username, display name, public key, guest flag |
| `key_backups` | Passphrase-encrypted private key (owner-only access) |
| `chats` | Kind (dm, group, temp), title, disappearing timer, temp code, expiry, join verifier hash, lockout counters |
| `chat_members` | Membership and admin flag |
| `messages` | Ciphertext, IV, wrapped keys, sender, expiry |

Chat creation and joining go through security-definer database functions (`create_dm`, `create_group`, `create_temp`, `join_temp`, `leave_chat`, `set_ttl`), so clients cannot insert chats or members directly.

## 10. Free-Tier Constraints and Mitigations

Published limits change; verify them before launch.

| Resource | Free limit (approx.) | Mitigation in v1 |
| --- | --- | --- |
| Supabase database | 500 MB | Ciphertext only; 60-day default expiry; scheduled purge |
| Supabase realtime | 200 concurrent connections, 2M messages/month | Disconnect after 2 minutes in background; one channel per user; no typing/presence events |
| Supabase auth | 50,000 monthly active users | Invite-friendly; guest accounts auto-deleted |
| Supabase project pause | After about 7 days idle | Daily keep-alive request |
| Vercel Hobby | About 100 GB bandwidth, 1M function invocations, non-commercial use only | Mostly static client; one tiny API route |

**Capacity guidance:** the realistic ceiling is the realtime connection and message quota. Plan for a few hundred daily active users in free mode.

## 11. Success Metrics

- Time to first message for a guest (target under 60 seconds).
- Percentage of new Google users completing key setup (target above 80%).
- Message delivery success rate (target above 99%).
- Peak concurrent connections as a share of the free limit (alert at 70%).
- Database size as a share of the free limit (alert at 70%).
- Decryption failure rate (target below 1%).

## 12. Roadmap

| Phase | Focus | Items |
| --- | --- | --- |
| **v1.1** | Polish | End-to-end test suite, error handling, rate-limit feedback, admin controls for groups |
| **v1.2** | Richer chat | Encrypted images and files (client-side encryption, size cap), replies, reactions, Web Push |
| **v2** | Stronger crypto | Double Ratchet for 1:1 chats, per-device keys, group key rotation, QR safety-number verification |
| **v2.x** | Growth | Voice notes, local-only search, channels, optional move off free tiers or commercial hosting |

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Free quotas exceeded | Service degrades or stops | Usage alerts, connection auto-close, expiry, invite-only option |
| Crypto implementation flaw | Loss of confidentiality | Independent review before public launch; keep design simple; add tests |
| Abuse (spam, harmful content) | Reputation, provider action | Rate limits, user reporting and blocking (roadmap), clear terms of use |
| Users lose key passphrase | Permanent loss of history | Clear warning at setup; optional recovery methods in v2 |
| Vercel Hobby non-commercial rule | Cannot be used for commercial product | Move to a commercial-friendly host before monetising |
| Google OAuth consent screen left in testing | Only listed testers can sign in | Publish consent screen before launch |

## 14. Release and Deployment Checklist

1. Create Supabase project; enable `pg_cron`; run `schema.sql`.
2. Configure Google OAuth (client ID and secret) and enable anonymous sign-ins; turn off the email provider.
3. Set Site URL and redirect URLs to the Vercel domain.
4. Push code to a private GitHub repository; import into Vercel; set the two public Supabase environment variables.
5. Verify with two accounts: ciphertext only in the `messages` table, realtime works, temp room expires, guest cannot search users.
6. Add usage monitoring for Supabase and Vercel dashboards.

## 15. Open Questions

1. Will the product stay non-commercial (Vercel Hobby) or move to a paid host?
2. Should public sign-up stay open or become invite-only to protect the 200-connection limit?
3. Which comes first after v1: file sharing, push notifications, or Double Ratchet?
4. Do we need a minimum password strength rule or generated passwords for temp rooms?
5. What are the content-moderation and legal obligations for the target regions?
