# writingale — backend (Supabase edition)

The source of truth is now a real Postgres database on Supabase — two
tables, `clients` and `invoice_log` — instead of an Excel file. You still
get a genuine `.xlsx` download whenever you want one (Payment Management →
"Download Excel"); it's just generated on demand from live data rather than
being the storage format itself.

## Why this is better for multiple admins

- Every change touches one row, not a whole file — no more "download →
  edit → re-upload the entire workbook" on every single update.
- Postgres handles concurrent writes safely (no silent lost updates).
- **Real-time**: Supabase Realtime pushes every change to every open browser
  tab within about a second. No polling, no manual refresh — if your friend
  marks something paid, you see it update live.

## Setup

### 1. Create the Supabase project & schema
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor**, paste the contents of `supabase/schema.sql`, and run
   it. This creates both tables, locks them down with Row Level Security
   (read-only for the public key; writes only via your server), adds an
   atomic order-count function, and turns on Realtime for both tables.
3. Go to **Project Settings → API** and copy three values: the **Project
   URL**, the **anon public key**, and the **service_role key**.

### 2. Configure the backend (server-side, secret)
Set these as environment variables in your Vercel project (Settings →
Environment Variables):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # keep this secret!
```

### 3. Configure the frontend (public, safe to expose)
Open `index.html` and fill in the two constants near the top of the
`<script>` block:
```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-public-key';
```
The anon key is designed to be public — it can only *read*, thanks to the
Row Level Security policies in `schema.sql`. All writes (adding a client,
generating an invoice, marking something paid) go through your own `/api`
routes, authenticated with the secret service role key on the server, so
this is safe even though it's visible in the page source.

### 4. Deploy
```
npm install
vercel --prod
```
That's it — no Blob store, no persistent disk needed.

## What's in each table

**`invoice_log`** — one row per delivered piece of work:
`sr_no` (auto), `person`, `company_theme`, `topic`, `date_of_delivery`,
`date_of_payment`, `price`, `invoice_details`, `client_id`, `contact`,
`platform`, `scope`, `due_date`.

**`clients`** — the directory: `id_code`, `name`, `company_theme`,
`contact`, `joined`, `orders`.

The `/api/download` route reads both tables and assembles them into an
`.xlsx` with the exact same column headers as your original spreadsheet
(extra app-only columns ride along after "Invoice Details").

## API reference

| Method | Path            | Purpose                                              |
|--------|-----------------|---------------------------------------------------------|
| GET    | `/api/items`    | All invoice-log rows                                     |
| POST   | `/api/items`    | Add one or more rows as one invoice batch                 |
| PATCH  | `/api/items`    | Mark a row (`srNo`) or a whole batch (`invoiceDetails`) paid, or edit fields |
| DELETE | `/api/items`    | Remove a row (`srNo`)                                     |
| GET    | `/api/clients`  | All clients                                               |
| POST   | `/api/clients`  | Register a new client                                     |
| DELETE | `/api/clients`  | Remove a client (`id`)                                    |
| GET    | `/api/download` | Download a fresh `.xlsx` built from current data          |

## Notes

- Writes are no longer at risk of the "two people save at once, one write
  disappears" problem the file-based version had — each update is a
  targeted SQL statement, and the client order-count bump uses an atomic
  Postgres function (`increment_client_orders`) instead of a read-then-write.
- If you ever want to add real authentication (so only specific people can
  open the app at all, not just "whoever has the link"), Supabase Auth
  plugs in cleanly on top of this — happy to wire that up if you want it.
