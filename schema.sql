-- Run this once in Supabase → SQL Editor.

create table if not exists clients (
  id_code text primary key,
  name text not null,
  company_theme text default '',
  contact text default '',
  joined date default current_date,
  orders integer default 0
);

create table if not exists invoice_log (
  sr_no bigint generated always as identity primary key,
  person text not null,
  company_theme text default '',
  topic text not null,
  date_of_delivery date,
  date_of_payment date,
  price numeric default 0,
  invoice_details text default '',
  client_id text references clients(id_code) on delete set null,
  contact text default '',
  platform text default '',
  scope text default '',
  due_date date
);

-- Row Level Security: anyone with the public anon key can READ (needed for
-- the browser to subscribe to Realtime changes), but only the server
-- (using the service role key, which bypasses RLS) can write. The browser
-- never writes directly to Supabase — all writes go through your /api
-- routes so business logic (SR NO, batching, order counts) stays enforced.
alter table clients enable row level security;
alter table invoice_log enable row level security;

create policy "public read access" on clients for select using (true);
create policy "public read access" on invoice_log for select using (true);

-- Atomic order-count bump, called by the server when an invoice is generated
-- for a known client — avoids a read-then-write race between admins.
create or replace function increment_client_orders(p_client_id text, p_amount int)
returns void as $$
begin
  update clients set orders = orders + p_amount where id_code = p_client_id;
end;
$$ language plpgsql;

-- Enable Realtime so every connected admin gets pushed changes instantly.
alter publication supabase_realtime add table clients, invoice_log;
