/* StoragePro - supabase-setup.sql
   Builds everything StoragePro needs inside the Supabase database: the tables,
   the rule that keeps updated_at current, the access rules for the website, and
   read-only views. Every statement uses "if not exists" or "create or replace",
   so running the file again leaves existing data in place.

   How the data is stored (matches js/store.js):
     - One table per list: staff, customers, lockers, rentals, charges, payments, activity, tickets
     - Each row: id   = the item's id (lockers use their number, like 'A-101')
                 data = the whole item (JSON)
     - app_state holds one row ('main') with the prices, late fee and id counters
     - Money is in cents (4500 = $45.00), dates look like '2026-10-31'
   The *_view views at the bottom show the main tables as normal columns
   (Supabase > Table Editor, or: select * from customers_view;). */


/* 1. Tables
   app_state is created on its own because it holds settings, not a list.
   The other eight all have the same three columns, so each fits on one line.
   updated_at records when a row last changed (filled in automatically).
   ---------------------------------------------------------------------- */
create table if not exists app_state (
    id         text primary key,
    data       jsonb not null,
    updated_at timestamptz not null default now()
);

create table if not exists staff     (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists customers (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists lockers   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists rentals   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists charges   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists payments  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists activity  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists tickets   (id text primary key, data jsonb not null, updated_at timestamptz not null default now());


/* 2. Keeps updated_at current when a row changes
   set_updated_at() stamps the current time on a row as it is updated.
   The loop attaches it to all nine tables as a trigger (it is dropped first
   so the trigger is never added twice).
   ---------------------------------------------------------------------- */
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

do $$
declare t text;
begin
    foreach t in array array['app_state','staff','customers','lockers','rentals','charges','payments','activity','tickets'] loop
        execute format('drop trigger if exists %I_updated_at on %I', t, t);
        execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
    end loop;
end;
$$;


/* 3. Lets the website read and save the tables (with the Publishable key)
   Row level security makes Supabase check a policy before every read or write.
   The "StoragePro website" policy allows every action to the anon and
   authenticated roles; requests made with the publishable key use the anon role.
   Because the policy allows everything, anyone who has the site's key can read and
   change this data, staff passwords included. This suits a beta with sample data;
   protecting real customer data would need Supabase Auth sign-in and stricter policies.
   ---------------------------------------------------------------------- */
do $$
declare t text;
begin
    foreach t in array array['app_state','staff','customers','lockers','rentals','charges','payments','activity','tickets'] loop
        execute format('alter table %I enable row level security', t);
        -- (the policy under the project's earlier name, VaultStorage, is dropped too so the rules aren't doubled)
        execute format('drop policy if exists "VaultStorage website" on %I', t);
        execute format('drop policy if exists "StoragePro website" on %I', t);
        execute format('create policy "StoragePro website" on %I for all to anon, authenticated using (true) with check (true)', t);
        execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
    end loop;
end;
$$;


/* 4. Easy-to-read views (for looking at the data, the website doesn't use them)
   Each view turns the JSON in the data column into ordinary columns, and money
   from cents into dollars (4500 becomes 45.00). security_invoker = on makes a
   view follow the same access rules as the table underneath it.
   ---------------------------------------------------------------------- */
create or replace view lockers_view with (security_invoker = on) as
select id                              as number,
       data->>'row'                    as row,
       data->>'size'                   as size,
       (data->>'maintenance')::boolean as maintenance,
       data->>'maintenanceNote'        as maintenance_note,
       data->>'holdFor'                as hold_for,
       data->>'holdUntil'              as hold_until
from lockers
order by id;

create or replace view customers_view with (security_invoker = on) as
select (data->>'id')::int  as id,
       data->>'name'       as name,
       data->>'phone'      as phone,
       data->>'email'      as email,
       data->>'discount'   as discount,
       data->>'since'      as customer_since,
       data->>'notes'      as notes
from customers
order by (data->>'id')::int;

create or replace view rentals_view with (security_invoker = on) as
select (data->>'id')::int                    as id,
       data->>'locker'                       as locker,
       (data->>'customerId')::int            as customer_id,
       data->>'moveIn'                       as move_in,
       data->>'moveOut'                      as move_out,
       data->>'discount'                     as discount,
       (data->>'baseRate')::numeric / 100    as base_rate,
       (data->>'monthlyRate')::numeric / 100 as monthly_rate
from rentals
order by (data->>'id')::int;

create or replace view charges_view with (security_invoker = on) as
select (data->>'id')::int               as id,
       (data->>'rentalId')::int         as rental_id,
       data->>'due'                     as due,
       data->>'type'                    as type,
       (data->>'amount')::numeric / 100 as amount,
       (data->>'paid')::numeric / 100   as paid,
       data->>'paidOn'                  as paid_on
from charges
order by (data->>'id')::int;

create or replace view payments_view with (security_invoker = on) as
select (data->>'id')::int               as id,
       (data->>'customerId')::int       as customer_id,
       (data->>'amount')::numeric / 100 as amount,
       data->>'method'                  as method,
       data->>'at'                      as paid_at,
       data->>'staff'                   as received_by,
       data->>'receiptNo'               as receipt_no
from payments
order by (data->>'id')::int;
