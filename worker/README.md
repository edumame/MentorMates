# Screen Vision Worker

Lightweight Node worker to manage Stream OpenAI realtime sessions and inject screen summaries from Supabase.

Environment variables
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key used by Stream realtime
- `STREAM_VIDEO_API_KEY` - Stream Video API key
- `STREAM_VIDEO_SECRET_KEY` - Stream Video secret key
- `PORT` - port to listen on (default 8080)

Run locally
```bash
cd worker
pnpm install
pnpm dev
```

Build
```bash
cd worker
pnpm build
pnpm start
```

Docker
```bash
docker build -t screen-vision-worker worker
docker run -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... -e OPENAI_API_KEY=... -e STREAM_VIDEO_API_KEY=... -e STREAM_VIDEO_SECRET_KEY=... -p 8080:8080 screen-vision-worker
```

Endpoints
- `GET /health` -> { ok: true }
- `POST /session/start` body: `{ meetingId, agentUserId, instructions }`
- `POST /session/stop` body: `{ meetingId }`

Fly deploy (buildpacks, no Docker)

- Ensure `flyctl` installed and you're logged in:

```bash
fly auth login
```

- Launch (creates `fly.toml` and app) without deploying:

```bash
cd worker
fly launch --no-deploy
```

- Set required secrets (replace values):

```bash
fly secrets set \
	OPENAI_API_KEY="..." \
	NEXT_PUBLIC_STREAM_VIDEO_API_KEY="..." \
	STREAM_VIDEO_SECRET_KEY="..." \
	NEXT_PUBLIC_SUPABASE_URL="..." \
	SUPABASE_SERVICE_ROLE_KEY="..."
```

- Deploy:

```bash
fly deploy
```

Notes:
- `fly.toml` uses the Heroku builder: `heroku/builder:24` (buildpacks). No Dockerfile is required.
- The worker listens on `process.env.PORT` (default 4001) to match Fly `internal_port`.
- If you need a specific pnpm version, set `PNPM_VERSION` in the `[env]` section of `fly.toml` before deploying.

