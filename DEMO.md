# 5-Minute Video Demo Script: 0NB Email Scheduler

This script outlines the exact sequence to demonstrate in a 5-minute walkthrough video.

---

## Preparation (Before Recording)
1. Ensure Docker containers are running:
   ```bash
   docker compose up -d
   ```
2. Start the backend:
   ```bash
   cd backend && npm run dev
   ```
3. Start the frontend:
   ```bash
   cd frontend && npm run dev
   ```
4. Open the following tabs in your browser:
   - **Tab 1**: `http://localhost:5173` (Frontend Dashboard)
   - **Tab 2**: `http://localhost:5001/admin/queues` (Bull Board Dashboard - `admin / adminsecret`)
   - **Tab 3**: (Optional) Your Slack test channel if Slack OAuth credentials are configured.

---

## Step 1: Authentication & Dashboard Overview (0:00 - 0:45)
1. **Show Login Screen**:
   - Point out the clean Figma-matched login screen with `Login with Google` and the email/password form.
   - Click "Login with Google" (or enter your test email and click "Login").
2. **Dashboard Overview**:
   - Show the left sidebar: `0NB` logo, user profile (`Oliver Brown`), green outline `Compose` button, and the **CORE** section (`Scheduled` and `Sent` tabs with live count badges).
   - Point out the top search bar (powered by Elasticsearch) and the `Connect Slack` status pill.

---

## Step 2: Compose & Schedule Emails (0:45 - 1:45)
1. **Open Compose Modal**:
   - Click the green `Compose` button.
   - Point out the `From` dropdown loaded with rotating Ethereal test senders.
2. **Recipient List Upload**:
   - In the `To` field, click `↑ Upload List` and select a sample CSV/TXT file with emails (e.g. `alex@example.com`, `sam@example.com`, `jordan@example.com`).
   - Show how the email addresses parse automatically into green bordered pill chips with a `+N` count.
3. **Set Parameters**:
   - Subject: `Meeting follow-up - Scheduled`
   - Delay between 2 emails: `2` seconds.
   - Hourly limit: `100`.
   - Write formatted text using the rich text toolbar.
4. **Send Later Popover**:
   - Click the clock icon in the header to open the `Send Later` popover.
   - Show the presets (`Tomorrow`, `10:00 AM`) and custom date picker. Click `Done` or set to send now + 5 seconds.
   - Click `Send` / `Send Later`.
   - Notice the toast confirmation: *"Dispatch started for 3 recipients!"*.

---

## Step 3: Scheduled & Sent Tabs & Ethereal Inbox (1:45 - 2:30)
1. **Inspect Scheduled Tab**:
   - Point out the scheduled email rows: orange timestamp badges (`🕒 Tue 9:15:12 AM`), bold subject, and preview snippet.
2. **Live Transition to Sent Tab**:
   - Watch the emails move from `Scheduled` to `Sent` as the BullMQ worker processes them.
   - Switch to the `Sent` tab: point out the `Sent` status badge.
3. **Open Email Detail View**:
   - Click on one of the sent email rows.
   - Show the detail view matching Figma: sender avatar, formatted body, and attachment cards.
   - Click **"View Ethereal Preview"** to open the real Nodemailer Ethereal web inbox showing the delivered email.

---

## Step 4: Server Stop & Restart Recovery (2:30 - 3:30)
1. **Schedule a Future Email**:
   - Click `Compose`, add a recipient (`recovery_test@example.com`), set the scheduled time for 5 minutes in the future via `Send Later`, and click `Send Later`.
   - Verify it appears in the `Scheduled` tab.
2. **Simulate Crash / Stop Backend**:
   - Switch to the backend terminal and press `Ctrl+C` to terminate the server.
   - Show that the server is completely stopped.
3. **Restart the Backend**:
   - Restart with `npm run dev`.
   - Point out the startup log message:
     ```
     [INFO] Running startup recovery check for scheduled & in-flight emails...
     [INFO] Startup recovery finished. Checked 1 SCHEDULED emails, recovered 0 missing queue job(s).
     ```
   - Explain:
     - Redis AOF persistence preserved the delayed job.
     - Startup recovery checked PostgreSQL for pending `SCHEDULED` emails and verified they exist in BullMQ without duplicating.
     - If the delayed job had been dropped, recovery would have automatically rescheduled it with the remaining delay.

---

## Step 5: Rate Limiting, Slack Alert & 1,000+ Email Spillover (3:30 - 5:00)
1. **Open Bull Board Queue Dashboard**:
   - Switch to `http://localhost:5001/admin/queues` (Login: `admin` / `adminsecret`).
   - Show the `email-dispatch-queue` live stats (Waiting, Active, Delayed, Completed).
2. **Run the 1,000+ Email Load Test**:
   - In the terminal, execute:
     ```bash
     cd backend && LOAD_TEST_LIMIT=15 npx tsx ../scripts/load-test.ts
     ```
   - Observe in the terminal:
     - 1,050 emails scheduled in under 100ms.
     - The first 15 emails per sender process in the current hour window.
3. **Demonstrate Spillover into Next Hour**:
   - In the Bull Board dashboard, show the **Delayed** tab.
   - Point out that remaining jobs have been rescheduled to the next hour window (`nextHour`) with an offset based on original campaign position.
   - Emphasize: **Zero jobs were dropped or marked failed**.
4. **Slack Alert Notification**:
   - Show that when the hourly limit was reached, a notification was triggered to Slack:
     > ⚠️ *Hourly Rate Limit Reached for sender ... Pending jobs have been rescheduled to spill over into the next hourly window.*
   - Mention deduplication: the alert is sent only once per sender per hour window, rather than spamming 1,000 notifications.

---

## Summary Checklist for Demo
- [x] Zero cron jobs (BullMQ delayed jobs only)
- [x] Atomic DB update prevents duplicate sends (`SCHEDULED -> PROCESSING`)
- [x] Lossless server restart recovery
- [x] Hourly rate limit spillover preserves ordering and drops zero jobs
- [x] Multi-sender Ethereal rotation
- [x] Full-text search with Elasticsearch
- [x] Live Bull Board dashboard (`/admin/queues`)
- [x] Figma-accurate UI matching all 7 screenshots

