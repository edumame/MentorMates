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

Deploy to Render

Docker

- Go to https://dashboard.render.com and create a new **Web Service**.
- Connect your Git provider and select this repository and branch.
- For "Environment", choose **Docker**.
- Set the **Dockerfile Path** to `worker/Dockerfile` (or the path to the worker Dockerfile in this repo).
- Set the **Build Context** to the repository root or `worker` if needed.
- Add the required environment variables in Render: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STREAM_VIDEO_API_KEY`, `STREAM_VIDEO_SECRET_KEY`, and any others you use.
- Create the service — Render will build using the Dockerfile and run your container. Render will provide the `PORT` environment variable which the app will use.

Notes
- Render sets the `PORT` environment variable at runtime; keep `PORT` respected by the app (default 8080).
- Use the Docker option if you want an identical environment to local and to use the `worker/Dockerfile`.

Docker
```bash
docker build -t screen-vision-worker worker
docker run -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... -e OPENAI_API_KEY=... -e STREAM_VIDEO_API_KEY=... -e STREAM_VIDEO_SECRET_KEY=... -p 8080:8080 screen-vision-worker
```

Endpoints
- `GET /health` -> { ok: true }
- `POST /session/start` body: `{ meetingId, callId, agentUserId, instructions, voice? }`
- `POST /session/stop` body: `{ meetingId }`
- `POST /session/pause` body: `{ meetingId }`
- `POST /session/resume` body: `{ meetingId }`
