# Job Centre Uganda

Full-stack implementation of the platform described in the Blueprint (§1–§12)
and mockups. **Phase 1** covered design system, auth/RBAC, public pages, job
posting → moderation → publish, apply, basic Seeker/Company portals, and
admin moderation. **Phase 2** (this update) adds real-time chat, resume/logo
file uploads, drag-and-drop candidate pipeline, and pgvector-based semantic
matching.

## Stack

- **API** — NestJS (TypeScript), PostgreSQL via Prisma, JWT (short-lived
  access token in memory + httpOnly refresh cookie), argon2 password hashing.
- **Web** — Next.js 14 App Router, TypeScript, Tailwind CSS using the exact
  tokens from Blueprint §5 (`apps/web/tailwind.config.ts`). Public pages are
  server components (SSR); the three portals are client-rendered behind auth.
- **Matching** — deterministic rules (`matching.service.ts`: skills overlap /
  location / salary fit / experience) blended 50/50 with real pgvector
  cosine-similarity (`embeddings.service.ts`, OpenAI `text-embedding-3-small`)
  whenever both sides have an embedding. Falls back to rules-only if
  `OPENAI_API_KEY` isn't set — the app works either way.
- **Chat** — Socket.IO gateway (`chat.gateway.ts`, namespace `/chat`, JWT
  handshake auth) for live delivery, backed by REST endpoints
  (`chat.controller.ts`) for history/listing so a client works even before
  the socket connects.
- **File uploads** — resume (PDF/Word, 5MB) and company logo (PNG/JPEG/WebP,
  2MB) via `multer` disk storage under `LOCAL_STORAGE_DIR`, served back at
  `/uploads/...` (outside the `/api/v1` prefix — see `main.ts`).
- **Local infra** — Postgres, now on the `pgvector/pgvector:pg16` image
  (adds the `vector` extension; same PG16 data format as plain
  `postgres:16`), also standing in for OpenSearch via `ILIKE` search — Phase
  1 substitute, see `jobs.service.ts`), Redis, both via `docker-compose.yml`.
  No cloud accounts needed beyond an optional OpenAI key.

## Run it

```bash
cp .env.example apps/api/.env        # then trim to the api section
cp .env.example apps/web/.env.local  # then trim to the web section

docker compose up -d                 # postgres + redis
npm install                          # installs both workspaces

npm run db:migrate --workspace=apps/api   # creates tables (first run: prisma migrate dev)
npm run db:seed                            # demo companies/jobs/users

npm run dev:api    # http://localhost:4000/api/v1
npm run dev:web    # http://localhost:3000
```

### Demo logins (password: `Password123!`)

| Role | Email |
|---|---|
| Admin | `admin@jobcentre.ug` |
| Company owner | `owner@stanbicholdings.ug` (also `owner@airfieldgroup.ug`, `owner@nexuslabs.ug`, etc. — one per seeded company) |
| Job seeker | `sarah.nakato@example.com` |

## What's implemented

**Public:** Homepage, Job Search & Filter, Job Detail (apply + save + live
match score + message company), Company Profile, Login/Register (role split).

**Seeker portal** (`/dashboard`): Dashboard (strength meter, recommendations),
Applications board (4-stage, withdraw, message recruiter), Messages
(real-time chat), Saved Jobs, Profile/resume editor (+ resume file upload).

**Company portal** (`/company`): Dashboard (KPIs + job table), Post a Job
(4-step: details → requirements → salary & screening → preview/publish),
Manage Jobs (tabs, pause/resume/close), Candidate Pipeline (5-stage
drag-and-drop board — drag a card between columns to move stage, drag to the
reject zone for a required-reason rejection), Messages (real-time chat),
Settings & Branding (logo upload, company profile).

**Admin portal** (`/admin`): Dashboard (counts + pending-moderation alert +
semantic-matching embeddings backfill), Job Moderation queue (auto-flags,
approve/reject/escalate), Users & Companies (suspend/reactivate, verify/reject).

## Deliberately deferred to later phases

Per the confirmed Phase-2 scope: video resumes, skill assessments, interview
scheduling, billing/credits/boosts, CMS/blog, analytics charts. The schema
and module boundaries (`apps/api/prisma/schema.prisma`, module structure)
leave room for all of these without a rewrite.

## Known simplifications worth knowing about

- **Search** uses Postgres `ILIKE`, not OpenSearch. Fine at seed-data scale;
  swap `jobs.service.ts#search` for an OpenSearch client when volume grows.
- **Semantic matching needs an OpenAI key.** Without `OPENAI_API_KEY` set in
  `apps/api/.env`, matching silently falls back to the rule-based score only
  — nothing breaks, scores are just less precise. Get a key at
  https://platform.openai.com/api-keys, add it, then either re-save a
  profile/job (which re-embeds automatically) or click **Run backfill** on
  the admin dashboard to embed everything that predates the key.
- **Resume text vs. resume file** are separate: the `resumeText` textarea on
  the profile page is what gets embedded and drives the match score; the
  uploaded PDF/Word file (below it) is just a downloadable artifact for
  recruiters — its contents aren't parsed or embedded.
- **Chat has no typing indicators, read receipts beyond a single
  unread-count, or file attachments** — text messages only.

## Verified in this environment

`npm install`, `npx prisma generate`, and production builds of both
`apps/api` (`nest build`) and `apps/web` (`next build`) succeed cleanly here
(Node 24, Windows). With Docker running: `docker compose up -d` (Postgres on
the `pgvector/pgvector:pg16` image + Redis), `prisma migrate dev` and
`prisma db seed` both succeed, and both dev servers were started and smoke
tested — `GET /api/v1/jobs` returns seeded jobs, the homepage renders them,
and the full chat flow (start conversation → send both directions → unread
count → history) was exercised end-to-end over REST. `OPENAI_API_KEY` was
left blank in this environment, so semantic matching itself (the embedding
calls) was not exercised live — only its fallback-to-rules-only path.
