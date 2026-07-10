# writingale — backend

A real backend for the writingale invoice tool. All data lives in one genuine
`.xlsx` workbook (two sheets: **Invoice Log** and **Clients**) so you can open
it in Excel any time — there's a **Download Excel** button in the Payment
Management tab for exactly that.

## Why it's not a plain local file

Vercel's serverless functions don't have a persistent local disk — anything
written to disk during one request disappears before the next request runs.
So instead of writing to `workbook.xlsx` directly in production, this backend
stores that same `.xlsx` file in **Vercel Blob storage** and rewrites it on
every change. To you and to Excel, it's still just one spreadsheet file; it's
only the physical location that's different.

If you run this outside Vercel (locally, or on a plain server with a real
disk), it automatically falls back to writing `data/workbook.xlsx` directly —
no Blob store needed. See "Running locally" below.

## What's in the workbook

**Invoice Log** sheet — one row per delivered piece of work, matching your
existing spreadsheet exactly for the first 8 columns:

```
SR. NO. | PERSON(S) OF INTEREST | COMPANY/THEME | TOPIC/TOPIC CODE |
Date Of Delivery | Date of Payment | Price | Invoice Details
```

A few extra columns ride along after that (`Client ID`, `Contact`,
`Platform`, `Scope`, `Due Date`) so the app keeps all its existing features —
they won't disturb the look of the first 8 columns in Excel.

**Clients** sheet — your client directory (`ID Code`, `Name`,
`Company/Theme`, `Contact`, `Joined`, `Orders`).

Both sheets live in the same file and are always rewritten together, so
adding a client or generating an invoice keeps every tab — both the app's UI
tabs and the workbook's own sheet tabs — in sync.

## Deploying to Vercel

1. Push this folder to a GitHub repo (or run `vercel` from inside it).
2. Import the repo in the Vercel dashboard, or run:
   ```
   npm i -g vercel
   vercel
   ```
3. In your Vercel project → **Storage** → **Create Database** → **Blob**,
   create a store and connect it to this project. Vercel will automatically
   set `BLOB_READ_WRITE_TOKEN` for you — you don't need to copy it manually.
4. Redeploy (`vercel --prod`). Visit your deployment URL — the app and API
   are served from the same domain, so nothing else needs configuring.

## Running locally

```
npm install
npm run dev     # runs `vercel dev`, needs the Vercel CLI logged in
```
Without a Blob store connected, it reads/writes `data/workbook.xlsx` on
disk automatically — handy for trying things out before deploying.

## API reference

| Method | Path            | Purpose                                              |
|--------|-----------------|-------------------------------------------------------|
| GET    | `/api/items`    | All invoice-log rows                                  |
| POST   | `/api/items`    | Add one or more rows as one invoice batch              |
| PATCH  | `/api/items`    | Mark a row (`srNo`) or a whole batch (`invoiceDetails`) as paid, or edit fields |
| DELETE | `/api/items`    | Remove a row (`srNo`)                                  |
| GET    | `/api/clients`  | All clients                                            |
| POST   | `/api/clients`  | Register a new client                                  |
| DELETE | `/api/clients`  | Remove a client (`id`)                                 |
| GET    | `/api/download` | Download the live workbook as `writingale-data.xlsx`   |

## A note on concurrency and privacy

- The workbook blob is stored with `access: 'public'`, which keeps the code
  simple, but means anyone with the exact file URL could read it. If this
  data is sensitive, ask me and I can switch it to Vercel Blob's private
  access mode (requires a small server-side change to fetch it with `get()`
  instead of a public URL).
- Two people saving at the exact same instant could race and one write could
  be dropped. For a small team this is unlikely to bite, but if it matters,
  I can add ETag-based conditional writes (`ifMatch`) so a save fails loudly
  instead of silently overwriting a concurrent change.
