-- 20260618_push_tokens.sql
-- Stores Expo push tokens per user so the backend can send remote push
-- notifications via the Expo Push API (https://exp.host/--/api/v2/push/send).
-- One row per device token; a user may have several (multiple devices).

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  platform    text,
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- A user can read/insert/update/delete only their own token rows.
create policy "Users manage own push tokens"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
