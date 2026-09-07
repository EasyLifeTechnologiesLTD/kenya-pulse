# Kenya Citizen Pulse — API

Backend for the Kenya Citizen Pulse mobile app: an anonymous civic-sentiment
platform. Built with **Express + MongoDB (Mongoose)**.

## Setup

```bash
npm install
cp .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm run seed            # loads sample data matching the app mockups
npm run dev              # starts on http://localhost:4000
```

You'll need a MongoDB connection string — the fastest path is a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

## Auth model

There are no user accounts, passwords, or personal data. On first launch,
the app calls `POST /api/users/register-anon`, which creates a random
`anonId` and returns a long-lived JWT. The app stores that token locally
(e.g. SecureStore / Keychain) and sends it as `Authorization: Bearer <token>`
on any write request. This is what lets us track streaks and achievements
without identifying anyone.

## Endpoints

| Screen             | Method & Path                                   | Notes                                               |
| ------------------ | ----------------------------------------------- | --------------------------------------------------- |
| Home Dashboard     | `GET /api/home/summary`                         | Kenya Mood Index, trending, AI daily summary        |
| Home Dashboard     | `GET /api/questions/today`                      | Today's question + category options                 |
| Home Dashboard     | `POST /api/responses` 🔒                        | "Submit My Voice" — updates streak/achievements     |
| Home Dashboard     | `GET /api/counties`                             | All counties for the mood map                       |
| County View        | `GET /api/counties/:name`                       | Mood score, top issues, trend, sub-county breakdown |
| Community Insights | `GET /api/community?scope=all\|county&county=X` | Paginated feed                                      |
| Community Insights | `POST /api/community` 🔒                        | "Share an Insight"                                  |
| Community Insights | `POST /api/community/:id/agree` 🔒              | Heart / agree action                                |
| My Contribution    | `GET /api/users/me/contribution` 🔒             | Today's status, streak, achievements                |
| Onboarding         | `POST /api/users/register-anon`                 | First-launch anonymous identity                     |
| Onboarding         | `PATCH /api/users/me/county` 🔒                 | Set home county                                     |

🔒 = requires `Authorization: Bearer <token>`

## Project structure

```
config/         MongoDB connection
models/         Mongoose schemas (User, County, DailyQuestion, Response,
                CommunityPost, MoodSnapshot)
controllers/    Route handler logic
routes/         Express routers, one per resource
middleware/     Anonymous auth, rate limiting, validation, error handling
utils/          asyncHandler wrapper, seed script
app.js          Express app + middleware wiring
server.js       Entry point, connects DB then starts listening
```

## Counties

`utils/kenyaCounties.js` holds the reference list of all 47 Kenyan
counties. `npm run seed` inserts all of them (Kisumu, Nairobi, Mombasa, and
Nakuru get richer mock data matching the app's mockups; everyone else
starts at a neutral score of 50 until real responses come in). The mobile
app's county picker reads this list live via `GET /api/counties` rather
than hardcoding it client-side, so keep this file as the single source of
truth if you need to rename or add counties.

## Mood aggregation

`utils/aggregateMood.js` turns raw `Response` documents into the numbers the
app actually displays:

- Each category (water, jobs, cost of living, etc.) has a weight reflecting
  how strongly it signals distress. Averaging the weights of a day's
  responses produces a 0–100 mood score (50 = neutral, no data yet).
- It updates every county's `moodScore`, `sentiment`, `topIssues`, and rolls
  the `trend30Days` window forward one day.
- It upserts today's national `MoodSnapshot` (used by the Home Dashboard),
  computing `changeFromPrevious` and the top trending categories against
  yesterday's snapshot.

Run it manually any time with:

```bash
npm run aggregate
```

For production, run it on a schedule rather than inside the request/response
cycle. Two options are included:

1. **`npm run scheduler`** — a small standalone process using `node-cron`
   (default: hourly, `AGGREGATION_CRON` env var to change it) that shells
   out to `aggregateMood.js`. Deploy this as a second process/service
   alongside the API — don't run it in-process with `server.js`, so a
   scheduler crash never takes down request handling.
2. **Host-native scheduling** — e.g. Render Cron Jobs, Railway Cron, or a
   MongoDB Atlas Scheduled Trigger calling the same script. Preferred in
   production since the platform handles retries/monitoring for you.

The category weights in `CATEGORY_WEIGHT` are a simple, transparent starting
point — tune them with real usage data, or extend the scoring to include
sentiment analysis on the free-text `note` field.

## Docker deployment

The stack is four containers: **mongo** (self-hosted, data persisted in a
named volume), **api**, **scheduler** (runs mood aggregation hourly,
separate from the API process so a scheduler crash never takes down
request handling — see "Mood aggregation" above), and **caddy** (reverse
proxy + automatic HTTPS). Only Caddy is exposed to the internet; Mongo and
the API are only reachable inside the Docker network.

> **Before your first build:** this repo doesn't include a
> `package-lock.json` yet (it's never had `npm install` run against it).
> Run `npm install` locally once and commit the resulting lockfile — the
> Dockerfile works without it (falls back to `npm install` inside the
> build), but builds won't be reproducible until a lockfile exists. Once
> committed, switch the `RUN npm install ...` line in `Dockerfile` to
> `RUN npm ci --omit=dev` for faster, reproducible builds.

### One-time server setup

On a fresh Ubuntu/Debian server:

```bash
# Install Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in after this

# Point your domain's DNS A record at this server's IP before continuing -
# Caddy needs that to succeed at issuing a TLS certificate.
```

### Deploy

```bash
git clone <your-repo-url> kenya-citizen-pulse-api
cd kenya-citizen-pulse-api

cp .env.example .env
nano .env   # fill in MONGO_ROOT_PASSWORD, JWT_SECRET, CLIENT_ORIGINS at minimum

nano Caddyfile   # replace api.yourdomain.com with your real domain

docker compose up -d --build
```

Check everything's healthy:

```bash
docker compose ps
docker compose logs -f api
curl https://api.yourdomain.com/health
```

Seed the database (all 47 counties + today's question + sample community
posts — safe to skip in a real production launch, but useful to sanity
-check the deploy):

```bash
docker compose run --rm api npm run seed
```

### Day-to-day

```bash
# View logs
docker compose logs -f api
docker compose logs -f scheduler

# Ship a new version
git pull
docker compose up -d --build

# Run aggregation manually (the scheduler container already does this hourly)
docker compose run --rm api npm run aggregate

# Stop everything
docker compose down          # keeps the mongo_data volume
docker compose down -v       # also deletes it - careful, this is your database
```

### Security notes specific to this stack

- Mongo has **no published port** — it's only reachable from the `api` and
  `scheduler` containers over the internal Docker network, not from the
  internet or even the host's other processes.
- Set a real `MONGO_ROOT_PASSWORD` and `JWT_SECRET` before first boot —
  both default to placeholder text in `.env.example` that must be changed.
- `docker-compose.yml` builds `MONGO_URI` itself from
  `MONGO_ROOT_USERNAME`/`MONGO_ROOT_PASSWORD` and overrides whatever Atlas
  URI is in `.env` — that Atlas value is only used when running the API
  directly with `npm run dev` outside Docker.
- Docker's restart policy (`unless-stopped`) brings containers back after a
  crash or server reboot, but only if the Docker daemon itself is set to
  start on boot: `sudo systemctl enable docker`.

## Design notes

- **Rate limiting**: writes (submitting a response / community post) are
  capped at 20/hour per IP since the platform is anonymous and needs abuse
  protection without user accounts to ban.
- **Moderation**: `CommunityPost.moderationStatus` defaults to `approved`
  for MVP simplicity but is there to plug in a moderation queue or
  AI content filter later, matching the "No toxic comments" requirement
  from the design spec.

## Next steps to discuss

1. Basic content moderation (keyword filter or an AI moderation call) on
   community posts before they go live.
2. An `aiDailySummary` generator (e.g. a scheduled call to the Claude API
   summarizing the day's responses) to replace the seeded placeholder text.
3. Deployment target — Render/Railway/Fly.io are simple options for an
   Express + MongoDB Atlas stack, with the scheduler run as a second
   service/worker.
