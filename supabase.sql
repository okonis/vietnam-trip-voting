create table if not exists public.votes (
  place_id text not null,
  voter text not null check (char_length(voter) between 1 and 60),
  score int not null check (score between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (place_id, voter)
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  place_id text not null,
  voter text not null check (char_length(voter) between 1 and 60),
  comment text not null check (char_length(comment) between 1 and 600),
  created_at timestamptz not null default now()
);

alter table public.votes enable row level security;
alter table public.comments enable row level security;

grant select, insert, update on public.votes to anon;
grant select, insert on public.comments to anon;
grant usage, select on sequence public.comments_id_seq to anon;

drop policy if exists "public read votes" on public.votes;
drop policy if exists "public insert votes" on public.votes;
drop policy if exists "public update votes" on public.votes;
drop policy if exists "public read comments" on public.comments;
drop policy if exists "public insert comments" on public.comments;

create policy "public read votes" on public.votes for select to anon using (true);
create policy "public insert votes" on public.votes for insert to anon with check (true);
create policy "public update votes" on public.votes for update to anon using (true) with check (true);
create policy "public read comments" on public.comments for select to anon using (true);
create policy "public insert comments" on public.comments for insert to anon with check (true);

do $$ begin
  alter publication supabase_realtime add table public.votes;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; end $$;
