# Outbox - Distributed Email Scheduler & Outreach Pipeline

A production-grade, distributed email scheduling engine built with **Node.js, TypeScript, Express, BullMQ, Redis, PostgreSQL (Prisma), Nodemailer (Ethereal), Elasticsearch, React, Vite, and Tailwind CSS**.

The system enforces strict reliability guarantees: **zero cron jobs**, **idempotent sends**, **crash-recovery on restart**, and **atomic hourly rate limiting with next-hour spillover**.

---

## 1. How to Run Backend

The backend contains the **Express API**, **PostgreSQL database (Prisma)**, **Redis queue & cache**, and the **BullMQ worker** (which runs concurrently within the backend process).

### Prerequisites
- **Node.js**: v18+ (v20+ recommended)
- **Docker**: For running PostgreSQL, Redis, and Elasticsearch locally

### Step 1: Start Infrastructure Services
Start PostgreSQL, Redis, and Elasticsearch in Docker:
```bash
docker compose up -d
```
Verify the services are running:
```bash
docker ps
```

### Step 2: Configure Environment Variables
Navigate to the `backend` folder and create your `.env` file:
```bash
cd backend
cp .env.example .env
```
*(See [Section 3](#3-how-to-set-up-ethereal-email--environment-variables) for environment variable descriptions).*

### Step 3: Install Dependencies & Run Database Migrations
```bash
npm install
npx prisma db push
```

### Step 4: Start the Backend Server & Worker
```bash
# Development mode (with live reload)
npm run dev

# Or Production build & run
npm run build
npm start
```

### What Happens on Startup
1. **Database Sync**: Verifies PostgreSQL connection and schema.
2. **Ethereal Accounts**: Automatically seeds 3–5 active Ethereal sender accounts if none exist.
3. **Startup Recovery**: Scans PostgreSQL for `SCHEDULED` emails and reconciles any missing BullMQ jobs in Redis.
4. **BullMQ Worker**: Initializes the worker with concurrency of 5 to process dispatch jobs.
5. **Express API**: Starts listening on `http://localhost:5001`.
6. **Bull Board Queue Dashboard**: Live queue monitoring UI mounted at `http://localhost:5001/admin/queues` (Login: `admin` / password from `ADMIN_PASSWORD` in `.env`).

---

## 2. How to Run Frontend

The frontend is a React single-page application built with Vite and Tailwind CSS.

### Step 1: Configure Frontend Environment
Navigate to the `frontend` directory and create the `.env` file:
```bash
cd frontend
cp .env.example .env
```
Verify `VITE_API_BASE_URL` points to your backend:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

### Step 2: Install Dependencies & Run Development Server
```bash
npm install
npm run dev
```
Open your browser at **`http://localhost:5173`**.

### Production Build
To create an optimized production build:
```bash
npm run build
```
The output will be generated in the `frontend/dist` directory.

---

## 3. How to Set Up Ethereal Email & Environment Variables

### Setting Up Ethereal Email
[Ethereal](https://ethereal.email) is a zero-configuration, fake SMTP testing service by Nodemailer. It accepts real SMTP connections and generates temporary web preview URLs without delivering to real mailboxes.

1. **Automatic Account Seeding (Zero Setup Required)**:
   - On backend boot, the service checks the `SenderAccount` database table.
   - If empty, it calls `nodemailer.createTestAccount()` to create 3–5 independent Ethereal sender accounts and saves them in PostgreSQL.
   - These accounts are rotated round-robin across outgoing emails.
2. **Viewing Sent Emails**:
   - Every sent email generates a live web preview URL (`nodemailer.getTestMessageUrl(info)`).
   - This URL is stored in the database (`email.etherealUrl`) and displayed as a clickable link in the **Sent Emails** table and the **Email Detail** modal.
3. **Adding Custom Senders (Optional)**:
   - You can add additional senders via `POST /api/senders` with custom SMTP credentials (`host`, `port`, `user`, `pass`).

---

### Environment Variables Reference

#### Backend (`backend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5001` | Express server port |
| `NODE_ENV` | `development` | Environment (`development` or `production`) |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin for frontend |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/emailscheduler?schema=public` | PostgreSQL connection string |
| `REDIS_URL` | `""` | Direct Redis URL (e.g. `rediss://default:pass@host:6379`). Auto-sanitized with TLS support. |
| `REDIS_HOST` | `localhost` | Fallback Redis host if `REDIS_URL` is omitted |
| `REDIS_PORT` | `6379` | Fallback Redis port |
| `REDIS_PASSWORD` | `""` | Fallback Redis password |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch node URL (runs in degraded mode if unavailable) |
| `JWT_SECRET` | `super-secret-jwt-key` | Secret key used to sign session cookies |
| `SESSION_COOKIE_NAME` | `email_scheduler_token` | HttpOnly session cookie name |
| `GOOGLE_CLIENT_ID` | `""` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `""` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5001/api/auth/google/callback` | Authorized Google OAuth redirect URI |
| `SLACK_CLIENT_ID` | `""` | Slack App Client ID |
| `SLACK_CLIENT_SECRET` | `""` | Slack App Client Secret |
| `SLACK_REDIRECT_URI` | `http://localhost:5001/api/slack/callback` | Slack OAuth callback URL (`incoming-webhook` scope) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Hourly rate limit per sender account |
| `MIN_DELAY_PER_SENDER_MS` | `2000` | Minimum delay between two emails from the same sender (ms) |
| `WORKER_CONCURRENCY` | `5` | Number of jobs processed in parallel by the worker |
| `ADMIN_PASSWORD` | `adminsecret` | Password protecting the `/admin/queues` Bull Board dashboard |

#### Frontend (`frontend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:5001/api` | Backend API base URL |

---

## 4. Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    React + Vite + Tailwind Frontend  │
                      │       http://localhost:5173          │
                      └──────────────────┬───────────────────┘
                                         │ REST API & Cookies
                                         ▼
                      ┌──────────────────────────────────────┐
                      │      Express + TypeScript Backend    │
                      │       http://localhost:5001          │
                      └──────┬───────────┬───────────┬───────┘
                             │           │           │
            ┌────────────────┴───┐       │           └──────────────────┐
            ▼                     ▼       ▼                              ▼
 ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  ┌───────────────────────┐
 │ PostgreSQL 16    │  │ Redis 7 (AOF)       │  │ Elasticsearch 8  │  │ Nodemailer / Ethereal │
 │ Prisma ORM       │  │ BullMQ Delayed Queue│  │ Full-Text Search │  │ Multi-sender rotation │
 │ Scheduled & Sent │  │ Atomic Rate Limiter │  │ Fast Queries     │  │ Web preview links     │
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

### How Scheduling Works
- **Zero Cron Jobs**: The system does not use `cron`, `node-cron`, or polling intervals.
- **BullMQ Delayed Queue**: When an email is scheduled, a job is added to BullMQ backed by Redis:
  ```ts
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add('send-email', jobData, { delay, jobId: email.id });
  ```
- **Millisecond Precision**: Redis sorted sets (`ZSET`) hold delayed jobs ordered by their target execution timestamp. When the timestamp arrives, BullMQ automatically moves the job into the active queue for worker pickup.
- **Job ID Idempotency**: The database `Email.id` (UUID) serves as the BullMQ `jobId`. Re-adding an existing email ID is an atomic no-op in Redis, preventing duplicate queue entries.

---

### How Persistence on Restart is Handled
- **PostgreSQL as Source of Truth**: All emails and their lifecycles (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`) are persisted in PostgreSQL.
- **Redis AOF Persistence**: Redis runs with `--appendonly yes`, ensuring delayed jobs survive Redis restarts.
- **Startup Recovery Routine (`runStartupRecovery`)**: Whenever the backend boots:
  1. Scans PostgreSQL for all emails in `SCHEDULED` status.
  2. Queries BullMQ via `emailQueue.getJob(email.id)`.
  3. If a job is missing from Redis (e.g. cache flush or cold restart), it is re-enqueued with remaining delay `Math.max(0, email.scheduledAt - Date.now())`.
  4. Recovers stuck `PROCESSING` emails older than 5 minutes by resetting them to `SCHEDULED` and rescheduling them.
- **Documented Trade-Off**: If the server crashes in the exact millisecond after SMTP dispatch completes but before saving `SENT` in PostgreSQL, startup recovery will resend the email upon boot. This deliberate trade-off favors at-least-once guaranteed delivery over silent data loss.

---

### How Rate Limiting & Concurrency are Implemented

1. **Atomic Redis Lua Counter (Zero-Inflation)**:
   - Each sender tracks its hourly quota using a Redis key: `rate:{senderId}:{YYYYMMDDHH}` with a 2-hour TTL.
   - An atomic Lua script checks if `currentCount >= limit` before incrementing. If the limit is reached, it returns `-1` without incrementing, ensuring skipped or delayed jobs never inflate the quota.
2. **Next-Hour Spillover with Order Preservation**:
   - When all senders reach their hourly limit, excess jobs are rescheduled to the start of the next hour window (`nextHour = currentHour + 1`).
   - To preserve original campaign sequence, each job is offset using its original index:
     ```ts
     const delayMs = nextHour.getTime() + (campaignOrderIndex * delayBetweenSec * 1000);
     await job.moveToDelayed(delayMs, token);
     throw new DelayedError(); // Informs BullMQ to leave job in delayed state
     ```
3. **Multi-Sender Round-Robin Selection**:
   - Senders are chosen via an atomic Redis pointer (`INCR % senderCount`).
   - If the selected sender is at capacity, the algorithm evaluates the next active sender. If all senders are exhausted, the job spills over to the next hour.
4. **Inter-Sender Throttle & Thundering Herd Defense**:
   - Senders enforce a minimum delay (`MIN_DELAY_PER_SENDER_MS`, default 2,000ms) between sends via a Redis key `lock:sender:{senderId}` acquired with `PX 2000 NX`.
   - When multiple workers process a large batch (e.g., 1,000 concurrent jobs) and find the lock held, the job computes `remainingLockMs + randomJitter(100ms - 600ms)`, reschedules with `moveToDelayed()`, and throws `DelayedError`. This prevents all workers from retrying simultaneously.
5. **Configurable Worker Concurrency**:
   - The BullMQ worker processes up to `WORKER_CONCURRENCY` (default 5) non-conflicting jobs concurrently across different senders.
6. **Slack Rate Limit Alerts**:
   - When a sender hits its hourly threshold, an alert is sent via Slack Incoming Webhook.
   - Alerts are deduplicated per sender per hour (`slack:alert:{senderId}:{YYYYMMDDHH}`) to prevent notification spam.

---

## 5. List of Features Implemented

### Backend
- **Scheduler**:
  - Zero-cron scheduling engine using BullMQ delayed queues backed by Redis.
  - Millisecond precision with exact scheduled dispatch timestamps.
  - Batch scheduling for campaign lists with configurable inter-email delays.
- **Persistence**:
  - PostgreSQL schema managed via Prisma ORM (`User`, `Email`, `SenderAccount`, `Campaign`).
  - Redis Append-Only File (AOF) persistence for delayed job recovery.
  - Startup crash recovery routine resolving dropped or orphaned queue jobs.
  - Reconciliation for stale `PROCESSING` jobs.
- **Rate Limiting**:
  - Atomic Redis Lua script reservation preventing skipped-job count inflation.
  - Per-sender hourly send limits (`MAX_EMAILS_PER_HOUR_PER_SENDER`).
  - Next-hour spillover maintaining original campaign position order.
  - Deduplicated Slack channel notifications via Incoming Webhook on rate-limit breach.
- **Concurrency & Throttling**:
  - Multi-worker concurrent execution (`WORKER_CONCURRENCY=5`).
  - Distributed Redis sender locks enforcing 2-second spacing between emails from the same sender.
  - Randomized jitter backoff preventing thundering herd spikes.
  - Atomic round-robin multi-sender rotation.
- **Search & Monitoring**:
  - Elasticsearch 8 integration with fuzzy multi-match full-text search across recipients, subject, and body.
  - Degraded mode fallback allowing search and dispatch to continue if Elasticsearch is unreachable.
  - Bull Board administrative dashboard mounted at `/admin/queues` with HTTP Basic Auth and session validation.

### Frontend
- **Authentication**:
  - Login page matching Figma specification.
  - One-click Google OAuth authentication with authentic 4-color branding.
  - Email and password authentication with form validation.
- **Navigation & Dashboard**:
  - Responsive sidebar with active status indicators, live badge counts for Scheduled and Sent emails, and storage usage progress.
  - Topbar with full-text search bar and user profile dropdown linking to the Queue Dashboard and logout.
- **Scheduled Emails Table**:
  - Tabulated view matching Figma layout.
  - Distinctive orange timestamp badge with clock icon (`🕒 Tue 9:15:12 AM`).
  - Bold subject lines, message snippets, star toggles, and recipient indicators.
- **Sent Emails Table**:
  - Tabulated history of completed sends with gray "Sent" status badges.
  - Clickable direct links to live Ethereal web message previews.
  - Detailed sent timestamps and recipient tags.
- **Email Detail Modal**:
  - Slide-over detail drawer displaying full email contents.
  - Header with back navigation arrow, archive, star, and delete controls.
  - Sender initial avatar, recipient address, and formatted message body.
  - Attachment preview cards with file icon, name, and size.
- **Compose Modal**:
  - Sender selection dropdown populated from active Ethereal sender accounts.
  - Recipient input supporting direct entry and CSV/TXT list uploads.
  - Lead file parser displaying recipient count chips (`+N` badge).
  - Side-by-side delay and hourly limit parameter configuration inputs.
  - Rich text formatting toolbar (Bold, Italic, Lists, Quotes, Code blocks, Alignment).
  - "Send Later" popover with date/time pickers and preset options (`Tomorrow`, `10:00 AM`).
