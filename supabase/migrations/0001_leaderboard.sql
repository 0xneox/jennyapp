-- JennyDoko global leaderboard.
--
-- Run once in the Supabase dashboard (SQL Editor -> New query -> paste -> Run).
--
-- Design:
--   * No accounts. A player is a random device secret generated in the app;
--     only its SHA-256 hash is stored here.
--   * No free text. Names are stored as indexes into the word lists in
--     src/data/profileOptions.ts (child-safe by construction, nothing to
--     moderate). Avatars are an index 0..6.
--   * Tables are locked down (RLS on, no policies, no grants). The app can only
--     call the three SECURITY DEFINER functions granted to `anon` below.
--   * Scores are client-reported, so the server clamps every level score to
--     the maximum the scoring formula can produce and limits how far back
--     daily completions can be backfilled.
--
-- Point formula (mirrored in src/utils/leaderboard.ts — keep in sync):
--   total = sum(best score per level)
--         + DAILY_POINTS (500) per completed daily
--         + streak bonus for best streak: 3d=300, 7d=+700, 14d=+1500, 30d=+3000

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.lb_players (
  id uuid primary key default gen_random_uuid(),
  secret_hash bytea not null unique,
  name_adj smallint not null check (name_adj between 0 and 199),
  name_noun smallint not null check (name_noun between 0 and 199),
  name_num smallint not null check (name_num between 0 and 99),
  avatar smallint not null check (avatar between 0 and 6),
  total_points bigint not null default 0,
  best_streak int not null default 0,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_sync_at timestamptz
);

create table if not exists public.lb_level_scores (
  player_id uuid not null references public.lb_players (id) on delete cascade,
  level smallint not null,
  score int not null check (score >= 0),
  primary key (player_id, level)
);

create table if not exists public.lb_daily (
  player_id uuid not null references public.lb_players (id) on delete cascade,
  day date not null,
  primary key (player_id, day)
);

-- Point gains over time, used for the "This week" board. Rows written during a
-- player's first sync (history backfill) are flagged so joining late doesn't
-- dump a whole history into one week.
create table if not exists public.lb_events (
  id bigserial primary key,
  player_id uuid not null references public.lb_players (id) on delete cascade,
  points int not null,
  backfill boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lb_players_total_idx on public.lb_players (total_points desc) where not banned;
create index if not exists lb_events_player_time_idx on public.lb_events (player_id, created_at) where not backfill;

alter table public.lb_players enable row level security;
alter table public.lb_level_scores enable row level security;
alter table public.lb_daily enable row level security;
alter table public.lb_events enable row level security;
revoke all on public.lb_players, public.lb_level_scores, public.lb_daily, public.lb_events from anon, authenticated;

-- Upper bound of calculateLevelScore() for a level: puppies * 100 * 1.5
-- (base + max speed bonus, 3 stars). Tiers are conservative supersets of
-- getLevelConfig()/getLevelMechanics(); tests/leaderboard.test.ts asserts no
-- legitimate score can exceed them.
create or replace function public.lb_max_level_score(p_level int)
returns int language sql immutable as $$
  select case
    when p_level between 1 and 100 then 1500     -- handcrafted, <= 10x10, 1 pup
    when p_level between 101 and 600 then 1200   -- <= 8x8, 1 pup
    when p_level between 601 and 1200 then 3000  -- <= 10x10, 2 pups
    else 0
  end;
$$;

create or replace function public.lb_streak_bonus(p_best int)
returns int language sql immutable as $$
  select (case when p_best >= 3 then 300 else 0 end)
       + (case when p_best >= 7 then 700 else 0 end)
       + (case when p_best >= 14 then 1500 else 0 end)
       + (case when p_best >= 30 then 3000 else 0 end);
$$;

create or replace function public.lb_try_date(p text)
returns date language plpgsql immutable as $$
begin
  if p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p::date;
exception when others then
  return null;
end;
$$;

create or replace function public.lb_parse_levels(p_levels jsonb)
returns table (level int, score int) language sql immutable as $$
  -- CASE guards the casts: WHERE clauses don't short-circuit in Postgres.
  select x.lvl, least(x.pts, public.lb_max_level_score(x.lvl))
  from (
    select case when k.key ~ '^\d{1,4}$' then k.key::int end as lvl,
           case when k.value ~ '^\d{1,7}$' then k.value::int end as pts
    from jsonb_each_text(coalesce(p_levels, '{}'::jsonb)) k
  ) x
  where x.lvl is not null and x.pts > 0 and public.lb_max_level_score(x.lvl) > 0;
$$;

-- Idempotent snapshot sync: the app sends its full local best-score table and
-- daily history every time; the server keeps the max of each and recomputes.
create or replace function public.lb_sync(
  p_secret text,
  p_name_adj int,
  p_name_noun int,
  p_name_num int,
  p_avatar int,
  p_levels jsonb,
  p_days jsonb
)
returns table (total_points bigint, rank bigint)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_hash bytea;
  v_id uuid;
  v_new boolean := false;
  v_last timestamptz;
  v_old_best int := 0;
  v_level_gain bigint := 0;
  v_new_days int := 0;
  v_best int := 0;
  v_total bigint;
begin
  if p_secret is null or length(p_secret) not between 32 and 128 then
    raise exception 'invalid secret';
  end if;
  p_levels := coalesce(p_levels, '{}'::jsonb);
  p_days := coalesce(p_days, '[]'::jsonb);
  if jsonb_typeof(p_levels) <> 'object' or jsonb_typeof(p_days) <> 'array' then
    raise exception 'invalid payload';
  end if;
  if (select count(*) from jsonb_object_keys(p_levels)) > 1300 or jsonb_array_length(p_days) > 400 then
    raise exception 'payload too large';
  end if;

  v_hash := digest(p_secret, 'sha256');
  select p.id, p.last_sync_at, p.best_streak into v_id, v_last, v_old_best
    from lb_players p where p.secret_hash = v_hash for update;

  if v_id is null then
    insert into lb_players (secret_hash, name_adj, name_noun, name_num, avatar, last_sync_at)
    values (v_hash, p_name_adj, p_name_noun, p_name_num, p_avatar, now())
    returning id into v_id;
    v_new := true;
  else
    update lb_players set name_adj = p_name_adj, name_noun = p_name_noun,
      name_num = p_name_num, avatar = p_avatar, last_sync_at = now()
    where id = v_id;
    -- Profile edits always apply; score work is rate-limited.
    if v_last > now() - interval '3 seconds' then
      return query select p.total_points,
        (select count(*) + 1 from lb_players o where not o.banned and o.total_points > p.total_points)
        from lb_players p where p.id = v_id;
      return;
    end if;
  end if;

  select coalesce(sum(i.score - coalesce(s.score, 0)), 0) into v_level_gain
  from lb_parse_levels(p_levels) i
  left join lb_level_scores s on s.player_id = v_id and s.level = i.level
  where i.score > coalesce(s.score, 0);

  insert into lb_level_scores as s (player_id, level, score)
  select v_id, i.level, i.score from lb_parse_levels(p_levels) i
  on conflict (player_id, level) do update set score = excluded.score
  where excluded.score > s.score;

  -- First sync may backfill up to a year of history; later syncs only accept
  -- the last 7 days (covers offline play and every timezone).
  insert into lb_daily (player_id, day)
  select distinct v_id, d.day
  from (select lb_try_date(x) as day from jsonb_array_elements_text(coalesce(p_days, '[]'::jsonb)) x) d
  where d.day is not null
    and d.day <= current_date + 1
    and d.day >= current_date - (case when v_new then 366 else 7 end)
  on conflict do nothing;
  get diagnostics v_new_days = row_count;

  select coalesce(max(run), 0) into v_best from (
    select count(*) as run from (
      select day - (row_number() over (order by day))::int as grp
      from lb_daily where player_id = v_id
    ) g group by grp
  ) r;

  if v_level_gain > 0 then
    insert into lb_events (player_id, points, backfill) values (v_id, v_level_gain, v_new);
  end if;
  if v_new_days > 0 then
    insert into lb_events (player_id, points, backfill) values (v_id, v_new_days * 500, v_new);
  end if;
  if lb_streak_bonus(v_best) > lb_streak_bonus(v_old_best) then
    insert into lb_events (player_id, points, backfill)
    values (v_id, lb_streak_bonus(v_best) - lb_streak_bonus(v_old_best), v_new);
  end if;

  select coalesce(sum(score), 0) into v_total from lb_level_scores where player_id = v_id;
  v_total := v_total
    + 500 * (select count(*) from lb_daily where player_id = v_id)
    + lb_streak_bonus(v_best);

  update lb_players set total_points = v_total, best_streak = greatest(best_streak, v_best)
  where id = v_id;

  return query select v_total,
    (select count(*) + 1 from lb_players o where not o.banned and o.total_points > v_total);
end;
$$;

-- Top 100 for 'all' (all-time) or 'week' (last 7 days), plus the caller's own
-- row when p_secret is given and they're outside the top 100.
create or replace function public.lb_leaderboard(p_period text, p_secret text default null)
returns table (
  rank bigint, name_adj smallint, name_noun smallint, name_num smallint,
  avatar smallint, points bigint, is_me boolean
)
language sql stable security definer set search_path = public, extensions as $$
  with me as (
    select p.id from lb_players p
    where p_secret is not null and p.secret_hash = digest(p_secret, 'sha256')
  ),
  scored as (
    select p.id, p.name_adj, p.name_noun, p.name_num, p.avatar, p.created_at,
      case when p_period = 'week' then coalesce((
        select sum(e.points) from lb_events e
        where e.player_id = p.id and not e.backfill and e.created_at > now() - interval '7 days'
      ), 0) else p.total_points end as points
    from lb_players p
    where not p.banned
  ),
  ranked as (
    select s.*,
      rank() over (order by s.points desc) as rnk,
      row_number() over (order by s.points desc, s.created_at) as rn
    from scored s
    where s.points > 0 or s.id in (select id from me)
  )
  select r.rnk, r.name_adj, r.name_noun, r.name_num, r.avatar, r.points,
         r.id in (select id from me)
  from ranked r
  where r.rn <= 100 or r.id in (select id from me)
  order by r.rn;
$$;

-- "Leave leaderboard": removes the player and every score row (cascade).
create or replace function public.lb_delete(p_secret text)
returns void language sql security definer set search_path = public, extensions as $$
  delete from lb_players where secret_hash = digest(p_secret, 'sha256');
$$;

revoke all on function public.lb_max_level_score(int), public.lb_streak_bonus(int),
  public.lb_try_date(text), public.lb_parse_levels(jsonb) from public, anon, authenticated;
revoke all on function public.lb_sync(text, int, int, int, int, jsonb, jsonb),
  public.lb_leaderboard(text, text), public.lb_delete(text) from public;
grant execute on function public.lb_sync(text, int, int, int, int, jsonb, jsonb),
  public.lb_leaderboard(text, text), public.lb_delete(text) to anon;
