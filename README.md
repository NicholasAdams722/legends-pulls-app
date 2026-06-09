# Legends Inventory Transfers

An internal mobile-first PWA that lets retail store managers transfer slow-moving inventory between stores — and route what nobody wants back to the warehouse — without phone calls, group texts, or spreadsheets.

Built as a real, in-production tool for a multi-location retail business. The codebase is small on purpose; the interesting work is in the data model, the concurrency-safe state machine, and the on-the-floor UX.

---

## The problem

Legends operates a handful of retail stores plus a central warehouse. When a store has product that isn't selling — last season's styles, oddball sizes, a color that bombed at one location — a manager wants to offer it to the other stores before sending it back. Historically this happened over text threads: blurry photos, lost messages, two stores claiming the same item, no audit trail.

This app replaces all of that with a single shared feed.

## How it works

Every item-transfer offer is a **pull**. A pull moves through a small state machine:

```
              ┌────────────► claimed ─────► received
              │              (by a peer store)
   available ─┤
              │              (all peers passed)
              └────────────► to_warehouse ─► received
                                            (by warehouse)
```

1. **Post.** A manager photographs the item, scans the 5-digit SKU barcode (or types it), enters quantity/size/color, and posts it to the feed.
2. **Claim or pass.** Every other store manager sees the pull in real time. They can **claim** it (first claim wins, atomically) or **pass** on it.
3. **Auto-route.** Once *every* peer store has passed, the pull is automatically routed to the warehouse — no manual intervention.
4. **Receive.** Whoever ends up with the item marks it received on arrival, closing the loop.

The peer count is computed from the `stores` table at decision time, so adding or removing a store doesn't require a code change.

---

## Tech stack

| Layer       | Choice                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| Framework   | **Next.js 16** (App Router, Server Components, Server Actions)         |
| UI          | **React 19**, **Tailwind CSS v4**                                      |
| Backend     | **Supabase** — Postgres, Auth, Storage, Realtime                       |
| Language    | **TypeScript** (strict)                                                |
| Barcodes    | **@zxing/browser** — in-browser camera scanning for SKUs               |
| PWA         | Web App Manifest + installable on iOS/Android home screens             |
| Hosting     | **Vercel**                                                             |

No client-side state library, no ORM, no API route layer. Server Components read directly from Supabase; mutations go through Server Actions that call Postgres RPCs.

---

## Notable engineering decisions

### State transitions live in Postgres, not the app server
Every status change (`claim`, `pass`, `receive`, `cancel`) is a `SECURITY DEFINER` PL/pgSQL function that takes a row lock, re-checks the current state, and updates atomically. Two managers tapping "claim" on the same pull at the same instant can't both win — the loser gets a clear "no longer available" error. See [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

### Row-Level Security is the authorization layer
RLS policies enforce who can read what and who can insert/update/delete. The Next.js layer never has to ask "is this user allowed?" — Postgres refuses any query the user shouldn't be making. The RPCs above add a second check for role-and-store-aware transitions.

### Realtime feed without WebSocket plumbing
Supabase Realtime is enabled on `pulls`, `pull_lines`, and `pull_passes`. The feed subscribes to changes and re-renders as other stores post, claim, or pass — no polling, no custom socket server.

### 4-digit employee-code auth
Store associates wanted to sign in fast on a shared device. Email magic links were too slow. The app now uses a 4-digit employee code that resolves to a Supabase auth user server-side ([`src/lib/auth-code.ts`](src/lib/auth-code.ts), migration [`0004_employee_codes.sql`](supabase/migrations/0004_employee_codes.sql)). Admins assign codes via the `/admin/users` screen.

### Mobile-first and installable
The whole UI is designed for one-handed use on a phone in a stockroom. Sticky header, bottom tab bar, large tap targets, safe-area padding for iOS. The app installs as a PWA so it lives on the home screen like a native app.

### Tight surface area
- No client state manager. React 19 Server Components + `useActionState` handle every form.
- No REST/GraphQL layer between the app and the database. Server Actions call RPCs directly.
- Manual SKU entry is the default; the `products` table exists for a future POS-export import without a schema migration.

---

## Project layout

```
src/
├── app/
│   ├── (app)/                  # Authenticated app shell + tab bar
│   │   ├── feed/               # Realtime list of available pulls
│   │   ├── post/               # New-pull form (photos, SKU scan, lines)
│   │   ├── pulls/[pullId]/     # Detail view + claim/pass/receive actions
│   │   ├── claims/             # Pulls this store has claimed
│   │   ├── history/            # Closed pulls
│   │   └── admin/users/        # Admin-only user management
│   ├── login/                  # 4-digit code sign-in
│   ├── signup/                 # First-time profile setup
│   └── auth/callback/          # Supabase auth callback
├── lib/
│   ├── auth.ts                 # Session + profile helpers
│   ├── auth-code.ts            # Employee-code lookup
│   ├── supabase/               # Server + browser + proxy clients
│   └── types.ts                # Shared domain types
└── proxy.ts                    # Next.js middleware — refreshes Supabase session
supabase/
└── migrations/                 # Schema, RPCs, RLS policies, storage bucket
```

---

## Running locally

### Prerequisites
- Node.js 20+
- A Supabase project (free tier is fine)

### Setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.local.example .env.local   # then fill in the two Supabase keys

# 3. Apply the schema
#    Either paste each file in supabase/migrations/*.sql into the Supabase
#    SQL editor in order, or use the Supabase CLI:
supabase db push

# 4. Run
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Create an account at `/signup`, then promote your row to `admin` in the Supabase `users` table to access user management.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Status

In daily production use across the Legends store group. The schema, auth model, and core workflows are stable; ongoing work focuses on reporting and a POS-export catalog import.
