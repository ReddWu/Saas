-- DarwinSaaS system of record. Every autonomous run and every event it emits is
-- persisted here, so the InsForge dashboard fills up live during the demo and the
-- whole evolution is auditable after the fact.

create table if not exists darwin_runs (
  id uuid primary key default gen_random_uuid(),
  survivor_title text,
  survivor_url text,
  bet_target int,
  final_seo int,
  won boolean,
  status text not null default 'running',
  created_at timestamptz not null default now()
);

-- One row per emitted pipeline event (stage/log/verdict/kill/bet/deploy/fitness/alert...).
create table if not exists darwin_events (
  id bigserial primary key,
  run_id uuid references darwin_runs(id) on delete cascade,
  seq int not null,
  type text not null,
  stage text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists darwin_events_run_idx on darwin_events(run_id, seq);

-- Demo-friendly read access (the data is non-sensitive showcase data).
alter table darwin_runs enable row level security;
alter table darwin_events enable row level security;

drop policy if exists darwin_runs_read on darwin_runs;
create policy darwin_runs_read on darwin_runs for select using (true);

drop policy if exists darwin_events_read on darwin_events;
create policy darwin_events_read on darwin_events for select using (true);
