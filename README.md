Bhai, gussa mat kar. Ye le ekdum professional aur detailed `README.md`. Isme wo saare "fuck ups" cover kiye hain jo humne fix kiye (Razorpay Webhook Metadata, Docker Networking, aur OpenClaw Security).

Is file ko apne root folder mein `README.md` naam se save kar le.

---

# 🦞 LocalClaw Pro

**Self-Hosted Autonomous AI Agent SaaS Platform**

LocalClaw Pro allows you to deploy, manage, and monetize autonomous AI agents using **OpenClaw** (Agent Framework) and **Ollama** (Local LLMs). It comes with a built-in SaaS subscription model powered by **Razorpay**, fully containerized with **Docker**.

---

## ⚡ Features

- **Autonomous Agents:** Deploy agents that can browse the web, write code, and use tools.
- **Local LLM Support:** Runs entirely on your hardware using Ollama (Qwen 2.5, Llama 3, etc.).
- **SaaS Monetization:** Integrated Razorpay payment gateway for "Pro" subscriptions.
- **Zero-Config Tunneling:** Built-in Ngrok service to handle webhooks automatically.
- **Secure Gateway:** Custom OpenClaw gateway configuration to prevent local network conflicts.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

1. **Docker Desktop** (Must be running).
2. **Node.js v18+** (For local development/testing).
3. **Ngrok Account**: You need an Authtoken from [dashboard.ngrok.com](https://dashboard.ngrok.com).
4. **Razorpay Account**: For payment processing (Test mode is fine).

---

## Minimum System Requirements

1. **GPU**: GTX 1650 & Above (VRAM > 4GB)
2. **CPU**: Intel i5 & Above (Minimum 11th gen) H or HX Prefix in Laptop
3. **RAM**: 16GB & Above
4. **Free Disk Page**: 5GB & Above

---

## 🚀 Setup Guide (For Developers)

### 1. Clone & Install

```bash
git clone https://github.com/AbhayPadgaonkar/localclaw.git
cd localclaw-pro
npm install

```

### 2. Environment Configuration (`.env`)

Create a `.env` file in the root directory. **Do not ignore this step.**

```ini
# --- DATABASE (PostgreSQL) ---
# NOTE: In Docker, host is 'postgres', not 'localhost'
DATABASE_URL=postgresql://user:password@postgres:5432/localclaw

# --- RAZORPAY PAYMENTS ---
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
RAZORPAY_PLAN_ID=plan_YOUR_PLAN_ID

# --- OPENCLAW AGENT SECURITY ---
# Master token for agent-gateway communication
OPENCLAW_GATEWAY_TOKEN=localclaw_master_secret_key

# --- AUTHENTICATION (NextAuth) ---
NEXTAUTH_SECRET="random_string_here"
NEXTAUTH_URL=http://localhost:3000

# --- GOOGLE OAUTH ---
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret

# --- EMAIL (SMTP for Invoices) ---
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# --- NGROK TUNNELING (Crucial) ---
# Get this from https://dashboard.ngrok.com/get-started/your-authtoken
NGROK_AUTHTOKEN=YOUR_NGROK_TOKEN

```

### 3. Run with Docker

We use Docker Compose to spin up the Manager (App), Database, Ollama, and Ngrok simultaneously.

```bash
# Start all services
docker-compose up -d --build

```

**Services started:**

- `manager`: Next.js App (Port 3000)
- `postgres`: Database (Port 5432)
- `ollama`: AI Model Server (Port 11434)
- `ngrok`: Tunneling Service (Port 4040 Dashboard)

---

## ⚙️ Critical Configuration (Don't Skip)

### Setup Razorpay Webhooks

For subscriptions to update automatically, Razorpay must talk to your Docker container.

1. After `docker-compose up`, go to `http://localhost:4040` in your browser.
2. Copy the **https** URL (e.g., `https://a1b2-c3d4.ngrok-free.app`).
3. Go to **Razorpay Dashboard** -> **Settings** -> **Webhooks**.
4. Add New Webhook:

- **URL**: `YOUR_NGROK_URL/api/webhooks/razorpay`
- **Secret**: Must match `RAZORPAY_WEBHOOK_SECRET` in your `.env`.
- **Events**: Check `payment.captured` and `subscription.activated`.

---

## 🐛 Troubleshooting (Common Issues)

### 🔴 Ngrok Error `ERR_NGROK_334` (Already Online)

**Cause:** You have a local Ngrok instance running in a terminal outside Docker.
**Fix:** Close all local terminal windows running `ngrok` and restart Docker.

### 🔴 Agent "Truncating Input" / Silent Bot

**Cause:** The prompt is too large for the default context window.
**Fix:** In `route.ts`, update the Ollama model config:

```javascript
options: {
  num_ctx: 8192; // Increases context size
}
```

---

## 📜 License

MIT License. Feel free to fork and modify.
