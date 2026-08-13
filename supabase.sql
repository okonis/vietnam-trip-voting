create table if not exists public.votes (
  place_id text not null,
  voter text not null,
  score int not null check (score between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (place_id, voter)
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  place_id text not null,
  voter text not null,
  comment text not null,
  created_at timestamptz not null default now()
);

alter table public.votes enable row level security;
alter table public.comments enable row level security;

create policy "public read votes" on public.votes for select using (true);
create policy "public insert votes" on public.votes for insert with check (true);
create policy "public update votes" on public.votes for update using (true);
create policy "public read comments" on public.comments for select using (true);
create policy "public insert comments" on public.comments for insert with check (true);
