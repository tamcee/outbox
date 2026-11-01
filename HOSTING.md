# Deployment & Hosting Guide

This guide covers the two most effective ways to host the **0NB Email Scheduler**:

1. **Option 1 (Recommended)**: Single-Server VPS with Docker Compose (DigitalOcean, Hetzner, AWS EC2) — **Fastest, cheapest ($5–$10/mo), identical to local development**.
2. **Option 2**: PaaS Deployment (Railway or Render) — **Zero-infra managed cloud**.

---

## Option 1: VPS Deployment (DigitalOcean / Hetzner / AWS EC2)

Because the project includes PostgreSQL, Redis, Elasticsearch, Backend, and Frontend, deploying with `docker-compose.prod.yml` on a single Linux virtual machine ensures all inter-service networking and persistence work out-of-the-box.

### Step 1: Create a VPS
- Launch an **Ubuntu 24.04 LTS** server with at least **2 GB – 4 GB RAM** (e.g. DigitalOcean $12/mo droplet or Hetzner CX22 $4/mo).
- Ensure ports `80` (HTTP), `443` (HTTPS), and `22` (SSH) are open.

### Step 2: Install Docker & Git on Server
SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```
Install Docker:
```bash
curl -fsSL https://get.docker.com | sh
```

### Step 3: Clone Your Repository & Setup Environment
```bash
git clone <YOUR_GIT_REPO_URL> app
cd app
```
Create and configure `backend/.env` with your production domains and keys:
```bash
cp backend/.env.example backend/.env
nano backend/.env
```
Ensure your OAuth callbacks point to your production domain or server IP:
```env
FRONTEND_URL=https://yourdomain.com
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
SLACK_REDIRECT_URI=https://yourdomain.com/api/slack/callback
```
*(Remember to update the authorized redirect URLs in your Google Cloud Console and Slack API Dashboard).*

### Step 4: Launch Production Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
This builds and starts:
- PostgreSQL (database)
- Redis (persisted queues)
- Elasticsearch (search engine)
- Node.js Express Backend & BullMQ Worker
- Nginx Frontend (serving React SPA on port 80 and reverse-proxying `/api` and `/admin`)

### Step 5: (Optional) Free SSL Certificate with Caddy or Certbot
If using a custom domain (e.g. `scheduler.yourdomain.com`), point an `A` record to `YOUR_SERVER_IP`.
Install Caddy for 1-minute automatic SSL:
```bash
sudo apt install -y caddy
```
Edit `/etc/caddy/Caddyfile`:
```caddy
yourdomain.com {
    reverse_proxy localhost:80
}
```
Reload Caddy:
```bash
sudo systemctl reload caddy
```
Your application is now live with automatic HTTPS!

---

## Option 2: Railway Deployment (Fully Managed PaaS)

Railway allows deploying each service as a cloud component without managing a Linux server.

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/email-scheduler.git
   git push -u origin main
   ```
2. **Open [Railway.app](https://railway.app)**:
   - Click **"New Project"** -> **"Provision PostgreSQL"**.
   - Click **"New"** -> **"Database"** -> **"Add Redis"**.
   - Click **"New"** -> **"GitHub Repo"** -> select your repo -> set root directory to `/backend`.
     - In backend settings, add variables from `backend/.env` (`DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, etc. linked to the provisioned Postgres and Redis).
   - Click **"New"** -> **"GitHub Repo"** -> select your repo -> set root directory to `/frontend`.
     - In frontend settings, set `VITE_API_BASE_URL` to your Railway backend URL.

---

## Verifying Deployment

Once deployed, visit your live URL:
- **Web App**: `https://yourdomain.com` (or `http://YOUR_SERVER_IP`)
- **Queue Dashboard**: `https://yourdomain.com/admin/queues`
- **Health Check**: `https://yourdomain.com/api/health`

