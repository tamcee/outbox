# 0NB Email Scheduler & Outreach Pipeline

A production-grade, distributed full-stack email scheduling engine built with **Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL (Prisma), Nodemailer (Ethereal), Elasticsearch, React, Vite, and Tailwind CSS**.

The system matches the Figma design pixel-for-pixel and enforces strict guarantees: **zero cron jobs**, **no email sent twice**, **lossless crash recovery on server restart**, and **resilient hourly rate-limit spillover without dropped jobs**.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    React + Vite + Tailwind (0NB)     │
                      │       http://localhost:5173          │
                      └──────────────────┬───────────────────┘
                                         │ REST API & Cookies
                                         ▼
                      ┌──────────────────────────────────────┐
                      │      Express + TypeScript API        │
                      │       http://localhost:5001          │
                      └──────┬───────────┬───────────┬───────┘
                             │           │           │
           ┌─────────────────┴───┐       │           └──────────────────┐
           ▼                     ▼       ▼                              ▼
┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  ┌───────────────────────┐
│ PostgreSQL 16    │  │ Redis 7 (AOF)       │  │ Elasticsearch 8  │  │ Nodemailer / Ethereal │
│ Prisma ORM       │  │ BullMQ Delayed Queue│  │ Full-Text Search │  │ Multi-sender rotation │
│ Scheduled & Sent │  │ Hourly Rate Counters│  │ Fast Queries     │  │ Live preview links    │
└──────────────────┘  └─────────────────────┘  └──────────────────┘  └───────────────────────┘
                                 ▲
                                 │ Pops delayed jobs
                      ┌──────────┴───────────────────────────┐
                      │    BullMQ Worker (Concurrency: 5)    │
                      │  Atomic State Guard & Spillover      │
                      └──────────────────┬───────────────────┘
                                         │ Rate Limit Alert
                                         ▼
                      ┌──────────────────────────────────────┐
                      │        Slack Incoming Webhook        │
                      │      Real-time Channel Alerts        │
                      └──────────────────────────────────────┘
```

---

## Core Guarantees & Technical Decisions

### 1. Zero Cron Jobs
- No crontab, `node-cron`, or `agenda` is used anywhere in the codebase.
- Scheduling is executed purely via **BullMQ delayed jobs** backed by Redis.
- Delay calculation: `delay = Math.max(0, scheduledAt.getTime() - Date.now())`.

### 2. No Duplicate Sends (Idempotency & Atomic Guard)
- The database `Email.id` (UUID) is strictly assigned as the BullMQ `jobId`.
- Before dispatching via SMTP, the worker runs an atomic state transition in PostgreSQL:
  ```ts
  const updated = await prisma.email.updateMany({
    where: { id: emailId, status: 'SCHEDULED' },
    data: { status: 'PROCESSING', senderId: sender.id }
  });
  if (updated.count === 0) {
    // Row was already claimed, sent, or cancelled. Skip job immediately!
    return;
  }
  ```
- If two workers or concurrent processes ever pull the same job, exactly one can transition the row; the other sees `count === 0` and exits safely.

### 3. Server Restart & Crash Recovery
- Redis runs with `--appendonly yes` persistence so delayed jobs survive Redis restarts.
- On backend boot, `runStartupRecovery()` runs before jobs are dispatched:
  1. Scans PostgreSQL for all `SCHEDULED` emails.
  2. Queries BullMQ via `emailQueue.getJob(email.id)`.
  3. If missing from Redis, re-adds the job with remaining delay `Math.max(0, email.scheduledAt - Date.now())` using `jobId: email.id` (no duplicate jobs created).
  4. Recovers stuck `PROCESSING` emails older than 5 minutes by resetting them to `SCHEDULED` and rescheduling them.
  - **Documented Trade-Off**: If the server crashes in the exact millisecond after SMTP transmission finishes but before saving `SENT` in Postgres, recovery will resend the email upon boot. This deliberate trade-off favors at-least-once guaranteed delivery over silent drop.

### 4. Hourly Rate Limiting & Next-Hour Spillover
- Redis counter per sender per hour window: `rate:{senderId}:{YYYYMMDDHH}` with 2-hour TTL.
- **Zero-Inflation Atomic Lua Reservation**: Rather than incrementing first and checking, an atomic Lua script (`CHECK_AND_INCR_LUA`) checks if `current >= limit`. If reached, it returns `-1` without incrementing, preventing skipped jobs from inflating the hourly count.
- **Spillover Ordering**: When a sender hits its limit, jobs are rescheduled to the start of the next hour window (`nextHour = currentHour + 1`). To maintain original sequence ordering, each job receives an offset based on its original campaign index:
  `delayedUntil = nextHour.getTime() + (campaignOrderIndex * delayBetweenSec * 1000)`.
- BullMQ `job.moveToDelayed(delayedUntil, token)` is called, followed immediately by `throw new DelayedError();` so BullMQ keeps the job in delayed state rather than marking it completed.

### 5. Multi-Sender Selection & Round-Robin Rotation
- On startup, 3–5 Ethereal SMTP accounts are automatically seeded into `SenderAccount` if empty.
- At send time, `rateLimitService.selectAvailableSender()` selects an active sender by rotating round-robin through a Redis atomic pointer (`INCR sender:round_robin:index % activeSenders.length`).
- If a candidate sender has reached its hourly limit, it is skipped in favor of the next available sender with quota remaining.
- If all senders are capped, the job is cleanly delayed to the next hour.

### 6. Inter-Sender Throttle & Thundering Herd Defense
- To respect `MIN_DELAY_PER_SENDER_MS` (default 2,000ms) across multiple workers, a Redis distributed key `lock:sender:{senderId}` is acquired with `PX 2000 NX`.
- When under heavy load (e.g., 1,000 concurrent jobs), if the lock is held, the job computes `remainingLockMs + randomJitter(100ms - 600ms)`, reschedules with `moveToDelayed()`, and throws `DelayedError`. This prevents all 1,000 workers from awakening at the exact same millisecond.

### 7. Resilient Elasticsearch Search
- Every scheduled email is indexed into Elasticsearch (`emails` index).
- Full-text search endpoint `GET /api/emails/search?q=...` performs fuzzy multi-match across `recipient`, `subject`, and `body`.
- **Degraded Fallback**: If Elasticsearch is down or unconfigured, email dispatch and Postgres database search continue running uninterrupted without crashing.

### 8. Slack Rate-Limit Notifications
- Supports Slack OAuth with `incoming-webhook` scope.
- When an hourly limit is breached, an alert is dispatched to the user's chosen Slack channel.
- **Deduplicated**: Alerts are sent once per sender per hour window (`slack:alert:{senderId}:{YYYYMMDDHH}` with `SETNX`), avoiding spamming the user on every spilled job.
- If Slack is disconnected, the system logs and continues silently without errors.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5001` | Express server port (5001 chosen to avoid macOS AirPlay conflict on 5000) |
| `NODE_ENV` | `development` | App environment (`development` / `production`) |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin for frontend |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/emailscheduler?schema=public` | PostgreSQL connection string |
| `REDIS_URL` | `""` | Optional direct Redis URL (e.g. Render Redis) |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | `""` | Redis auth password (optional) |
| `ELASTICSEARCH_NODE`| `http://localhost:9200` | Elasticsearch node URL |
| `JWT_SECRET` | `super-secret-jwt-key` | Secret key used to sign session cookies |
| `SESSION_COOKIE_NAME` | `email_scheduler_token` | HttpOnly cookie session name |
| `GOOGLE_CLIENT_ID` | `""` | Google OAuth Web Application Client ID |
| `GOOGLE_CLIENT_SECRET` | `""` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5001/api/auth/google/callback` | Authorized redirect URI for Google OAuth |
| `SLACK_CLIENT_ID` | `""` | Slack App Client ID |
| `SLACK_CLIENT_SECRET`| `""` | Slack App Client Secret |
| `SLACK_REDIRECT_URI` | `http://localhost:5001/api/slack/callback` | OAuth redirect URI for Slack |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Default hourly limit per sender account |
| `MIN_DELAY_PER_SENDER_MS` | `2000` | Minimum throttle delay between sends per sender |
| `WORKER_CONCURRENCY` | `5` | Number of concurrent jobs processed by the worker |
| `ADMIN_PASSWORD` | `adminsecret` | Password protecting `/admin/queues` Bull Board dashboard |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:5001/api` | Backend API URL |

---

## Quick Start & Running Locally

### 1. Start Infrastructure (Docker Compose)
Spins up PostgreSQL 16, Redis 7 (AOF enabled), and Elasticsearch 8:
```bash
docker compose up -d
```
Verify containers are healthy:
```bash
docker ps
```

### 2. Setup & Start Backend
```bash
cd backend
npm install
npx prisma db push
npm run dev
```
The backend will:
- Initialize the Elasticsearch index
- Seed 3 Ethereal test accounts automatically
- Run startup recovery on any pending jobs
- Start the BullMQ worker
- Serve on `http://localhost:5001`

### 3. Setup & Start Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## Accessing Dashboards & Testing

- **Frontend App**: `http://localhost:5173`
- **Live Bull Board Queue Dashboard**: `http://localhost:5001/admin/queues`
  - Username: `admin`
  - Password: `adminsecret` (configured in `.env`)
  - Or click **"Queue Dashboard"** from the user dropdown in the app (auto-authenticated via session cookie).
- **Backend Health Check**: `http://localhost:5001/health`

### Running the 1,000+ Email Load Test
To demonstrate the queue handling 1,000+ emails and spilling over into the next hour:
```bash
cd backend
npm run load-test
```
You can inspect the spillover live on the Bull Board dashboard (`/admin/queues`).

---

## Frontend Design & Features

The UI faithfully implements all Figma layouts and screens:
1. **Login Page (`/login`)**:
   - Clean centered white card with "0NB" typography.
   - Light green `Login with Google` button with authentic Google 4-color icon.
   - Divider `or sign up through email` with Email/Password inputs and green `Login` button.
2. **Scheduled Tab**:
   - Recipient `To: [Email]`.
   - Orange timestamp pill with clock icon: `🕒 Tue 9:15:12 AM`.
   - Subject in bold with body preview snippet and star toggle.
3. **Sent Tab**:
   - Status badge `Sent` in gray pill.
   - Direct clickable link to the Ethereal message preview URL.
   - Clickable row opens full Email Detail view.
4. **Email Detail View**:
   - Header with back arrow `←`, subject, archive, star, and trash actions.
   - Sender avatar with initial, date, and `to me` details.
   - Rich email body with callout boxes.
   - Attachment preview cards (`Tennis_Coach_Profile.png`, 1.2 MB).
5. **Compose Screen**:
   - `From` dropdown selecting from rotating Ethereal senders.
   - `To` input with `↑ Upload List` button: parses CSV/TXT files and displays green border recipient chips (`+4` badge).
   - Side-by-side numeric inputs: `Delay between 2 emails` and `Hourly Limit`.
   - Rich text formatting toolbar (Bold, Italic, Lists, Blockquote, Code block, Align).
   - `Send Later` popover with custom date/time picker and quick presets (`Tomorrow`, `10:00 AM`, etc.).

---

## Deploying on Render

A `render.yaml` Blueprint is provided at the root:
1. Push this repository to your GitHub account (`https://github.com/tamcee/outbox`).
2. Go to [Render Dashboard](https://dashboard.render.com/) $\rightarrow$ **New +** $\rightarrow$ **Blueprint**.
3. Select your repository. Render automatically provisions PostgreSQL, Redis, Backend Web Service, and Frontend Static Site with zero manual configuration.
4. Detailed step-by-step instructions are available in [`RENDER_DEPLOY_GUIDE.md`](./RENDER_DEPLOY_GUIDE.md).
