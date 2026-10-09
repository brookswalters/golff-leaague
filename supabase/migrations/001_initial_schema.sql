-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Leagues
create table leagues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- Seasons
create table seasons (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid references leagues(id) on delete cascade,
  year int not null,
  start_date date,
  end_date date,
  course_par int not null default 72,
  handicap_rounds int not null default 5,
  handicap_allowance numeric not null default 0.90,
  skins_buyin numeric not null default 2.00,
  skins_gross boolean not null default true,
  skins_carryover boolean not null default true,
  ghost_mode text not null default 'net_bogey',
  first_tee_time time not null default '09:00',
  tee_interval_min int not null default 7,
  created_at timestamptz default now()
);

-- Players
create table players (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid references leagues(id) on delete cascade,
  name text not null,
  email text,
  is_senior boolean not null default false, -- 65 and over = gold tees both nines
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Teams
create table teams (
  id uuid primary key default uuid_generate_v4(),
  season_id uuid references seasons(id) on delete cascade,
  name text not null,
  player1_id uuid references players(id),
  player2_id uuid references players(id),
  is_ghost boolean not null default false,
  created_at timestamptz default now()
);

-- Weeks
create table weeks (
  id uuid primary key default uuid_generate_v4(),
  season_id uuid references seasons(id) on delete cascade,
  number int not null,
  date date not null,
  status text not null default 'scheduled', -- scheduled | complete | rainout
  created_at timestamptz default now(),
  unique(season_id, number)
);

-- Matches
create table matches (
  id uuid primary key default uuid_generate_v4(),
  week_id uuid references weeks(id) on delete cascade,
  team_a_id uuid references teams(id),
  team_b_id uuid references teams(id),
  tee_time time,
  created_at timestamptz default now()
);

-- Match players (snapshot of handicap used)
create table match_players (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id),
  team_id uuid references teams(id),
  handicap_used int not null default 0,
  strokes_received int not null default 0,
  is_sub boolean not null default false,
  is_absent boolean not null default false,
  created_at timestamptz default now()
);

-- Scores (one row per player per round hole 1–18)
create table scores (
  id uuid primary key default uuid_generate_v4(),
  match_player_id uuid references match_players(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  gross int not null check (gross between 1 and 15),
  unique(match_player_id, hole_number)
);

-- Handicap history (snapshot per player per week)
create table handicap_history (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references players(id) on delete cascade,
  season_id uuid references seasons(id) on delete cascade,
  week_number int not null,
  handicap int not null,
  gross_score int, -- the score from that week (null if absent)
  created_at timestamptz default now(),
  unique(player_id, season_id, week_number)
);

-- Match results cache (recomputable)
create table match_results (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade unique,
  team_a_points numeric not null default 0,
  team_b_points numeric not null default 0,
  team_a_hole_points numeric not null default 0,
  team_b_hole_points numeric not null default 0,
  team_a_front_points numeric not null default 0,
  team_b_front_points numeric not null default 0,
  team_a_back_points numeric not null default 0,
  team_b_back_points numeric not null default 0,
  team_a_overall_points numeric not null default 0,
  team_b_overall_points numeric not null default 0,
  updated_at timestamptz default now()
);

-- Skins results cache
create table skins_results (
  id uuid primary key default uuid_generate_v4(),
  week_id uuid references weeks(id) on delete cascade,
  player_id uuid references players(id),
  hole_number int not null,
  gross int not null,
  payout numeric not null default 0,
  created_at timestamptz default now()
);

-- Skins opt-ins per week
create table skins_optins (
  id uuid primary key default uuid_generate_v4(),
  week_id uuid references weeks(id) on delete cascade,
  player_id uuid references players(id),
  unique(week_id, player_id)
);

-- Row Level Security
alter table leagues enable row level security;
alter table seasons enable row level security;
alter table players enable row level security;
alter table teams enable row level security;
alter table weeks enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table scores enable row level security;
alter table handicap_history enable row level security;
alter table match_results enable row level security;
alter table skins_results enable row level security;
alter table skins_optins enable row level security;

-- Public read policies (anyone can read)
create policy "public read" on leagues for select using (true);
create policy "public read" on seasons for select using (true);
create policy "public read" on players for select using (true);
create policy "public read" on teams for select using (true);
create policy "public read" on weeks for select using (true);
create policy "public read" on matches for select using (true);
create policy "public read" on match_players for select using (true);
create policy "public read" on scores for select using (true);
create policy "public read" on handicap_history for select using (true);
create policy "public read" on match_results for select using (true);
create policy "public read" on skins_results for select using (true);
create policy "public read" on skins_optins for select using (true);

-- Admin write policies (service role bypasses RLS; for anon key with admin check, we use a simple approach)
-- For now: allow all inserts/updates/deletes from authenticated users
-- (Admin logs in via Supabase magic link, so they are "authenticated")
create policy "admin write" on leagues for all using (auth.role() = 'authenticated');
create policy "admin write" on seasons for all using (auth.role() = 'authenticated');
create policy "admin write" on players for all using (auth.role() = 'authenticated');
create policy "admin write" on teams for all using (auth.role() = 'authenticated');
create policy "admin write" on weeks for all using (auth.role() = 'authenticated');
create policy "admin write" on matches for all using (auth.role() = 'authenticated');
create policy "admin write" on match_players for all using (auth.role() = 'authenticated');
create policy "admin write" on scores for all using (auth.role() = 'authenticated');
create policy "admin write" on handicap_history for all using (auth.role() = 'authenticated');
create policy "admin write" on match_results for all using (auth.role() = 'authenticated');
create policy "admin write" on skins_results for all using (auth.role() = 'authenticated');
create policy "admin write" on skins_optins for all using (auth.role() = 'authenticated');
