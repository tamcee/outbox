# Deploying on Render: Step-by-Step Guide

This guide walks you through deploying the **0NB Email Scheduler** on [Render](https://render.com).

A complete `render.yaml` (Render Blueprint) has already been created in the repository root so you can deploy everything in **one click**, or set it up manually.

---

## Method 1: One-Click Blueprint Deployment (Recommended)

Render Blueprints automatically provision **PostgreSQL**, **Redis**, the **Backend API & Worker**, and the **Frontend React App** all connected together.

### Step 1: Push your code to GitHub
If you haven't pushed your code to GitHub yet:
```bash
git add .
git commit -m "feat: complete email scheduler with Render blueprint"
git remote add origin https://github.com/YOUR_USERNAME/outbox.git
git branch -M main
git push -u origin main
```

### Step 2: Create a Blueprint Instance on Render
1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **"New +"** in the top right and select **"Blueprint"**.
3. Connect your GitHub account and select your `outbox` repository.
4. Render will detect `render.yaml` and list the 4 resources to be created:
   - `email-scheduler-postgres` (Managed PostgreSQL Database)
   - `email-scheduler-redis` (Managed Redis Instance)
   - `email-scheduler-backend` (Node Web Service)
   - `email-scheduler-frontend` (Static Site with SPA rewrite rules)
5. Fill in the prompted secret variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SLACK_CLIENT_ID`
   - `SLACK_CLIENT_SECRET`
6. Click **"Apply"**.

Render will provision the database, spin up Redis, compile the backend, push the Prisma database schema, build the frontend, and deploy everything!

---

## Method 2: Manual UI Setup on Render

If you prefer to configure each component manually in Render's dashboard:

### 1. Create PostgreSQL Database
1. In Render, click **New +** -> **PostgreSQL**.
2. Name: `email-scheduler-postgres`.
3. Database: `emailscheduler`. User: `postgres`.
4. Click **Create Database**.
5. Copy the **Internal Database URL** (e.g. `postgresql://postgres:...@dpg-...-a:5432/emailscheduler`).

### 2. Create Redis Instance
1. In Render, click **New +** -> **Redis**.
2. Name: `email-scheduler-redis`.
3. Click **Create Redis**.
4. Copy the **Internal Redis URL** (e.g. `redis://red-...:6379`).

### 3. Deploy Backend Web Service
1. Click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `email-scheduler-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma db push && node dist/server.js`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Paste Internal Database URL from Step 1)*
   - `REDIS_URL`: *(Paste Internal Redis URL from Step 2)*
   - `FRONTEND_URL`: `https://email-scheduler-frontend.onrender.com` *(Update once frontend is created)*
   - `JWT_SECRET`: *(A random 32-character string)*
   - `SESSION_COOKIE_NAME`: `email_scheduler_token`
   - `GOOGLE_CLIENT_ID`: `your-google-client-id`
   - `GOOGLE_CLIENT_SECRET`: `your-google-client-secret`
   - `GOOGLE_CALLBACK_URL`: `https://email-scheduler-backend.onrender.com/api/auth/google/callback`
   - `SLACK_CLIENT_ID`: `your-slack-client-id`
   - `SLACK_CLIENT_SECRET`: `your-slack-client-secret`
   - `SLACK_REDIRECT_URI`: `https://email-scheduler-backend.onrender.com/api/slack/callback`
   - `MAX_EMAILS_PER_HOUR_PER_SENDER`: `100`
   - `MIN_DELAY_PER_SENDER_MS`: `2000`
   - `WORKER_CONCURRENCY`: `5`
   - `ADMIN_PASSWORD`: `adminsecret`
5. Click **Create Web Service**.

### 4. Deploy Frontend Static Site
1. Click **New +** -> **Static Site**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `email-scheduler-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://email-scheduler-backend.onrender.com/api`
5. In **Redirects / Rewrites** tab:
   - Click **Add Rule**:
     - **Type**: `Rewrite`
     - **Source**: `/*`
     - **Destination**: `/index.html`
   *(This ensures client-side routes like `/login` or bookmarks don't return 404)*
6. Click **Create Static Site**.

---

## Step 3: Update Google & Slack OAuth Redirect URLs

Once Render assigns your live domain names (e.g. `https://email-scheduler-backend.onrender.com`):

1. **Google Cloud Console**:
   - Go to [APIs & Services -> Credentials](https://console.cloud.google.com/apis/credentials).
   - Click your OAuth 2.0 Web Client ID.
   - Under **Authorized redirect URIs**, add:
     ```
     https://<YOUR_RENDER_BACKEND>.onrender.com/api/auth/google/callback
     ```
   - Save changes.

2. **Slack API Dashboard**:
   - Go to [Slack Apps](https://api.slack.com/apps).
   - Select your app -> **OAuth & Permissions**.
   - Under **Redirect URLs**, add:
     ```
     https://<YOUR_RENDER_BACKEND>.onrender.com/api/slack/callback
     ```
   - Save URLs.

---

## Note on Elasticsearch & Bull Board

- **Elasticsearch**: If you do not attach an external Elasticsearch instance, the backend gracefully runs in fallback mode where search queries query PostgreSQL directly with zero errors or disruption. If you'd like full Elasticsearch on Render, you can create a free account on [Elastic Cloud](https://cloud.elastic.co/) or [Bonsai](https://bonsai.io/) and set `ELASTICSEARCH_NODE=https://user:pass@cluster.bonsaisearch.net`.
- **Bull Board Dashboard**: Accessible in production at:
  ```
  https://<YOUR_RENDER_BACKEND>.onrender.com/admin/queues
  ```
  Log in with username `admin` and the password you set in `ADMIN_PASSWORD`.

