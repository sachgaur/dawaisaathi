# DawaiSathi — AI-Powered Family Medicine Companion

DawaiSathi is an **AI-powered family medicine management application** designed to simplify prescription scanning, dose scheduling, caregiver coordination, and multi-channel dose reminders for families. 

Powered by **Google Gemini 2.0 Flash**, **Flask**, and **React (Vite PWA)**, DawaiSathi automatically extracts medication details from paper prescriptions, organizes medicines into structured cabinets with custom schedules (including Staggered Eye Drop protocols), and delivers timely reminders via **Web Push (VAPID)** and **Telegram**.

---


## 🏗️ Architecture & Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite | Single Page Application with PWA support (`vite-plugin-pwa`, Workbox) |
| **Styling** | TailwindCSS v4 + Framer Motion | Modern, glassmorphism mobile-first UI with smooth micro-animations |
| **Backend API** | Python 3.10+ Flask | RESTful API with Flask-SQLAlchemy, Flask-CORS, PyJWT |
| **Database** | SQLite (Dev) / PostgreSQL (Prod) | Relational model for Users, Family Groups, Medicines, & Dose Logs |
| **AI / Vision** | Google Gemini 2.0 Flash | Prescription OCR & structured multi-medicine extraction (`google-generativeai`) |
| **Scheduler** | APScheduler | Background CRON job checking due dosages and queueing alerts |
| **Notifications** | Web Push (VAPID) & Telegram Bot | Browser push notifications & interactive Telegram bot with one-tap "Taken" actions |
| **Authentication** | Google OAuth 2.0 + JWT | Passwordless authentication with secure JWT session handling |

---

## 📋 Prerequisites

- **Python**: `3.10` or higher
- **Node.js**: `18.x` or higher
- **Google Cloud Platform**: OAuth 2.0 Client Credentials
- **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Telegram Bot Token** *(Optional)*: From [@BotFather](https://t.me/BotFather) for Telegram reminders

---

## 🚀 Quick Start Guide

### 1. Clone the Repository

```bash
git clone https://github.com/Project-eigen/dawaisaathi.git
cd dawaisaathi
```

---

### 2. Backend Setup (Flask API)

Navigate to the `backend` directory, create a virtual environment, and install dependencies:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Generate VAPID Keys for Push Notifications

Run the VAPID key generator script once:

```bash
python generate_vapid.py
```

Copy the generated `VAPID_PRIVATE_KEY` and `VAPID_PUBLIC_KEY` values into your backend environment file.

#### Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `backend/.env` with your values:

```env
FLASK_APP=app.py
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=your-random-secret-key

DATABASE_URL=sqlite:///dawaisathi.db

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/callback
FRONTEND_URL=http://localhost:5173

GEMINI_API_KEY=your-gemini-api-key

# Telegram Bot Integration (Optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_URL=https://your-public-tunnel-url.devtunnels.ms

# Web Push VAPID Keys
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_CLAIMS_EMAIL=admin@dawaisaathi.com
```

#### Run the Backend Server

```bash
python app.py
```

Backend API server starts at **`http://localhost:5000`**.

---

### 3. Frontend Setup (React + Vite PWA)

Open a new terminal window, navigate to the `frontend` directory, install dependencies, and start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

Frontend application runs at **`http://localhost:5173`**.

#### Build & Preview for Production

To test the compiled production PWA bundle and service worker before deployment:

```bash
npm run build     # Compiles TypeScript and builds production PWA bundle
npm run preview   # Serves the production build at http://localhost:4173
```

---

## 🔐 Google Cloud OAuth Setup

In the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **OAuth 2.0 Client IDs**:

- **Authorized JavaScript origins:**
  - `http://localhost:5173`
  - `http://localhost:5000`

- **Authorized redirect URIs:**
  - `http://localhost:5000/api/auth/callback`

---

## ✨ Key Features

- 📸 **AI Prescription Scanner**: Snap paper prescriptions with phone camera or upload images. Gemini Vision AI automatically parses medicine names, dosages, and daily time slots.
- 💊 **Smart Cabinet & Protocols**: Organize medicines by time slots (Morning, Afternoon, Evening, Night). Supports specialized protocols (e.g. Staggered Eye Drop timers with bottle cap color & target eye indicators).
- 👨‍👩‍👧‍👦 **Family & Caregiver Mode**: Manage medications across care groups. Share cabinet schedules and invite family members using email or 6-digit sync codes.
- ⏰ **Multi-Channel Reminders**: Receive real-time Web Push alerts on mobile/desktop and direct Telegram messages with inline "Taken" buttons.
- 📱 **PWA & Offline-First Design**: Installable on iOS/Android home screens with service worker offline caching.

---

## 📂 Project Structure

```
dawaisaathi/
├── Architecture_Design.md        # Technical architecture design
├── PRESENTATION.md               # Project presentation details
├── README.md                     # Project README & documentation
├── UPGRADES.md                   # Product roadmap & market analysis
├── features_for_dawaisaithi.md   # Product requirements (PRD)
├── ui_design/                    # UI mockups and design references
├── backend/                      # Flask REST API
│   ├── app.py                    # Flask application entry point
│   ├── config.py                 # Configuration settings
│   ├── extensions.py             # SQLAlchemy database setup
│   ├── models.py                 # Database models (User, Medicine, Family, Log)
│   ├── notification_helpers.py   # Web push & Telegram dispatch logic
│   ├── scheduler.py              # APScheduler CRON dosage notification worker
│   ├── generate_vapid.py         # Script to generate Web Push VAPID keys
│   ├── routes/                   # API Route blueprints (auth, medicine, family, etc.)
│   └── requirements.txt          # Python dependencies
└── frontend/                     # React 19 Vite PWA
    ├── src/                      # Source code (Components, Pages, Services)
    ├── public/                   # Static assets & PWA manifest
    ├── vite.config.ts            # Vite & Workbox PWA configuration
    └── package.json              # Frontend dependencies & scripts
```

---

## 📄 License

MIT License

