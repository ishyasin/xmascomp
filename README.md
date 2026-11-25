# The Pharmacy Christmas Competition 2026 (ED&G™)

Static front end for GitHub Pages, back end on Supabase.

## What's in the box

| File | What it is |
|---|---|
| `index.html` | Homepage: countdown to the event, access code, name and email entry, leaderboard |
| `play.html` | Runs the competitions in order with a timer per round, then shows the results |
| `admin.html` | Admin panel (link at the bottom of the homepage): release times, access code, competitions, entries and scores, activity log |
| `privacy.html` | Privacy notice (fill in the yellow `[...]` parts before go-live) |
| `schema.sql` | Supabase tables, functions, security and the 24-hour email deletion job |
| `config.js` | Supabase URL and publishable key (filled in) |
| `common.js`, `site.css` | Shared code and ED&G™ styling |
| `games/reindeer-flight.js` | Round: Reindeer Flight (needs `vendor/three-r128.min.js`) |
| `games/grotto-dash.js` | Round: Grotto Dash |
| `vendor/` | supabase-js 2.45.4 and three.js r128 (no external scripts are loaded) |
| `assets/` | Homepage images |

## Setup

1. **Create a new Supabase project** (UK/EU region).
2. **Run `schema.sql`** in the SQL editor. It enables `pg_cron` and schedules the email clean-up every 15 minutes. If `create extension pg_cron` errors, turn it on under Database > Extensions, then run the last two statements of the email section again.
3. **Set up the event** in the admin panel (below), or with SQL:
   ```sql
   update public.settings set
     event_name      = 'The Pharmacy Christmas Competition 2026',
     event_starts_at = '2026-12-18 12:00+00',   -- countdown target, entries open
     event_ends_at   = '2026-12-19 12:00+00',   -- entries close
     access_code     = 'SLEIGH26',              -- not case-sensitive
     rounds          = array['flight','grotto','quiz'],  -- pick the competitions, in order
     round_seconds   = 300;                     -- per round
   ```
   Competitions available: `flight` (Reindeer Flight), `grotto` (Grotto Dash), `quiz`. Use any one, two or all three, in any order. The homepage cards, the leaderboard columns and the play order follow this setting.
4. **Add quiz questions** (if `quiz` is in `rounds`):
   ```sql
   insert into public.quiz_questions (question, options, correct_index, sort_order)
   values ('Your question here?', array['Answer A','Answer B','Answer C'], 0, 1);
   ```
   `correct_index` is 0-based. Set `active = false` to hide a question. If there are no active questions, the quiz round is skipped.
5. **`config.js`** already holds this project's URL (`cycgxxndxdtozzymhajb`) and publishable key. Change them only if you move to another Supabase project (Project Settings > API Keys).
6. **Push the folder to a GitHub repo** and turn on Pages (Settings > Pages > Deploy from branch, root). A custom domain such as `christmas.edandg.com` can be added there.

## Admin login (one-off setup)

1. Run `schema.sql` (it is safe to run again if you ran an earlier version).
2. In Supabase, **Authentication > Sign In / Providers**: turn **off** "Allow new users to sign up", so nobody else can create an account.
3. **Authentication > Users > Add user > Create new user**: your email and a strong password (tick "Auto confirm user").
4. Make that account an admin (SQL editor):
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'you@example.com';
   ```
5. Open the site, click **Admin login** at the bottom of the page and sign in.

In the admin panel you can:
- **Event**: set the event name, when it opens (the countdown target) and closes, *Open now* / *Close now*, the access code (or *Generate* one), which competitions run and in what order, and minutes per round.
- **Entries and scores**: see everyone who entered (email shows until it is wiped at 24 hours), edit a name or score, hide or show an entry on the leaderboard, delete an entry, export everything to CSV, or delete all entries (type DELETE).
- **Activity log**: every admin change, with who made it and when.

Only accounts in `public.admins` can use the admin functions; anyone else who signs in is refused. To add a second admin, repeat steps 3 and 4. To remove one: `delete from public.admins where email = '...';`

## How entries are protected

- All tables have Row Level Security on with no policies, so the public key cannot read or change anything directly. The site can only call the functions in `schema.sql`.
- The access code is checked on the server, and only while the event is open.
- One entry per email address (case-insensitive). Emails are wiped 24 hours after entry. After that, the same address could enter again, so keep the event window to 24 hours or less if that matters.
- Every score write needs the entry's secret token and must arrive within the entry's time window (all rounds plus 10 minutes).
- Game scores come from the browser, so a determined person could still fake one. They are capped (`max_flight_score`, `max_grotto_score` in `settings`) and only the best per round is kept. Quiz answers are marked on the server; the correct answers are never sent to the browser.

## Running the event

- Hide an entry: `update public.runs set hidden = true where player_name = '...';`
- See entries: Table Editor > `runs`.
- Clear down afterwards: `truncate public.quiz_answers, public.runs;`
